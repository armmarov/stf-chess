import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { getFee } from '../config/config.service';
import { ListPaymentsQuery, ReviewPaymentInput } from './payments.validators';
import { createManyNotifications, createNotification } from '../notifications/notifications.service';
import { env } from '../../config/env';

const UPLOADS_DIR = env.UPLOADS_DIR;

const PAYMENT_SELECT = {
  id: true,
  studentId: true,
  sessionId: true,
  amount: true,
  status: true,
  uploadedAt: true,
  reviewedById: true,
  reviewedAt: true,
  student: { select: { id: true, name: true, username: true } },
  session: { select: { id: true, date: true, startTime: true, place: true, isCancelled: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

function withReceiptUrl<T extends { id: string }>(row: T) {
  return { ...row, receiptUrl: `/api/payments/${row.id}/receipt` };
}

export async function uploadPayment(
  studentId: string,
  sessionId: string,
  file: Express.Multer.File,
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Session not found');
  if (session.isCancelled) throw new AppError(409, 'Cannot submit payment for a cancelled session');

  let fee: number;
  try {
    fee = await getFee();
  } catch {
    fee = 0;
  }

  const payment = await prisma.payment.create({
    data: {
      studentId,
      sessionId,
      amount: new Prisma.Decimal(fee.toFixed(2)),
      receiptFilePath: file.filename,
      status: 'pending',
      uploadedAt: new Date(),
    },
    select: PAYMENT_SELECT,
  });

  console.log(`[payments] uploaded by ${studentId}, session=${sessionId}, amount=${fee}`);

  // Fire-and-forget: notify all active teachers + admins
  prisma.user
    .findMany({ where: { role: { in: ['admin', 'teacher'] }, isActive: true }, select: { id: true } })
    .then((staff) => {
      const dateStr = payment.session?.date.toISOString().slice(0, 10) ?? 'unknown date';
      return createManyNotifications(
        staff.map((s) => s.id).filter((id) => id !== studentId),
        'receipt_uploaded',
        'Receipt uploaded',
        `${payment.student.name} uploaded a receipt for ${dateStr}`,
        `/payments/review/${payment.id}`,
      );
    })
    .catch((err) => console.error('[notifications] uploadPayment emission failed:', err));

  return withReceiptUrl(payment);
}

export async function listPayments(query: ListPaymentsQuery, requesterId: string, requesterRole: string) {
  const where: Prisma.PaymentWhereInput = {};

  if (requesterRole === 'student') {
    where.studentId = requesterId;
    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.status) where.status = query.status;
  } else {
    if (query.status) where.status = query.status;
    if (query.studentId) where.studentId = query.studentId;
    if (query.sessionId) where.sessionId = query.sessionId;
  }

  const rows = await prisma.payment.findMany({
    where,
    select: PAYMENT_SELECT,
    orderBy: { uploadedAt: 'desc' },
  });
  return rows.map(withReceiptUrl);
}

export async function getPayment(id: string, requesterId: string, requesterRole: string) {
  const payment = await prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
  if (!payment) throw new AppError(404, 'Payment not found');
  if (requesterRole === 'student' && payment.studentId !== requesterId) {
    throw new AppError(403, 'Forbidden');
  }
  return withReceiptUrl(payment);
}

export async function getReceiptFile(id: string, requesterId: string, requesterRole: string) {
  const payment = await prisma.payment.findUnique({ where: { id }, select: { studentId: true, receiptFilePath: true } });
  if (!payment) throw new AppError(404, 'Payment not found');
  if (requesterRole === 'student' && payment.studentId !== requesterId) {
    throw new AppError(403, 'Forbidden');
  }
  if (!payment.receiptFilePath) throw new AppError(404, 'Receipt file not available');

  const filePath = path.join(UPLOADS_DIR, payment.receiptFilePath);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'Receipt file not found on disk');

  return { filePath, filename: payment.receiptFilePath };
}

export async function reviewPayment(
  id: string,
  data: ReviewPaymentInput,
  reviewerId: string,
) {
  const payment = await prisma.payment.findUnique({ where: { id }, select: { status: true } });
  if (!payment) throw new AppError(404, 'Payment not found');
  if (payment.status !== 'pending') {
    throw new AppError(409, `Payment has already been ${payment.status}`);
  }

  if (data.note) {
    console.log(`[payments] review note for ${id}: ${data.note}`);
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      status: data.decision === 'approve' ? 'approved' : 'rejected',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    select: PAYMENT_SELECT,
  });
  // Fire-and-forget: notify the student
  const statusLabel = updated.status === 'approved' ? 'approved' : 'rejected';
  const dateStr = updated.session?.date.toISOString().slice(0, 10) ?? 'unknown date';
  createNotification(
    updated.studentId,
    'payment_reviewed',
    `Payment ${statusLabel}`,
    `Your receipt for ${dateStr} was ${statusLabel}`,
    `/student/payments/${updated.id}`,
  ).catch((err) => console.error('[notifications] reviewPayment emission failed:', err));

  return withReceiptUrl(updated);
}

export type HistoryEntry = {
  id: string;
  method: 'cash' | 'online';
  status: 'pending' | 'approved' | 'rejected';
  sessionId: string;
  sessionDate: Date;
  sessionPlace: string;
  amount: string;
  paidAt: Date;
  paymentId: string | null;
  reviewNote: null;
};

export async function getHistory(targetStudentId: string): Promise<HistoryEntry[]> {
  const [onlinePayments, cashAttendances] = await Promise.all([
    prisma.payment.findMany({
      where: { studentId: targetStudentId, sessionId: { not: null } },
      select: {
        id: true,
        sessionId: true,
        amount: true,
        status: true,
        uploadedAt: true,
        reviewedAt: true,
        session: { select: { date: true, place: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { studentId: targetStudentId, paidCash: true },
      select: {
        sessionId: true,
        markedAt: true,
        session: { select: { date: true, place: true } },
      },
    }),
  ]);

  let fee: number;
  try {
    fee = await getFee();
  } catch {
    fee = 0;
  }

  const onlineEntries: HistoryEntry[] = onlinePayments
    .filter((p) => p.session !== null)
    .map((p) => ({
      id: `online:${p.id}`,
      method: 'online' as const,
      status: p.status,
      sessionId: p.sessionId!,
      sessionDate: p.session!.date,
      sessionPlace: p.session!.place,
      amount: p.amount.toFixed(2),
      paidAt: p.reviewedAt ?? p.uploadedAt,
      paymentId: p.id,
      reviewNote: null,
    }));

  const cashEntries: HistoryEntry[] = cashAttendances.map((a) => ({
    id: `cash:${a.sessionId}:${targetStudentId}`,
    method: 'cash' as const,
    status: 'approved' as const,
    sessionId: a.sessionId,
    sessionDate: a.session.date,
    sessionPlace: a.session.place,
    amount: fee.toFixed(2),
    paidAt: a.markedAt,
    paymentId: null,
    reviewNote: null,
  }));

  return [...onlineEntries, ...cashEntries].sort(
    (a, b) => b.paidAt.getTime() - a.paidAt.getTime(),
  );
}

type ReceiptData = {
  method: 'cash' | 'online';
  studentName: string;
  studentUsername: string;
  sessionDate: Date;
  sessionStartTime: Date;
  sessionPlace: string;
  amount: string;
  paidAt: Date;
  paymentId: string | null;
  reviewerName: string | null;
  markerName: string | null;
};

export async function getReceiptData(
  entryId: string,
  requesterId: string,
  requesterRole: string,
): Promise<ReceiptData> {
  if (entryId.startsWith('online:')) {
    const paymentId = entryId.slice(7);
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        studentId: true,
        amount: true,
        reviewedAt: true,
        status: true,
        student: { select: { name: true, username: true } },
        session: { select: { date: true, startTime: true, place: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    if (!payment || !payment.session) throw new AppError(404, 'Entry not found');
    if (requesterRole === 'student' && payment.studentId !== requesterId) {
      throw new AppError(403, 'Forbidden');
    }
    if (payment.status !== 'approved' || !payment.reviewedAt) {
      throw new AppError(409, 'Receipt available only for approved payments');
    }
    return {
      method: 'online',
      studentName: payment.student.name,
      studentUsername: payment.student.username,
      sessionDate: payment.session.date,
      sessionStartTime: payment.session.startTime,
      sessionPlace: payment.session.place,
      amount: payment.amount.toFixed(2),
      paidAt: payment.reviewedAt,
      paymentId,
      reviewerName: payment.reviewedBy?.name ?? null,
      markerName: null,
    };
  }

  if (entryId.startsWith('cash:')) {
    const rest = entryId.slice(5);
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) throw new AppError(404, 'Entry not found');
    const sessionId = rest.slice(0, colonIdx);
    const studentId = rest.slice(colonIdx + 1);

    if (requesterRole === 'student' && studentId !== requesterId) {
      throw new AppError(403, 'Forbidden');
    }

    const [attendance, fee] = await Promise.all([
      prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId, studentId } },
        select: {
          paidCash: true,
          markedAt: true,
          student: { select: { name: true, username: true } },
          session: { select: { date: true, startTime: true, place: true } },
          markedBy: { select: { name: true } },
        },
      }),
      getFee().catch(() => 0) as Promise<number>,
    ]);

    if (!attendance || !attendance.paidCash) throw new AppError(404, 'Entry not found');

    return {
      method: 'cash',
      studentName: attendance.student.name,
      studentUsername: attendance.student.username,
      sessionDate: attendance.session.date,
      sessionStartTime: attendance.session.startTime,
      sessionPlace: attendance.session.place,
      amount: fee.toFixed(2),
      paidAt: attendance.markedAt,
      paymentId: null,
      reviewerName: null,
      markerName: attendance.markedBy.name,
    };
  }

  throw new AppError(404, 'Entry not found');
}

export function streamReceiptPdf(entryId: string, data: ReceiptData, res: Response): void {
  const now = new Date();
  const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
  const idPayload = entryId.startsWith('online:') ? entryId.slice(7) : entryId.slice(5);
  const shortCode = idPayload.slice(0, 8).toUpperCase();
  const serial = `STF-${dateTag}-${shortCode}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${serial}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const L = 50;   // left margin
  const R = 545;  // right edge (595 - 50)
  const W = R - L; // usable width

  // ── 1. HEADER BAND ──────────────────────────────────────────────────────────
  const logoPath = path.resolve(__dirname, '../../../assets/logo-transparent.png');
  doc.image(logoPath, L, 35, { height: 60 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a1a2e')
    .text('STF Supreme Chess', L, 44, { align: 'right', width: W });
  doc.font('Helvetica').fontSize(9).fillColor('#555555')
    .text('Payment Receipt', L, 66, { align: 'right', width: W });

  // horizontal rule under header
  doc.moveTo(L, 104).lineTo(R, 104).strokeColor('#cccccc').lineWidth(0.5).stroke();

  // ── 2. RECEIPT METADATA (right-aligned) ─────────────────────────────────────
  const metaX = R - 200;
  const issuedStr = now.toISOString().slice(0, 10);
  const methodLabel = data.method === 'cash' ? 'Cash' : 'Online';

  doc.font('Helvetica').fontSize(8).fillColor('#888888')
    .text('RECEIPT NO:', metaX, 116, { width: 200, align: 'right' });
  doc.font('Courier').fontSize(10).fillColor('#1a1a2e')
    .text(serial, metaX, 127, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#333333')
    .text(`Issued: ${issuedStr}`, metaX, 143, { width: 200, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e')
    .text(`Method: ${methodLabel}`, metaX, 157, { width: 200, align: 'right' });

  // ── 3. RECEIVED FROM (left) ──────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(8).fillColor('#888888')
    .text('RECEIVED FROM', L, 116);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a1a2e')
    .text(data.studentName, L, 128);
  doc.font('Helvetica').fontSize(9).fillColor('#666666')
    .text(`@${data.studentUsername}`, L, 146);

  // ── 4. DETAIL TABLE ──────────────────────────────────────────────────────────
  const tableTop = 182;
  const colLabel = L;
  const colValue = L + 160;
  const rowH = 24;

  const sessionDateStr = data.sessionDate.toISOString().slice(0, 10);
  const sessionTimeStr = data.sessionStartTime.toISOString().slice(11, 16) + ' UTC';
  const paidAtStr = data.paidAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const agentLabel = data.method === 'online' ? 'Reviewer' : 'Marked By';
  const agentValue = data.method === 'online'
    ? (data.reviewerName ?? '—')
    : (data.markerName ?? '—');

  const rows: [string, string][] = [
    ['Session Date', sessionDateStr],
    ['Session Time', sessionTimeStr],
    ['Venue', data.sessionPlace],
    ['Amount', `RM ${data.amount}`],
    ['Paid At', paidAtStr],
    [agentLabel, agentValue],
  ];

  // table outer border
  const tableH = rows.length * rowH;
  doc.rect(L, tableTop, W, tableH).strokeColor('#bbbbbb').lineWidth(0.5).stroke();

  rows.forEach(([label, value], i) => {
    const y = tableTop + i * rowH;
    // alternating row fill
    if (i % 2 === 1) {
      doc.rect(L, y, W, rowH).fillColor('#f7f7f7').fill();
    }
    // row separator
    if (i > 0) {
      doc.moveTo(L, y).lineTo(R, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    }
    // vertical column divider
    doc.moveTo(colValue - 10, y).lineTo(colValue - 10, y + rowH)
      .strokeColor('#cccccc').lineWidth(0.5).stroke();

    const textY = y + 7;
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text(label, colLabel + 6, textY, { width: colValue - colLabel - 16 });
    const isAmount = label === 'Amount';
    doc.font(isAmount ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isAmount ? 11 : 9)
      .fillColor(isAmount ? '#1a1a2e' : '#222222')
      .text(value, colValue, textY, { width: R - colValue - 4 });
  });

  // ── 5. TOTAL ROW ─────────────────────────────────────────────────────────────
  const totalY = tableTop + tableH;
  doc.rect(L, totalY, W, rowH + 4).fillColor('#1a1a2e').fill();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    .text('TOTAL', colLabel + 6, totalY + 8, { width: colValue - colLabel - 16 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    .text(`RM ${data.amount}`, colValue, totalY + 8, { width: R - colValue - 4 });

  // ── 6. FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 780;
  doc.moveTo(L, footerY).lineTo(R, footerY).strokeColor('#cccccc').lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(7).fillColor('#999999')
    .text('This is a computer-generated receipt. No signature required.', L, footerY + 6, { align: 'center', width: W });
  doc.text(`Generated: ${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`, L, footerY + 17, { align: 'center', width: W });

  doc.end();
}

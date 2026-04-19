import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { getFee } from '../config/config.service';
import { ListPaymentsQuery, ReviewPaymentInput } from './payments.validators';

const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

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
  return withReceiptUrl(payment);
}

export async function listPayments(query: ListPaymentsQuery, requesterId: string, requesterRole: string) {
  const where: Prisma.PaymentWhereInput = {};

  if (requesterRole === 'student') {
    where.studentId = requesterId;
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
  return withReceiptUrl(updated);
}

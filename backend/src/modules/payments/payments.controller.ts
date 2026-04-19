import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { receiptUpload } from '../../middleware/uploadMiddleware';
import { AppError } from '../../middleware/errorHandler';
import {
  uploadPaymentSchema,
  reviewPaymentSchema,
  listPaymentsQuerySchema,
} from './payments.validators';
import {
  uploadPayment,
  listPayments,
  getPayment,
  getReceiptFile,
  reviewPayment,
} from './payments.service';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

export function upload(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'student') { next(new AppError(403, 'Forbidden')); return; }

  receiptUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, PDF')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }
    if (!req.file) { next(new AppError(400, 'Receipt file is required')); return; }

    try {
      const parsed = uploadPaymentSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }
      const payment = await uploadPayment(req.user!.id, parsed.data.sessionId, req.file);
      res.status(201).json({ payment });
    } catch (e) { next(e); }
  });
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    if (role !== 'student' && role !== 'admin' && role !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const parsed = listPaymentsQuerySchema.safeParse(req.query);
    if (!parsed.success) { next(parsed.error); return; }
    const payments = await listPayments(parsed.data, req.user!.id, role);
    res.json({ payments });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    if (role !== 'student' && role !== 'admin' && role !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const payment = await getPayment(req.params.id, req.user!.id, role);
    res.json({ payment });
  } catch (err) { next(err); }
}

export async function downloadReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    if (role !== 'student' && role !== 'admin' && role !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const { filePath, filename } = await getReceiptFile(req.params.id, req.user!.id, role);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'teacher') {
      next(new AppError(403, 'Forbidden')); return;
    }
    const parsed = reviewPaymentSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const payment = await reviewPayment(req.params.id, parsed.data, req.user!.id);
    res.json({ payment });
  } catch (err) { next(err); }
}

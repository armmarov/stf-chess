import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recordImageUpload } from '../../middleware/uploadMiddleware';
import { createRecordSchema, updateRecordSchema } from './records.validators';
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  getImageFile,
} from './records.service';

const IMAGE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// multer stores multipart text fields as strings; coerce where needed.
function coerceBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const k of ['pajsk', 'fideRated', 'mcfRated']) {
    if (typeof out[k] === 'string') out[k] = out[k] === 'true' || out[k] === '1';
  }
  if (typeof out.placement === 'string') {
    const s = out.placement.trim();
    out.placement = s === '' || s === 'null' ? null : Number(s);
  }
  if (typeof out.removeImage === 'string') {
    out.removeImage = out.removeImage === 'true' || out.removeImage === '1';
  }
  return out;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    const records = await listRecords(studentId);
    res.json({ records });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await getRecord(req.params.id);
    res.json({ record });
  } catch (err) {
    next(err);
  }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  recordImageUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Image exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = createRecordSchema.safeParse(coerceBody(req.body));
      if (!parsed.success) { next(parsed.error); return; }
      const record = await createRecord(
        parsed.data,
        req.user!.id,
        req.user!.id,
        req.user!.role,
        req.file,
      );
      res.status(201).json({ record });
    } catch (e) { next(e); }
  });
}

export function update(req: Request, res: Response, next: NextFunction): void {
  recordImageUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'Image exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const body = coerceBody(req.body);
      const removeImage = body.removeImage === true;
      delete body.removeImage;

      const parsed = updateRecordSchema.safeParse(body);
      if (!parsed.success) { next(parsed.error); return; }

      const record = await updateRecord(
        req.params.id,
        { ...parsed.data, removeImage },
        req.user!.id,
        req.user!.role,
        req.file,
      );
      res.json({ record });
    } catch (e) { next(e); }
  });
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteRecord(req.params.id, req.user!.id, req.user!.role);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function downloadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fullPath, filename } = await getImageFile(req.params.id);
    const ext = path.extname(filename).toLowerCase();
    res.setHeader('Content-Type', IMAGE_MIME_MAP[ext] ?? 'application/octet-stream');
    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
}

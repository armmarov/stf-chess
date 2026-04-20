import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { pollOptionImagesUpload } from '../../middleware/uploadMiddleware';
import { createPollSchema, updatePollSchema, voteSchema } from './polls.validators';
import {
  listPolls,
  getPoll,
  createPoll,
  updatePoll,
  deletePoll,
  getOptionImageFile,
  castVote,
} from './polls.service';

const IMAGE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const polls = await listPolls(req.user!.id);
    res.json({ polls });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const poll = await getPoll(req.params.id, req.user!.id, req.user!.role);
    res.json({ poll });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }

  pollOptionImagesUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = createPollSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }

      const files = (req.files as Record<string, Express.Multer.File[]>) ?? {};
      const optionFiles: Record<number, Express.Multer.File> = {};
      for (let i = 0; i < parsed.data.options.length; i++) {
        const f = files[`option_${i}`]?.[0];
        if (f) optionFiles[i] = f;
      }

      const poll = await createPoll(parsed.data, req.user!.id, optionFiles);
      res.status(201).json({ poll });
    } catch (e) { next(e); }
  });
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    const parsed = updatePollSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const poll = await updatePoll(req.params.id, parsed.data, req.user!.role);
    res.json({ poll });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    await deletePoll(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function downloadOptionImage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { filePath, filename } = await getOptionImageFile(req.params.id, req.params.optionId);
    const ext = path.extname(filename).toLowerCase();
    const contentType = IMAGE_MIME_MAP[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
}

export async function vote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = voteSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const poll = await castVote(req.params.id, req.user!.id, parsed.data.optionId, req.user!.role);
    res.status(201).json({ poll });
  } catch (err) { next(err); }
}

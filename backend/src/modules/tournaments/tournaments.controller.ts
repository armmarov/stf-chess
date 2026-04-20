import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { tournamentImageUpload } from '../../middleware/uploadMiddleware';
import {
  createTournamentSchema,
  updateTournamentSchema,
  interestSchema,
} from './tournaments.validators';
import {
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  getImageFile,
  toggleInterest,
} from './tournaments.service';

const IMAGE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournaments = await listTournaments(req.user!.id, req.user!.role);
    res.json({ tournaments });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tournament = await getTournament(req.params.id, req.user!.id, req.user!.role);
    res.json({ tournament });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }

  tournamentImageUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }
      const tournament = await createTournament(parsed.data, req.user!.id, req.file);
      res.status(201).json({ tournament });
    } catch (e) { next(e); }
  });
}

export function update(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }

  tournamentImageUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_MIME') {
      next(new AppError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 5 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = updateTournamentSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }
      const tournament = await updateTournament(req.params.id, parsed.data, req.file);
      res.json({ tournament });
    } catch (e) { next(e); }
  });
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    await deleteTournament(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function downloadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { filePath, filename } = await getImageFile(req.params.id);
    const ext = path.extname(filename).toLowerCase();
    const contentType = IMAGE_MIME_MAP[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
}

export async function interest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'student') { next(new AppError(403, 'Forbidden')); return; }
    const parsed = interestSchema.safeParse(req.body);
    if (!parsed.success) { next(parsed.error); return; }
    const result = await toggleInterest(req.params.id, req.user!.id, parsed.data.interested);
    res.json(result);
  } catch (err) { next(err); }
}

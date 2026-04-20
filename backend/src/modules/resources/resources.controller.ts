import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { resourceUpload } from '../../middleware/uploadMiddleware';
import { createResourceSchema, updateResourceSchema } from './resources.validators';
import {
  listResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  getResourceImageFile,
  getResourceFile,
} from './resources.service';

const IMAGE_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function getFiles(req: Request) {
  const files = (req.files as Record<string, Express.Multer.File[]>) ?? {};
  return {
    imageFile: files['image']?.[0],
    resourceFile: files['file']?.[0],
  };
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;
    const resources = await listResources(req.user!.role, typeFilter);
    res.json({ resources });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resource = await getResource(req.params.id, req.user!.role);
    res.json({ resource });
  } catch (err) { next(err); }
}

export function create(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }

  resourceUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_IMAGE_MIME') {
      next(new AppError(400, 'Invalid image type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 20 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = createResourceSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }

      const { imageFile, resourceFile } = getFiles(req);

      // Image-specific 5 MB check (global limit is 20 MB for the file field)
      if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        next(new AppError(400, 'Image exceeds 5 MB limit')); return;
      }

      const resource = await createResource(parsed.data, req.user!.id, imageFile, resourceFile);
      res.status(201).json({ resource });
    } catch (e) { next(e); }
  });
}

export function update(req: Request, res: Response, next: NextFunction): void {
  if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }

  resourceUpload(req, res, async (err) => {
    if (err?.message === 'INVALID_IMAGE_MIME') {
      next(new AppError(400, 'Invalid image type. Allowed: JPEG, PNG, WebP')); return;
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'File exceeds 20 MB limit')); return;
    }
    if (err) { next(err); return; }

    try {
      const parsed = updateResourceSchema.safeParse(req.body);
      if (!parsed.success) { next(parsed.error); return; }

      const { imageFile, resourceFile } = getFiles(req);

      if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        next(new AppError(400, 'Image exceeds 5 MB limit')); return;
      }

      const resource = await updateResource(req.params.id, parsed.data, imageFile, resourceFile);
      res.json({ resource });
    } catch (e) { next(e); }
  });
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== 'admin') { next(new AppError(403, 'Forbidden')); return; }
    await deleteResource(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function downloadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { filePath, filename } = await getResourceImageFile(req.params.id, req.user!.role);
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    res.setHeader('Content-Type', IMAGE_MIME_MAP[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
}

export async function downloadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { filePath, downloadName, mime } = await getResourceFile(req.params.id, req.user!.role);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
}

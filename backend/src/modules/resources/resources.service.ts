import path from 'path';
import fs from 'fs';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { CreateResourceInput, UpdateResourceInput } from './resources.validators';

const UPLOADS_DIR = env.UPLOADS_DIR;
const RESOURCES_DIR = path.join(UPLOADS_DIR, 'resources');

function ensureResourcesDir() {
  if (!fs.existsSync(RESOURCES_DIR)) fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

function tryDeleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[resources] failed to delete file ${filePath}:`, err);
  }
}

function toRelativePath(file: Express.Multer.File): string {
  return path.relative(UPLOADS_DIR, file.path);
}

const RESOURCE_SELECT = {
  id: true,
  title: true,
  type: true,
  description: true,
  url: true,
  isEnabled: true,
  imagePath: true,
  filePath: true,
  fileName: true,
  fileMime: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

function toPublic(row: {
  imagePath: string | null;
  filePath: string | null;
  fileName: string | null;
  fileMime: string | null;
  [key: string]: unknown;
}) {
  const { imagePath, filePath, fileMime, ...rest } = row;
  return {
    ...rest,
    hasImage: imagePath !== null,
    hasFile: filePath !== null,
  };
}

export async function listResources(role: string, typeFilter?: string) {
  const where: { type?: 'book' | 'homework' | 'app'; isEnabled?: boolean } = {};
  if (typeFilter === 'book' || typeFilter === 'homework' || typeFilter === 'app') {
    where.type = typeFilter;
  }
  if (role !== 'admin') where.isEnabled = true;

  const rows = await prisma.resource.findMany({
    where,
    select: RESOURCE_SELECT,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toPublic);
}

export async function getResource(id: string, role: string) {
  const row = await prisma.resource.findUnique({ where: { id }, select: RESOURCE_SELECT });
  if (!row) throw new AppError(404, 'Resource not found');
  if (role !== 'admin' && !row.isEnabled) throw new AppError(404, 'Resource not found');
  return toPublic(row);
}

export async function createResource(
  data: CreateResourceInput,
  createdById: string,
  imageFile?: Express.Multer.File,
  resourceFile?: Express.Multer.File,
) {
  ensureResourcesDir();

  const row = await prisma.resource.create({
    data: {
      title: data.title,
      type: data.type,
      description: data.description ?? null,
      url: data.url ?? null,
      isEnabled: data.isEnabled,
      createdById,
      imagePath: imageFile ? toRelativePath(imageFile) : null,
      filePath: resourceFile ? toRelativePath(resourceFile) : null,
      fileName: resourceFile ? resourceFile.originalname : null,
      fileMime: resourceFile ? resourceFile.mimetype : null,
    },
    select: RESOURCE_SELECT,
  });

  return toPublic(row);
}

export async function updateResource(
  id: string,
  data: UpdateResourceInput,
  imageFile?: Express.Multer.File,
  resourceFile?: Express.Multer.File,
) {
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Resource not found');

  const removeImage = data.removeImage === 'true';
  const removeFile = data.removeFile === 'true';

  const updateData: {
    title?: string;
    type?: 'book' | 'homework' | 'app';
    description?: string | null;
    url?: string | null;
    isEnabled?: boolean;
    imagePath?: string | null;
    filePath?: string | null;
    fileName?: string | null;
    fileMime?: string | null;
  } = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.url !== undefined) updateData.url = data.url;
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

  if (removeImage) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    updateData.imagePath = null;
  } else if (imageFile) {
    if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
    ensureResourcesDir();
    updateData.imagePath = toRelativePath(imageFile);
  }

  if (removeFile) {
    if (existing.filePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.filePath));
    updateData.filePath = null;
    updateData.fileName = null;
    updateData.fileMime = null;
  } else if (resourceFile) {
    if (existing.filePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.filePath));
    ensureResourcesDir();
    updateData.filePath = toRelativePath(resourceFile);
    updateData.fileName = resourceFile.originalname;
    updateData.fileMime = resourceFile.mimetype;
  }

  const row = await prisma.resource.update({
    where: { id },
    data: updateData,
    select: RESOURCE_SELECT,
  });

  return toPublic(row);
}

export async function deleteResource(id: string) {
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Resource not found');

  if (existing.imagePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.imagePath));
  if (existing.filePath) tryDeleteFile(path.join(UPLOADS_DIR, existing.filePath));

  await prisma.resource.delete({ where: { id } });
}

export async function getResourceImageFile(id: string, role: string) {
  const row = await prisma.resource.findUnique({
    where: { id },
    select: { imagePath: true, isEnabled: true },
  });
  if (!row) throw new AppError(404, 'Resource not found');
  if (role !== 'admin' && !row.isEnabled) throw new AppError(404, 'Resource not found');
  if (!row.imagePath) throw new AppError(404, 'No image for this resource');

  const filePath = path.join(UPLOADS_DIR, row.imagePath);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'Image file not found');

  return { filePath, filename: path.basename(filePath) };
}

export async function getResourceFile(id: string, role: string) {
  const row = await prisma.resource.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, fileMime: true, isEnabled: true, title: true },
  });
  if (!row) throw new AppError(404, 'Resource not found');
  if (role !== 'admin' && !row.isEnabled) throw new AppError(404, 'Resource not found');
  if (!row.filePath) throw new AppError(404, 'No file for this resource');

  const filePath = path.join(UPLOADS_DIR, row.filePath);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found');

  const ext = path.extname(row.filePath);
  const titleSlug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const downloadName = row.fileName ?? `${titleSlug}${ext}`;

  return { filePath, downloadName, mime: row.fileMime ?? 'application/octet-stream' };
}

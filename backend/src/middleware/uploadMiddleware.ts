import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { env } from '../config/env';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOADS_DIR = env.UPLOADS_DIR;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Receipt upload (JPEG / PNG / PDF)
const RECEIPT_MIMES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const RECEIPT_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const receiptStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = RECEIPT_MIME_TO_EXT[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb: multer.FileFilterCallback) => {
    RECEIPT_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_MIME'));
  },
}).single('receipt');

// Tournament image upload (JPEG / PNG / WebP)
const TOURNAMENT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TOURNAMENT_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const tournamentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(UPLOADS_DIR, 'tournaments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = TOURNAMENT_MIME_TO_EXT[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const tournamentImageUpload = multer({
  storage: tournamentStorage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb: multer.FileFilterCallback) => {
    TOURNAMENT_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_MIME'));
  },
}).single('image');

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_MIME'));
  }
}

export const receiptUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
}).single('receipt');

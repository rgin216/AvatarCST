import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

export const GENERATED_AUDIO_DIR = path.join(BACKEND_ROOT, 'generated-audio');
export const TEMP_UPLOAD_DIR = path.join(BACKEND_ROOT, 'temp', 'uploads');

[GENERATED_AUDIO_DIR, TEMP_UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

export const upload = multer({
  dest: TEMP_UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('audio/'));
  },
});

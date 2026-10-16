import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { promises as fs } from 'fs';
import { UPLOAD_DIR } from '../config/paths.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp'
];
// Extensions that are safe to serve back as static files (no html/svg/js).
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : '';
    const unique = `${uuid()}${safeExt}`;
    cb(null, unique);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_MIME.includes(file.mimetype) && ALLOWED_EXT.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error(
      'Fayl növü dəstəklənmir. Yalnız PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP icazəlidir.'
    );
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 }
});

const router = Router();

router.post('/', requireAuth, requireRole('applicant', 'admin'), upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Heç bir fayl yüklənmədi' });
    }
    const files = req.files.map(f => ({
      id: f.filename,
      // multer/busboy decodes multipart filenames as latin1; re-decode as UTF-8
      // so non-ASCII names (e.g. Azerbaijani "ə", "ü") are stored correctly.
      originalName: Buffer.from(f.originalname || '', 'latin1').toString('utf8'),
      mime: f.mimetype,
      size: f.size,
      url: `/uploads/${f.filename}`,
      path: `/uploads/${f.filename}`,
      uploadedAt: new Date().toISOString()
    }));
    res.json({ files });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Fayl yüklənmədi' });
  }
});

router.delete('/:filename', requireAuth, requireRole('applicant', 'admin'), async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, safe);
    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Fayl tapılmadı' });
  }
});

export default router;
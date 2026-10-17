import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { promises as fs } from 'fs';
import { UPLOAD_DIR } from '../config/paths.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Vercel-in sorğu bədəni limiti 4.5 MB — Blob rejimində daha erkən kəsirik ki,
// istifadəçi aydın xəta alsın.
const BLOB_MAX_FILE_SIZE = 4 * 1024 * 1024;
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

// Vercel Blob tokenu varsa fayllar oraya yazılır. Diskli mühitdə (Docker/lokal)
// isə köhnədəki kimi `uploads/` qovluğuna. Serverless-də disk qalıcı deyil,
// ona görə Blob olmadan yükləmə yalnız lokal rejimdə aktivdir.
export const BLOB_ENABLED = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const UPLOADS_AVAILABLE = BLOB_ENABLED || !process.env.VERCEL;

const storage = BLOB_ENABLED
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: async (req, file, cb) => {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeExt = ALLOWED_EXT.includes(ext) ? ext : '';
        cb(null, `${uuid()}${safeExt}`);
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
  limits: { fileSize: BLOB_ENABLED ? BLOB_MAX_FILE_SIZE : MAX_FILE_SIZE, files: 5 }
});

const router = Router();

// multer/busboy decodes multipart filenames as latin1; re-decode as UTF-8 so
// non-ASCII names (e.g. Azerbaijani "ə", "ü") are stored correctly.
const cleanName = (name) => Buffer.from(name || '', 'latin1').toString('utf8');

function safeExtFor(name) {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXT.includes(ext) ? ext : '';
}

router.post('/', requireAuth, requireRole('applicant', 'admin'), upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Heç bir fayl yüklənmədi' });
    }

    let files;
    if (BLOB_ENABLED) {
      const { put } = await import('@vercel/blob');
      files = await Promise.all(
        req.files.map(async (f) => {
          const originalName = cleanName(f.originalname);
          const blob = await put(`uploads/${uuid()}${safeExtFor(originalName)}`, f.buffer, {
            access: 'public',
            contentType: f.mimetype,
            allowOverwrite: true
          });
          return {
            id: blob.url,
            originalName,
            mime: f.mimetype,
            size: f.size,
            url: blob.url,
            path: blob.url,
            uploadedAt: new Date().toISOString()
          };
        })
      );
    } else {
      files = req.files.map((f) => ({
        id: f.filename,
        originalName: cleanName(f.originalname),
        mime: f.mimetype,
        size: f.size,
        url: `/uploads/${f.filename}`,
        path: `/uploads/${f.filename}`,
        uploadedAt: new Date().toISOString()
      }));
    }

    res.json({ files });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Fayl yüklənmədi' });
  }
});

// Həm lokal fayl adı (`uuid.pdf`), həm də tam Blob URL qəbul edilir.
router.delete('*', requireAuth, requireRole('applicant', 'admin'), async (req, res) => {
  try {
    const target = decodeURIComponent(String(req.params[0] || ''));
    if (/^https?:\/\//i.test(target)) {
      if (!BLOB_ENABLED) return res.status(404).json({ error: 'Fayl tapılmadı' });
      const { del } = await import('@vercel/blob');
      await del(target);
      return res.json({ ok: true });
    }
    const safe = path.basename(target);
    await fs.unlink(path.join(UPLOAD_DIR, safe));
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Fayl tapılmadı' });
  }
});

export default router;

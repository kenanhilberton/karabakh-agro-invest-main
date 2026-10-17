// Must be imported before any route module so Router methods are already patched.
import './middleware/asyncPatch.js';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';

import { UPLOAD_DIR, CLIENT_DIST } from './config/paths.js';
import authRoutes from './routes/auth.js';
import landRoutes from './routes/lands.js';
import applicationRoutes from './routes/applications.js';
import roiRoutes from './routes/roi.js';
import ektisRoutes from './routes/ektis.js';
import competitionRoutes from './routes/competitions.js';
import investmentRoutes from './routes/investments.js';
import chatRoutes from './routes/chat.js';
import advisorRoutes from './routes/advisor.js';
import analyticsRoutes from './routes/analytics.js';
import uploadRoutes, { UPLOADS_AVAILABLE } from './routes/upload.js';
import notificationRoutes from './routes/notifications.js';
import { openapiSpec } from './openapi.js';
import { optionalAuth } from './middleware/auth.js';
import { apiLimiter, authLimiter, uploadLimiter, auditLog } from './middleware/rateLimit.js';
import { initDb } from './db/init.js';
import { assertConnection } from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 4000;
// Vercel (və ya digər serverless mühit) — disk qalıcı deyil, `listen` lazım deyil.
const isServerless = Boolean(process.env.VERCEL);

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(auditLog);
app.use(optionalAuth);
app.use(apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'KarabakhAgroInvest API', time: new Date().toISOString() });
});

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/lands', landRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/roi', roiRoutes);
app.use('/api/v1/ektis', ektisRoutes);
app.use('/api/v1/competitions', competitionRoutes);
app.use('/api/v1/investments', investmentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/advisor', advisorRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
// Serverless-də disk qalıcı deyil — yalnız Vercel Blob (token) olduqda yükləmə aktivdir.
if (!UPLOADS_AVAILABLE) {
  app.use('/api/v1/upload', (_req, res) => {
    res.status(501).json({
      error:
        'Fayl yükləmə bu deploy mühitində aktiv deyil. Serverless-də sənədlərin saxlanması üçün BLOB_READ_WRITE_TOKEN (Vercel Blob) təyin olunmalıdır.'
    });
  });
} else {
  app.use('/api/v1/upload', uploadLimiter, uploadRoutes);
}
app.use('/api/v1/notifications', notificationRoutes);

const swaggerPage = swaggerUi.setup(openapiSpec, { customSiteTitle: 'KarabakhAgroInvest API' });

app.get('/api-docs.json', (_req, res) => res.json(openapiSpec));
// Dəqiq `/api-docs` marşrutu: `serve-static`-in `/api-docs/`-ə 301 yönləndirməsinin
// qarşısını alır (serverless-də trailing-slash problemlərini aradan qaldırır).
app.get('/api-docs', swaggerPage);
app.use('/api-docs', swaggerUi.serve, swaggerPage);

// Swagger UI nisbi `./swagger-ui.css` yolları yaradır — səhifə `/api-docs` olduqda
// brauzer onları kökdən istəyir. `swaggerUi.serve` `index:false` ilə işlədiyi üçün
// kökdə mount etmək `/` marşrutunu tutmur, sadəcə asset-ləri (və generasiya olunan
// `swagger-ui-init.js`-i) verir.
app.use(swaggerUi.serve);

// Uploaded files (yalnız diskli mühitdə)
if (!isServerless) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR));
}

// Serve the built React client if present (single-service demo mode).
// On Vercel the frontend is served by the CDN, so this block is skipped.
const clientDist = CLIENT_DIST;
if (!isServerless && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/api-docs).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: `Tapılmadı: ${req.method} ${req.originalUrl}` });
});

// Central error handler — every rejected async handler lands here thanks to
// middleware/asyncPatch.js. Keeps the process alive and returns a JSON shape.
app.use((err, req, res, _next) => {
  if (res.headersSent) return;
  console.error('[ERROR]', req.method, req.originalUrl, '->', err?.message || err);

  if (err && err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Fayl həcmi 10 MB-dan çoxdur'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Bir dəfəyə ən çoxu 5 fayl yükləmək olar'
          : `Fayl yükləmə xətası: ${err.message}`;
    return res.status(400).json({ error: message });
  }

  const status = err?.status || err?.statusCode || 500;
  const message = status >= 500 ? 'Daxili server xətası' : err?.message || 'Sorğu xətası';
  res.status(status).json({ error: message });
});

async function boot() {
  try {
    const conn = await assertConnection();
    console.log(`  PostgreSQL bağlantısı OK  ->  ${conn.db} (${String(conn.version).split(' ').slice(0, 2).join(' ')})`);
    await initDb();
  } catch (e) {
    console.error('\n  DB başlatma xətası:', e.message);
    console.error('  server/.env faylındakı PG* dəyərlərini yoxlayın (host/port/user/password/database).\n');
    throw e;
  }
}

async function start() {
  await boot();
  app.listen(PORT, () => {
    console.log(`\n  KarabakhAgroInvest API  ->  http://localhost:${PORT}`);
    console.log(`  Swagger UI              ->  http://localhost:${PORT}/api-docs\n`);
  });
}

// Serverless (Vercel) rejimdə app export olunur, `listen` işləməməlidir.
// Top-level await-dən qaçmaq üçün bazanın hazırlanması ilk sorğuya saxlanılır:
// `api/[...path].js` handler-i `boot()`-u bir dəfə çağırır.
if (!isServerless) {
  start().catch(() => process.exit(1));
}

export default app;
export { app, boot };

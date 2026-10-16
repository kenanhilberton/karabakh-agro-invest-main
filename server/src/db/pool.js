import 'dotenv/config';

const useMemory = String(process.env.PG_MODE || '').toLowerCase() === 'memory';

// PaaS (Neon, Supabase, Render, Vercel) adətən tək bağlantı şəbəkəsi verir —
// DATABASE_URL / POSTGRES_URL. Belə halda ayrıca PG* dəyərləri tələb olunmur.
const CONN_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

function readUrl(raw) {
  try {
    const u = new URL(raw);
    const sslmode = u.searchParams.get('sslmode');
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
    // Uzaq serverlərdə (Neon və s.) SSL məcburidir; `sslmode=disable` ilə söndürmək olar.
    const wantsSSL = sslmode === 'require' || (sslmode !== 'disable' && !isLocal);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 5432,
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
      database: (u.pathname || '/').replace(/^\//, '') || 'postgres',
      ssl: wantsSSL ? { rejectUnauthorized: false } : undefined
    };
  } catch {
    return null;
  }
}

let pool;
let _query;
let _assertConnection;
let _closePool;

if (useMemory) {
  const { newDb } = await import('pg-mem');
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  pool = new Pool();

  _query = (text, params) => pool.query(text, params);
  _assertConnection = async () => ({ db: 'pg-mem (in-memory)', version: '18 (emulated)' });
  _closePool = async () => { try { await pool.end(); } catch {} };
  console.log('  PostgreSQL: in-memory (pg-mem) rejimi aktivdir.');
} else {
  const pg = await import('pg');
  const { Pool } = pg;

  const fromUrl = CONN_URL ? readUrl(CONN_URL) : null;
  const config = fromUrl || {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'karabakh'
  };

  if (!fromUrl && String(process.env.PGSSLMODE || '').toLowerCase() === 'require') {
    config.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool({
    ...config,
    max: 10,
    idleTimeoutMillis: 30000
  });

  pool.on('error', (err) => {
    console.error('PG pool gözlənilməz xəta:', err.message);
  });

  _query = (text, params) => pool.query(text, params);
  _assertConnection = async () => {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    return rows[0];
  };
  _closePool = async () => { await pool.end(); };
}

export { pool };

export function query(text, params) {
  return _query(text, params);
}

export function assertConnection() {
  return _assertConnection();
}

export function closePool() {
  return _closePool();
}
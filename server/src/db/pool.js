import 'dotenv/config';

const useMemory = String(process.env.PG_MODE || '').toLowerCase() === 'memory';

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

  pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'karabakh',
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
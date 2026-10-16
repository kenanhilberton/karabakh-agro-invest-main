import 'dotenv/config';
import { initDb, runSchema, resetData, seed } from './init.js';
import { query, closePool } from './pool.js';

const reset = process.argv.includes('--reset');

async function main() {
  console.log(`\n  KarabakhAgroInvest  ->  PostgreSQL init${reset ? ' (RESET)' : ''}`);
  if (reset) {
    await runSchema();
    await resetData();
    console.log('  DB: mövcud cədvəllər təmizləndi.');
    await seed({ force: true });
  } else {
    await initDb();
  }

  const { rows } = await query(`
    SELECT
      (SELECT count(*) FROM users)::int        AS users,
      (SELECT count(*) FROM lands)::int        AS lands,
      (SELECT count(*) FROM competitions)::int AS competitions,
      (SELECT count(*) FROM applications)::int AS applications
  `);
  const c = rows[0];
  console.log(`  DB cəmləri: users=${c.users} lands=${c.lands} competitions=${c.competitions} applications=${c.applications}\n`);
}

main()
  .catch((e) => {
    console.error('  DB init xətası:', e.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());

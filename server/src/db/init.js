import fs from 'node:fs';
import { query } from './pool.js';
import { v4 as uuid } from 'uuid';
import { buildPlots, buildUsers, buildCompetitions, DISTRICTS } from '../data/seed.js';
import {
  insertUser, insertLand, insertCompetition, getUsers, updateUserPassword,
  listInvestmentProjects, insertInvestmentProject, listLands, setLandPurpose
} from './repository.js';
import { isHashed } from '../utils/password.js';

// Apply schema.sql (idempotent - CREATE TABLE IF NOT EXISTS + indexes)
// `new URL(..., import.meta.url)` formalı @vercel/nft tərəfindən etibarlı şəkildə
// izlənir — serverless bundle-a schema.sql mütləq daxil olur.
const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

export async function runSchema() {
  const sql = fs.readFileSync(SCHEMA_URL, 'utf8');
  await query(sql);
}

// Wipe all domain tables (used by `npm run db:reset`)
export async function resetData() {
  await query('TRUNCATE applications, lands, competitions, users CASCADE');
}

// Seed initial demo data only when the users table is empty
export async function seed({ force = false } = {}) {
  if (!force) {
    const users = await getUsers();
    if (users.length > 0) return { seeded: false };
  }
  for (const u of buildUsers()) await insertUser(u);
  for (const l of buildPlots()) await insertLand(l);
  for (const c of buildCompetitions()) await insertCompetition(c);
  return { seeded: true };
}

// Seed demo co-investment projects on state-owned land, differentiated by relief.
export async function seedInvestmentProjects() {
  const existing = await listInvestmentProjects();
  if (existing.length > 0) return { seeded: false, count: 0 };
  const users = await getUsers();
  const official = users.find((u) => u.role === 'operator') || users.find((u) => u.role === 'admin') || null;
  const reliefFor = (d) => {
    if (['Kalbajar', 'Lachin'].includes(d)) return 'Dağlıq';
    if (['Shusha', 'Gubadli'].includes(d)) return 'Dağ ətəyi';
    return 'Düzənlik';
  };
  // Link demo projects to real land plots so "Xəritədə göstər" works.
  const lands = await listLands();
  const landByCode = new Map(lands.map((l) => [l.code, l]));
  const samples = [
    { title: 'Füzulidə intensiv badam bağı + damcı suvarma', landCode: 'FUZ-0500', purpose: 'findiq', purposeLabel: 'Fındıqçılıq', model: 'equity', equity: 32, months: 30, milestones: ['Torpaq icarəsi və EKTİS qeydiyyatı', 'Quyu qazılması və elektrik', 'Damcı suvarma sistemi', 'Sertifikatlı tinglər və əkin', 'Məhsul yığımı və soyuducu anbar'] },
    { title: 'Ağdam istixana kompleksi (pomidor/xiyar)', landCode: 'AGD-0450', purpose: 'istixana', purposeLabel: 'İstixana', model: 'profit_share', profit: 35, months: 24, milestones: ['İstixana təməli və metal karkas', 'Şüşə/plyonka örtük', 'İstilik sistemi və elektrik', 'Sulama/ventilyasiya', 'Sənaye əkini və marketinq'] },
    { title: 'Cəbrayıl üzümçülük və çaxır sexi', landCode: 'JAB-0680', purpose: 'uzum', purposeLabel: 'Üzümçülük', model: 'fixed_yield', yield: 20, months: 36, milestones: ['Torpaq hazırlığı', 'Tinglərin əkini', 'Damcı suvarma', 'İlk məhsul yığımı', 'Çaxır sexi quraşdırması'] }
  ];
  let count = 0;
  for (const s of samples) {
    const land = landByCode.get(s.landCode) || null;
    const district = land?.district || null;
    const districtName = land?.districtName || district;
    const relief = land?.relief || reliefFor(district);
    const areaHa = land?.areaHa ?? null;
    const ndviSeed = (district || '').length + (s.purpose || '').length;
    const ndviScore = Math.min(95, 60 + ((ndviSeed * 7) % 25));
    const ndviHealth = ndviScore >= 78 ? 'Yaxşı' : ndviScore >= 62 ? 'Orta' : 'Zəif';
    const riskScore = Math.min(95, 50 + (ndviSeed % 20));
    if (land) await setLandPurpose(land.id, s.purpose, s.purposeLabel);
    await insertInvestmentProject({
      ownerId: official ? official.id : null,
      ownerVoen: '1000000000',
      ownerName: 'Azərbaycan Respublikası (Dövlət Torpaq Fondu)',
      ownerType: 'dovlet',
      landId: land?.id || null,
      landCode: s.landCode,
      district, districtName, purpose: s.purpose, purposeLabel: s.purposeLabel,
      title: s.title,
      description: `${districtName || ''} rayonunda dövlət tərəfindən irəli sürülən ${s.landCode} kodlu torpaq sahəsi (${relief} relyef) investisiyaya təklif olunur. NDVI və AI risk göstəriciləri əsasında qiymətləndirilib.`,
      totalBudget: 0, selfFunded: 0, requiredInvestment: 0, raisedInvestment: 0,
      areaHa,
      equityOffered: s.equity ?? null, profitShare: s.profit ?? null, fixedYield: s.yield ?? null,
      model: s.model, milestones: s.milestones.map((label) => ({ label, done: false })),
      timelineMonths: s.months, status: 'open',
      riskScore, ndviScore, ndviHealth, relief
    });
    count += 1;
  }
  return { seeded: true, count };
}
export async function migratePasswords() {
  const users = await getUsers();
  let migrated = 0;
  for (const u of users) {
    if (!isHashed(u.password)) {
      await updateUserPassword(u.id, u.password);
      migrated += 1;
    }
  }
  return migrated;
}

// Full bootstrap: schema + seed. Safe to call on every server start.
export async function initDb({ log = console.log, forceSeed = false } = {}) {
  await runSchema();
  const res = await seed({ force: forceSeed });
  const migrated = await migratePasswords();
  if (migrated > 0) log(`  DB: ${migrated} şifrə bcrypt hash-ə çevrildi.`);
  log(res.seeded ? '  DB: ilkin məlumatlar (seed) yazıldı.' : '  DB: məlumat mövcuddur, seed keçildi.');
  try {
    const ips = await seedInvestmentProjects();
    if (ips.seeded) log(`  DB: ${ips.count} demo investisiya layihəsi yazıldı.`);
  } catch (e) {
    console.error('  DB: investisiya layihəsi seed xətası:', e.message);
  }
  return res;
}

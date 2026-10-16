import { query } from './pool.js';
import { v4 as uuid } from 'uuid';
import { NEXT_ACTIONS } from '../data/constants.js';
import { hashPassword, isHashed } from '../utils/password.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);

/* ----------------------------- users ----------------------------- */

function rowToUser(r) {
  return {
    id: r.id,
    voen: r.voen,
    name: r.name,
    company: r.company,
    role: r.role,
    userType: r.user_type || 'sahibkar',
    password: r.password,
    email: r.email,
    phone: r.phone,
    status: r.status || 'active',
    createdAt: iso(r.created_at)
  };
}

export async function getUsers() {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at');
  return rows.map(rowToUser);
}

export async function listUsers({ status, role } = {}) {
  const where = [];
  const params = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  const sql = `SELECT * FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  const { rows } = await query(sql, params);
  return rows.map(rowToUser);
}

export async function findUserByVoen(voen) {
  const { rows } = await query('SELECT * FROM users WHERE voen = $1 LIMIT 1', [voen]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

// Hashes plaintext passwords on insert; existing hashes are kept as-is.
export async function insertUser(u) {
  const password = isHashed(u.password) ? u.password : hashPassword(u.password);
  await query(
    `INSERT INTO users (id, voen, name, company, role, password, email, phone, status, user_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (voen) DO NOTHING`,
    [
      u.id, u.voen, u.name, u.company, u.role, password,
      u.email || null, u.phone || null, u.status || 'active', u.userType || 'sahibkar'
    ]
  );
  return { ...u, password, userType: u.userType || 'sahibkar', status: u.status || 'active' };
}

export async function updateUserStatus(id, status) {
  await query('UPDATE users SET status = $2 WHERE id = $1', [id, status]);
}

export async function updateUserPassword(id, password) {
  const hash = isHashed(password) ? password : hashPassword(password);
  await query('UPDATE users SET password = $2 WHERE id = $1', [id, hash]);
}

/* ----------------------------- lands ----------------------------- */

function rowToLand(r) {
  return {
    id: r.id,
    code: r.code,
    district: r.district,
    districtName: r.district_name,
    purpose: r.purpose,
    purposeLabel: r.purpose_label,
    color: r.color,
    areaHa: r.area_ha != null ? Number(r.area_ha) : null,
    ph: r.ph != null ? Number(r.ph) : null,
    fertility: r.fertility,
    waterKm: r.water_km != null ? Number(r.water_km) : null,
    sunDays: r.sun_days,
    relief: r.relief || null,
    status: r.status,
    cadence: r.cadence,
    geometry: r.geometry
  };
}

export async function listLands({ district, purpose, status } = {}) {
  const where = [];
  const params = [];
  if (district) {
    params.push(district);
    where.push(`district = $${params.length}`);
  }
  if (purpose) {
    params.push(purpose);
    where.push(`purpose = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const sql = `SELECT * FROM lands ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at`;
  const { rows } = await query(sql, params);
  return rows.map(rowToLand);
}

export async function getLand(idOrCode) {
  const { rows } = await query('SELECT * FROM lands WHERE id::text = $1 OR code = $1 LIMIT 1', [idOrCode]);
  return rows[0] ? rowToLand(rows[0]) : null;
}

export async function insertLand(l) {
  await query(
    `INSERT INTO lands
       (id, code, district, district_name, purpose, purpose_label, color,
         area_ha, ph, fertility, water_km, sun_days, status, cadence, geometry, relief)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (code) DO NOTHING`,
    [
      l.id, l.code, l.district, l.districtName, l.purpose, l.purposeLabel, l.color,
      l.areaHa, l.ph, l.fertility, l.waterKm, l.sunDays, l.status || 'available',
       l.cadence, JSON.stringify(l.geometry), l.relief || null
    ]
  );
  return l;
}

export async function updateLand(idOrCode, l) {
  await query(
    `UPDATE lands SET
       code = $2, district = $3, district_name = $4, purpose = $5, purpose_label = $6,
       color = $7, area_ha = $8, ph = $9, fertility = $10, water_km = $11, sun_days = $12, status = $13
     WHERE id::text = $1 OR code = $1`,
    [
      idOrCode, l.code, l.district, l.districtName, l.purpose, l.purposeLabel, l.color,
      l.areaHa, l.ph, l.fertility, l.waterKm, l.sunDays, l.status
    ]
  );
}

export async function setLandStatus(idOrCode, status) {
  await query('UPDATE lands SET status = $2 WHERE id::text = $1 OR code = $1', [idOrCode, status]);
}

// Align a land's designated purpose with the project proposed on it.
export async function setLandPurpose(idOrCode, purpose, purposeLabel) {
  await query(
    'UPDATE lands SET purpose = $2, purpose_label = $3 WHERE id::text = $1 OR code = $1',
    [idOrCode, purpose, purposeLabel]
  );
}

export async function findLandsByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(`SELECT * FROM lands WHERE id::text IN (${placeholders})`, ids);
  return rows.map(rowToLand);
}

/* -------------------------- competitions ------------------------- */

function rowToCompetition(r) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    short: r.short,
    description: r.description,
    status: r.status,
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    totalBudget: r.total_budget != null ? Number(r.total_budget) : null,
    currency: r.currency,
    categories: r.categories || [],
    incentives: r.incentives || [],
    eligibility: r.eligibility || [],
    stages: r.stages || [],
    currentStage: r.current_stage != null ? Number(r.current_stage) : null
  };
}

export async function listCompetitions() {
  const { rows } = await query('SELECT * FROM competitions ORDER BY start_date');
  return rows.map(rowToCompetition);
}

export async function getCompetition(idOrCode) {
  const { rows } = await query('SELECT * FROM competitions WHERE id::text = $1 OR code = $1 LIMIT 1', [idOrCode]);
  return rows[0] ? rowToCompetition(rows[0]) : null;
}

export async function activeCompetition() {
  const { rows } = await query("SELECT * FROM competitions WHERE status = 'active' ORDER BY start_date LIMIT 1");
  if (rows[0]) return rowToCompetition(rows[0]);
  const { rows: all } = await query('SELECT * FROM competitions ORDER BY start_date LIMIT 1');
  return all[0] ? rowToCompetition(all[0]) : null;
}

export async function insertCompetition(c) {
  await query(
    `INSERT INTO competitions
       (id, code, title, short, description, status, start_date, end_date,
        total_budget, currency, categories, incentives, eligibility, stages, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (code) DO NOTHING`,
    [
      c.id, c.code, c.title, c.short, c.description, c.status, c.startDate, c.endDate,
      c.totalBudget, c.currency || 'AZN', c.categories || [], c.incentives || [],
      c.eligibility || [], c.stages || [], c.currentStage ?? null
    ]
  );
  return c;
}

export async function updateCompetition(id, c) {
  await query(
    `UPDATE competitions SET
       code = $2, title = $3, short = $4, description = $5, status = $6,
       start_date = $7, end_date = $8, total_budget = $9, currency = $10,
       categories = $11, incentives = $12, eligibility = $13, stages = $14,
       current_stage = $15
     WHERE id::text = $1 OR code = $1`,
    [
      id, c.code, c.title, c.short, c.description, c.status,
      c.startDate || null, c.endDate || null, c.totalBudget ?? null, c.currency || 'AZN',
      c.categories || [], c.incentives || [], c.eligibility || [], c.stages || [],
      c.currentStage ?? null
    ]
  );
}

export async function setCompetitionStatus(id, status) {
  await query('UPDATE competitions SET status = $2 WHERE id::text = $1 OR code = $1', [id, status]);
}

export async function setCompetitionStage(id, stage) {
  await query('UPDATE competitions SET current_stage = $2 WHERE id::text = $1 OR code = $1', [id, stage]);
}

export async function countApplicationsByCompetition(id) {
  const { rows } = await query('SELECT COUNT(*)::int AS c FROM applications WHERE competition_id = $1', [id]);
  return rows[0].c;
}

/* -------------------------- applications ------------------------- */

function rowToApplication(r) {
  return {
    id: r.id,
    trackingCode: r.tracking_code,
    voen: r.voen,
    applicantName: r.applicant_name,
    company: r.company,
    landId: r.land_id,
    landCode: r.land_code,
    district: r.district,
    districtName: r.district_name,
    purpose: r.purpose,
    purposeLabel: r.purpose_label,
    areaHa: r.area_ha != null ? Number(r.area_ha) : null,
    investmentAmount: r.investment_amount != null ? Number(r.investment_amount) : null,
    businessPlan: r.business_plan,
    technologies: r.technologies || [],
    valueChain: r.value_chain || [],
    arableAreaHa: r.arable_area_ha != null ? Number(r.arable_area_ha) : null,
    permanentJobs: r.permanent_jobs != null ? Number(r.permanent_jobs) : null,
    seasonalJobs: r.seasonal_jobs != null ? Number(r.seasonal_jobs) : null,
    annualOutputTons: r.annual_output_tons != null ? Number(r.annual_output_tons) : null,
    files: r.files || [],
    roi: r.roi || null,
    score: r.score || null,
    competitionId: r.competition_id,
    competitionTitle: r.competition_title,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    timeline: r.timeline || [],
    nextActions: NEXT_ACTIONS[r.status] || []
  };
}

export async function listApplications({ voen } = {}) {
  const sql = voen
    ? 'SELECT * FROM applications WHERE voen = $1 ORDER BY created_at DESC'
    : 'SELECT * FROM applications ORDER BY created_at DESC';
  const { rows } = await query(sql, voen ? [voen] : []);
  return rows.map(rowToApplication);
}

export async function countApplications() {
  const { rows } = await query('SELECT COUNT(*)::int AS c FROM applications');
  return rows[0].c;
}

export async function findApplication(idOrCode) {
  const { rows } = await query(
    'SELECT * FROM applications WHERE id::text = $1 OR upper(tracking_code) = upper($1) LIMIT 1',
    [idOrCode]
  );
  return rows[0] ? rowToApplication(rows[0]) : null;
}

export async function findApplicationByCode(code) {
  const { rows } = await query('SELECT * FROM applications WHERE upper(tracking_code) = upper($1) LIMIT 1', [code]);
  return rows[0] ? rowToApplication(rows[0]) : null;
}

export async function insertApplication(a) {
  await query(
    `INSERT INTO applications
       (id, tracking_code, voen, applicant_name, company, land_id, land_code, district, district_name,
        purpose, purpose_label, area_ha, investment_amount, business_plan, files, roi, score,
        competition_id, competition_title, status, created_at, updated_at, timeline,
        technologies, value_chain, arable_area_ha, permanent_jobs, seasonal_jobs, annual_output_tons)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
             $24,$25,$26,$27,$28,$29)`,
    [
      a.id, a.trackingCode, a.voen, a.applicantName, a.company, a.landId, a.landCode, a.district,
      a.districtName, a.purpose, a.purposeLabel, a.areaHa, a.investmentAmount, a.businessPlan,
      JSON.stringify(a.files || []), a.roi ? JSON.stringify(a.roi) : null,
      a.score ? JSON.stringify(a.score) : null, a.competitionId, a.competitionTitle,
      a.status, a.createdAt, a.updatedAt, JSON.stringify(a.timeline || []),
      a.technologies || [], a.valueChain || [],
      a.arableAreaHa ?? null, a.permanentJobs ?? null, a.seasonalJobs ?? null, a.annualOutputTons ?? null
    ]
  );
  return a;
}

export async function updateApplication(id, { status, updatedAt, timeline }) {
  await query(
    'UPDATE applications SET status = $2, updated_at = $3, timeline = $4 WHERE id = $1',
    [id, status, updatedAt, JSON.stringify(timeline || [])]
  );
}

/* ------------------------- notifications ------------------------- */

function rowToNotification(r) {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    applicationId: r.application_id,
    read: r.is_read,
    createdAt: iso(r.created_at)
  };
}

export async function insertNotification(n) {
  await query(
    `INSERT INTO notifications (id, user_id, type, title, body, link, application_id, is_read, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      n.id, n.userId, n.type || 'info', n.title, n.body || null, n.link || null,
      n.applicationId || null, n.read || false, n.createdAt || new Date().toISOString()
    ]
  );
  return n;
}

export async function listNotifications(userId) {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows.map(rowToNotification);
}

export async function countUnreadNotifications(userId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return rows[0].c;
}

export async function markNotificationRead(id, userId) {
  await query('UPDATE notifications SET is_read = true WHERE id::text = $1 AND user_id = $2', [id, userId]);
}

export async function markAllNotificationsRead(userId) {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [userId]);
}

function rowToProject(r) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerVoen: r.owner_voen,
    ownerName: r.owner_name,
    ownerType: r.owner_type,
    landId: r.land_id,
    landCode: r.land_code,
    district: r.district,
    districtName: r.district_name,
    purpose: r.purpose,
    purposeLabel: r.purpose_label,
    title: r.title,
    description: r.description,
    totalBudget: r.total_budget != null ? Number(r.total_budget) : null,
    selfFunded: r.self_funded != null ? Number(r.self_funded) : null,
    requiredInvestment: r.required_investment != null ? Number(r.required_investment) : null,
    raisedInvestment: r.raised_investment != null ? Number(r.raised_investment) : 0,
    equityOffered: r.equity_offered != null ? Number(r.equity_offered) : null,
    profitShare: r.profit_share != null ? Number(r.profit_share) : null,
    fixedYield: r.fixed_yield != null ? Number(r.fixed_yield) : null,
    model: r.model,
    milestones: r.milestones || [],
    timelineMonths: r.timeline_months,
    status: r.status,
    riskScore: r.risk_score != null ? Number(r.risk_score) : null,
    ndviScore: r.ndvi_score != null ? Number(r.ndvi_score) : null,
    ndviHealth: r.ndvi_health || null,
    relief: r.relief || null,
    areaHa: r.area_ha != null ? Number(r.area_ha) : null,
    ownerNote: r.owner_note || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
  };
}

function rowToOffer(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    investorId: r.investor_id,
    investorVoen: r.investor_voen,
    investorName: r.investor_name,
    amount: r.amount != null ? Number(r.amount) : null,
    model: r.model,
    terms: r.terms,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
  };
}

export async function listInvestmentProjects({ district, purpose, status, minCompletion } = {}) {
  const where = [];
  const params = [];
  if (district) { params.push(district); where.push(`district = $${params.length}`); }
  if (purpose) { params.push(purpose); where.push(`purpose = $${params.length}`); }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  const sql = `SELECT * FROM investment_projects ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  const { rows } = await query(sql, params);
  return rows.map(rowToProject);
}

export async function getInvestmentProject(id) {
  const { rows } = await query('SELECT * FROM investment_projects WHERE id::text = $1 LIMIT 1', [id]);
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function insertInvestmentProject(p) {
  const id = p.id || uuid();
  await query(
    `INSERT INTO investment_projects (
      id, owner_id, owner_voen, owner_name, owner_type, land_id, land_code, district, district_name, purpose, purpose_label,
      title, description, total_budget, self_funded, required_investment, raised_investment,
      equity_offered, profit_share, fixed_yield, model, milestones, timeline_months, status,
      risk_score, ndvi_score, ndvi_health, owner_note, relief, area_ha
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,$23,$24,
$25,$26,$27,$28,$29,$30
    )`,
    [
      id, p.ownerId || null, p.ownerVoen || null, p.ownerName || null, p.ownerType || 'dovlet',
      p.landId || null, p.landCode || null, p.district || null, p.districtName || null, p.purpose || null, p.purposeLabel || null,
      p.title, p.description || null,
      p.totalBudget ?? 0, p.selfFunded ?? 0, p.requiredInvestment ?? 0, p.raisedInvestment ?? 0,
      p.equityOffered ?? null, p.profitShare ?? null, p.fixedYield ?? null, p.model || 'equity',
      JSON.stringify(p.milestones || []), p.timelineMonths ?? null, p.status || 'open',
      p.riskScore ?? null, p.ndviScore ?? null, p.ndviHealth ?? null,
       p.ownerNote ?? null,
       p.relief ?? null,
       p.areaHa ?? null
    ]
  );
  return getInvestmentProject(id);
}

export async function updateInvestmentProject(id, p) {
  const sets = [];
  const params = [];
  const push = (col, val) => { sets.push(`${col} = $${params.length + 1}`); params.push(val); };
  if (p.title !== undefined) push('title', p.title);
  if (p.description !== undefined) push('description', p.description);
  if (p.totalBudget !== undefined) push('total_budget', p.totalBudget);
  if (p.selfFunded !== undefined) push('self_funded', p.selfFunded);
  if (p.requiredInvestment !== undefined) push('required_investment', p.requiredInvestment);
  if (p.raisedInvestment !== undefined) push('raised_investment', p.raisedInvestment);
  if (p.equityOffered !== undefined) push('equity_offered', p.equityOffered);
  if (p.profitShare !== undefined) push('profit_share', p.profitShare);
  if (p.fixedYield !== undefined) push('fixed_yield', p.fixedYield);
  if (p.model !== undefined) push('model', p.model);
  if (p.milestones !== undefined) push('milestones', JSON.stringify(p.milestones));
  if (p.status !== undefined) push('status', p.status);
  if (p.riskScore !== undefined) push('risk_score', p.riskScore);
  if (p.ndviScore !== undefined) push('ndvi_score', p.ndviScore);
  if (p.ndviHealth !== undefined) push('ndvi_health', p.ndviHealth);
  if (p.ownerNote !== undefined) push('owner_note', p.ownerNote);
  if (sets.length === 0) return getInvestmentProject(id);
  params.push(id);
  await query(`UPDATE investment_projects SET ${sets.join(', ')}, updated_at = now() WHERE id::text = $${params.length}`, params);
  return getInvestmentProject(id);
}

export async function listOffersByProject(projectId) {
  const { rows } = await query('SELECT * FROM investment_proposals WHERE project_id::text = $1 ORDER BY created_at DESC', [projectId]);
  return rows.map(rowToOffer);
}

export async function getOffer(id) {
  const { rows } = await query('SELECT * FROM investment_proposals WHERE id::text = $1 LIMIT 1', [id]);
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export async function insertOffer(o) {
  const id = o.id || uuid();
  await query(
    `INSERT INTO investment_proposals (id, project_id, investor_id, investor_voen, investor_name, amount, model, terms, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, o.projectId, o.investorId || null, o.investorVoen || null, o.investorName || null, o.amount, o.model || 'equity', o.terms || null, o.status || 'pending']
  );
  return getOffer(id);
}

export async function listOffersByInvestor(investorId) {
  const { rows } = await query('SELECT * FROM investment_proposals WHERE investor_id::text = $1 ORDER BY created_at DESC', [investorId]);
  return rows.map(rowToOffer);
}

export async function updateOfferStatus(id, status, terms) {
  if (terms !== undefined) {
    await query('UPDATE investment_proposals SET status = $2, terms = $3, updated_at = now() WHERE id::text = $1', [id, status, terms]);
  } else {
    await query('UPDATE investment_proposals SET status = $2, updated_at = now() WHERE id::text = $1', [id, status]);
  }
  return getOffer(id);
}

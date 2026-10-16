import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  listCompetitions,
  activeCompetition,
  findCompetition,
  insertCompetition,
  updateCompetition,
  setCompetitionStatus,
  setCompetitionStage,
  countApplicationsByCompetition
} from '../data/store.js';
import { CROPS } from '../data/seed.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const ALLOWED_STATUS = ['upcoming', 'active', 'closed'];

async function withMeta(c) {
  return {
    ...c,
    applicationsCount: await countApplicationsByCompetition(c.id),
    daysLeft: Math.max(0, Math.ceil((new Date(c.endDate) - Date.now()) / 86400000))
  };
}

// Validate + merge a competition payload against an existing record (or defaults).
// Returns { ok, value, error }.
function normalize(body, existing = {}) {
  const b = body || {};
  const pick = (key, fallback) => (b[key] === undefined ? fallback : b[key]);

  const title = String(pick('title', existing.title || '')).trim();
  if (!title) return { ok: false, error: 'Başlıq (title) tələb olunur' };

  const toIso = (v) => {
    if (v === null || v === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const startDate = toIso(pick('startDate', existing.startDate ?? null));
  if (startDate === undefined) return { ok: false, error: 'startDate düzgün tarix deyil' };
  const endDate = toIso(pick('endDate', existing.endDate ?? null));
  if (endDate === undefined) return { ok: false, error: 'endDate düzgün tarix deyil' };
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return { ok: false, error: 'Bitmə tarixi başlama tarixindən sonra olmalıdır' };
  }

  const status = pick('status', existing.status || 'upcoming');
  if (!ALLOWED_STATUS.includes(status)) {
    return { ok: false, error: `Status yalnız ${ALLOWED_STATUS.join(', ')} ola bilər` };
  }

  const totalBudgetRaw = pick('totalBudget', existing.totalBudget ?? null);
  const totalBudget = totalBudgetRaw === null || totalBudgetRaw === '' ? null : Number(totalBudgetRaw);
  if (totalBudget !== null && (!Number.isFinite(totalBudget) || totalBudget < 0)) {
    return { ok: false, error: 'Büdcə mənfi ola bilməz' };
  }

  const asArray = (v, fallback) => {
    if (v === undefined) return fallback || [];
    if (!Array.isArray(v)) return null;
    return v.map((x) => String(x)).filter((x) => x.trim() !== '');
  };

  const categories = asArray(pick('categories', undefined), existing.categories);
  if (categories === null) return { ok: false, error: 'categories massiv olmalıdır' };
  const badCat = categories.find((k) => !CROPS[k]);
  if (badCat) return { ok: false, error: `Naməlum kateqoriya: ${badCat}` };

  const incentives = asArray(pick('incentives', undefined), existing.incentives);
  const eligibility = asArray(pick('eligibility', undefined), existing.eligibility);
  const stages = asArray(pick('stages', undefined), existing.stages);
  if (incentives === null || eligibility === null || stages === null) {
    return { ok: false, error: 'incentives, eligibility və stages massiv olmalıdır' };
  }

  const csRaw = pick('currentStage', existing.currentStage ?? null);
  let currentStage = null;
  if (csRaw !== null && csRaw !== '' && csRaw !== undefined) {
    const n = Number(csRaw);
    if (!Number.isInteger(n) || n < 0 || n >= stages.length) {
      return { ok: false, error: `currentStage 0 ilə ${Math.max(0, stages.length - 1)} aralığında tam ədəd olmalıdır` };
    }
    currentStage = n;
  }

  return {
    ok: true,
    value: {
      code: String(pick('code', existing.code || '') || '').trim() || undefined,
      title,
      short: String(pick('short', existing.short || '')).trim(),
      description: String(pick('description', existing.description || '')).trim(),
      status,
      startDate,
      endDate,
      totalBudget,
      currency: String(pick('currency', existing.currency || 'AZN')).trim() || 'AZN',
      categories,
      incentives,
      eligibility,
      stages,
      currentStage
    }
  };
}

async function makeCode() {
  const year = new Date().getFullYear();
  const all = await listCompetitions();
  return `MUS-${year}-${String(all.length + 1).padStart(3, '0')}`;
}

router.get('/', async (_req, res) => {
  const comps = await listCompetitions();
  res.json(await Promise.all(comps.map(withMeta)));
});

router.get('/active', async (_req, res) => {
  const c = await activeCompetition();
  if (!c) return res.status(404).json({ error: 'Aktiv müsabiqə yoxdur' });
  res.json(await withMeta(c));
});

// Create a competition (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const { ok, value, error } = normalize(req.body);
  if (!ok) return res.status(400).json({ error });

  const comp = {
    id: uuid(),
    code: value.code || (await makeCode()),
    title: value.title,
    short: value.short,
    description: value.description,
    status: value.status,
    startDate: value.startDate,
    endDate: value.endDate,
    totalBudget: value.totalBudget,
    currency: value.currency,
    categories: value.categories,
    incentives: value.incentives,
    eligibility: value.eligibility,
    stages: value.stages,
    currentStage: value.currentStage
  };
  await insertCompetition(comp);
  const saved = await findCompetition(comp.id);
  res.status(201).json(await withMeta(saved || comp));
});

// Full update (admin only)
router.put('/:id', requireRole('admin'), async (req, res) => {
  const existing = await findCompetition(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Müsabiqə tapılmadı' });

  const { ok, value, error } = normalize(req.body, existing);
  if (!ok) return res.status(400).json({ error });

  await updateCompetition(existing.id, { ...value, code: value.code || existing.code });
  const saved = await findCompetition(existing.id);
  res.json(await withMeta(saved));
});

// Approval mechanic: upcoming -> active -> closed (operator/admin)
router.patch('/:id/status', requireRole('operator', 'admin'), async (req, res) => {
  const existing = await findCompetition(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Müsabiqə tapılmadı' });

  const { status } = req.body || {};
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: `Status yalnız ${ALLOWED_STATUS.join(', ')} ola bilər` });
  }
  await setCompetitionStatus(existing.id, status);
  const saved = await findCompetition(existing.id);
  res.json(await withMeta(saved));
});

// Manually set the current stage of the competition progress (operator/admin)
router.patch('/:id/stage', requireRole('operator', 'admin'), async (req, res) => {
  const existing = await findCompetition(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Müsabiqə tapılmadı' });

  const raw = (req.body || {}).currentStage;
  let stage = null;
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= existing.stages.length) {
      return res.status(400).json({ error: `currentStage 0 ilə ${Math.max(0, existing.stages.length - 1)} aralığında tam ədəd olmalıdır` });
    }
    stage = n;
  }
  await setCompetitionStage(existing.id, stage);
  const saved = await findCompetition(existing.id);
  res.json(await withMeta(saved));
});

router.get('/:id', async (req, res) => {
  const c = await findCompetition(req.params.id);
  if (!c) return res.status(404).json({ error: 'Müsabiqə tapılmadı' });
  res.json(await withMeta(c));
});

export default router;

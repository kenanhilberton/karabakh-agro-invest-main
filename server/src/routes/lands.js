import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { listLands, findLand, insertLand, updateLand, countApplications, findLandsByIds } from '../data/store.js';
import { DISTRICTS, CROPS } from '../data/seed.js';
import { requireRole } from '../middleware/auth.js';
import { calculateLandScore } from '../utils/landScore.js';

const router = Router();

// Metadata used by the frontend filters / legends
router.get('/meta', (_req, res) => {
  res.json({
    districts: Object.entries(DISTRICTS).map(([key, v]) => ({ key, name: v.name, center: v.center })),
    crops: Object.entries(CROPS).map(([key, v]) => ({ key, label: v.label, color: v.color })),
    statuses: [
      { key: 'available', label: 'Mövcuddur' },
      { key: 'reserved', label: 'Rezerv edilib' },
      { key: 'allocated', label: 'Ayrılıb' }
    ]
  });
});

router.get('/stats', async (_req, res) => {
  const lands = await listLands();
  const totalHa = lands.reduce((s, l) => s + l.areaHa, 0);
  const byDistrict = {};
  const byPurpose = {};
  for (const l of lands) {
    byDistrict[l.districtName] = (byDistrict[l.districtName] || 0) + l.areaHa;
    byPurpose[l.purposeLabel] = (byPurpose[l.purposeLabel] || 0) + l.areaHa;
  }
  res.json({
    totalPlots: lands.length,
    totalHa: Math.round(totalHa),
    availableHa: Math.round(lands.filter((l) => l.status === 'available').reduce((s, l) => s + l.areaHa, 0)),
    applications: await countApplications(),
    byDistrict,
    byPurpose
  });
});

router.get('/', async (req, res) => {
  const result = await listLands({
    district: req.query.district,
    purpose: req.query.purpose,
    status: req.query.status
  });
  res.json(result);
});

// Compare multiple lands by IDs (for comparison page)
router.get('/compare', async (req, res) => {
  const ids = req.query.ids?.split(',').filter(Boolean) || [];
  if (ids.length === 0 || ids.length > 5) {
    return res.status(400).json({ error: '1-5 arası ID tələb olunur' });
  }
  const lands = await findLandsByIds(ids);
  // Calculate scores for each land
  const scored = lands.map(land => {
    const { score, grade, breakdown } = calculateLandScore(land);
    return { ...land, score, grade, breakdown };
  });
  res.json(scored);
});

router.get('/:id', async (req, res) => {
  const land = await findLand(req.params.id);
  if (!land) return res.status(404).json({ error: 'Torpaq sahəsi tapılmadı' });
  res.json(land);
});

// Admin can add new plots
router.post('/', requireRole('admin'), async (req, res) => {
  const { district, purpose, areaHa, ph, fertility, waterKm, sunDays, code } = req.body || {};
  if (!DISTRICTS[district] || !CROPS[purpose] || !areaHa) {
    return res.status(400).json({ error: 'district, purpose və areaHa tələb olunur' });
  }
  const c = DISTRICTS[district].center;
  const land = {
    id: uuid(),
    code: code || `${district.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
    district,
    districtName: DISTRICTS[district].name,
    purpose,
    purposeLabel: CROPS[purpose].label,
    color: CROPS[purpose].color,
    areaHa: Number(areaHa),
    ph: ph ?? 7,
    fertility: fertility ?? 70,
    waterKm: waterKm ?? 2,
    sunDays: sunDays ?? 250,
    status: 'available',
    cadence: 'İllik',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [c[1] - 0.01, c[0] - 0.008],
        [c[1] + 0.01, c[0] - 0.008],
        [c[1] + 0.01, c[0] + 0.008],
        [c[1] - 0.01, c[0] + 0.008],
        [c[1] - 0.01, c[0] - 0.008]
      ]]
    }
  };
  await insertLand(land);
  res.status(201).json(land);
});

// Admin can edit existing plots
const LAND_STATUS = ['available', 'reserved', 'allocated'];
router.put('/:id', requireRole('admin'), async (req, res) => {
  const existing = await findLand(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Torpaq sahəsi tapılmadı' });

  const b = req.body || {};
  const pick = (k, fallback) => (b[k] === undefined ? fallback : b[k]);

  const district = String(pick('district', existing.district));
  const purpose = String(pick('purpose', existing.purpose));
  if (!DISTRICTS[district]) return res.status(400).json({ error: `Naməlum rayon: ${district}` });
  if (!CROPS[purpose]) return res.status(400).json({ error: `Naməlum təyinat: ${purpose}` });

  const areaHa = Number(pick('areaHa', existing.areaHa));
  if (!Number.isFinite(areaHa) || areaHa <= 0) {
    return res.status(400).json({ error: 'Sahə düzgün rəqəm olmalıdır (0-dan böyük)' });
  }

  const status = String(pick('status', existing.status));
  if (!LAND_STATUS.includes(status)) {
    return res.status(400).json({ error: `Status yalnız ${LAND_STATUS.join(', ')} ola bilər` });
  }

  const numOr = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const updated = {
    code: String(pick('code', existing.code) || existing.code).trim(),
    district,
    districtName: DISTRICTS[district].name,
    purpose,
    purposeLabel: CROPS[purpose].label,
    color: CROPS[purpose].color,
    areaHa,
    ph: numOr(pick('ph', undefined), existing.ph),
    fertility: numOr(pick('fertility', undefined), existing.fertility),
    waterKm: numOr(pick('waterKm', undefined), existing.waterKm),
    sunDays: numOr(pick('sunDays', undefined), existing.sunDays),
    status
  };

  await updateLand(existing.id, updated);
  res.json(await findLand(existing.id));
});

export default router;

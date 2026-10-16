import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  findLand,
  insertApplication,
  countApplications,
  findApplication,
  findApplicationByCode,
  listApplications,
  updateApplication,
  updateApplicationDocuments,
  setLandStatus,
  getUsers,
  findUserByVoen,
  insertNotification,
  APPLICATION_STAGES,
  NEXT_ACTIONS,
  TECH_KEYS,
  VALUE_CHAIN_KEYS,
  activeCompetition
} from '../data/store.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { simulateRoi } from '../utils/roi.js';
import { scoreApplication } from '../utils/score.js';

const router = Router();

function stageLabel(key) {
  return APPLICATION_STAGES.find((s) => s.key === key)?.label || key;
}

// Accepts an array of tags, keeps only values from the allowed catalog, de-dupes.
function pickTags(value, allowed) {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return [...new Set(value.filter((v) => typeof v === 'string' && set.has(v)))];
}

// Parses an optional non-negative number; returns null when empty/invalid-marked.
function parseNonNeg(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

async function notify(user, payload) {
  if (!user) return;
  try {
    await insertNotification({
      id: uuid(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      ...payload
    });
  } catch (e) {
    console.error('Bildiriş yaradıla bilmədi:', e.message);
  }
}

async function makeTrackingCode() {
  const year = new Date().getFullYear();
  const seq = String((await countApplications()) + 1).padStart(5, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAI-${year}-${seq}${rand}`;
}

// Publicly visible shape (no internal notes). Uploaded documents are only
// included for authenticated callers (`includeFiles`), never on the public
// QR tracking page. `canManage` tells the client whether the caller may attach
// additional documents (owner or staff).
function publicView(app, { includeFiles = false, canManage = false } = {}) {
  return {
    id: app.id,
    trackingCode: app.trackingCode,
    status: app.status,
    statusLabel: stageLabel(app.status),
    districtName: app.districtName,
    landCode: app.landCode,
    landId: app.landId,
    purposeLabel: app.purposeLabel,
    areaHa: app.areaHa,
    investmentAmount: app.investmentAmount,
    technologies: app.technologies || [],
    valueChain: app.valueChain || [],
    arableAreaHa: app.arableAreaHa ?? null,
    permanentJobs: app.permanentJobs ?? null,
    seasonalJobs: app.seasonalJobs ?? null,
    annualOutputTons: app.annualOutputTons ?? null,
    applicantName: app.applicantName,
    company: app.company,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    timeline: app.timeline,
    nextActions: app.nextActions,
    competitionId: app.competitionId,
    competitionTitle: app.competitionTitle,
    score: app.score || null,
    roi: app.roi || null,
    ...(includeFiles ? { files: app.files || [] } : {}),
    canManage,
    trackUrl: `/track/${app.trackingCode}`
  };
}

router.get('/', optionalAuth, requireAuth, async (req, res) => {
  const list = await listApplications(req.user.role === 'applicant' ? { voen: req.user.voen } : {});
  res.json(list.map((a) => publicView(a, { includeFiles: true })));
});

// Public tracking endpoint used by the QR tracker page. When the caller is the
// applicant (or staff) the uploaded documents are returned as well.
router.get('/track/:code', optionalAuth, async (req, res) => {
  const app = await findApplicationByCode(req.params.code);
  if (!app) return res.status(404).json({ error: 'Bu kodla müraciət tapılmadı' });
  const staff = !!req.user && (req.user.role === 'operator' || req.user.role === 'admin');
  const owner = !!req.user && app.voen === req.user.voen;
  const canManage = staff || owner;
  res.json(publicView(app, { includeFiles: canManage, canManage }));
});

// The applicant (or staff) attaches additional documents to an application that
// is still open — this is the "Əlavə sənəd tələb olunur" stage follow-up.
router.post('/track/:code/documents', requireAuth, async (req, res) => {
  const app = await findApplicationByCode(req.params.code);
  if (!app) return res.status(404).json({ error: 'Müraciət tapılmadı' });

  const staff = req.user.role === 'operator' || req.user.role === 'admin';
  if (!staff && app.voen !== req.user.voen) {
    return res.status(403).json({ error: 'Bu müraciətə giriş icazəniz yoxdur' });
  }
  if (app.status === 'approved' || app.status === 'rejected') {
    return res.status(409).json({ error: 'Yekunlaşmış müraciətə sənəd əlavə etmək mümkün deyil' });
  }

  const now = new Date().toISOString();
  const incoming = Array.isArray(req.body?.files) ? req.body.files : [];
  // The files are uploaded beforehand via POST /upload; here we only accept the
  // resulting metadata so we never trust a raw path from the client body.
  const added = incoming
    .filter((f) => f && typeof f === 'object' && (f.url || f.path))
    .map((f) => {
      const url = String(f.url || f.path);
      return {
        id: String(f.id || url),
        originalName: String(f.originalName || f.name || 'sənəd'),
        mime: f.mime || '',
        size: Number(f.size) || 0,
        url,
        path: String(f.path || url),
        uploadedAt: f.uploadedAt || now
      };
    });
  if (!added.length) {
    return res.status(400).json({ error: 'Heç bir sənəd göndərilmədi' });
  }

  const files = [...(app.files || []), ...added];
  const timeline = [
    ...(app.timeline || []),
    {
      status: app.status,
      label: stageLabel(app.status),
      at: now,
      note: `${added.length} əlavə sənəd yükləndi`
    }
  ];

  const updated = { ...app, files, timeline, updatedAt: now };
  await updateApplicationDocuments(app.id, updated);

  const staffUsers = (await getUsers()).filter((u) => u.role === 'operator' || u.role === 'admin');
  await Promise.all(
    staffUsers.map((u) =>
      notify(u, {
        type: 'documents_added',
        title: 'Müraciətə əlavə sənəd yükləndi',
        body: `${app.applicantName} — ${app.districtName} · ${app.trackingCode}`,
        link: '/admin',
        applicationId: app.id
      })
    )
  );

  res.json(publicView(updated, { includeFiles: true, canManage: true }));
});

router.get('/:id', requireAuth, async (req, res) => {
  const app = await findApplication(req.params.id);
  if (!app) return res.status(404).json({ error: 'Müraciət tapılmadı' });
  if (req.user.role === 'applicant' && app.voen !== req.user.voen) {
    return res.status(403).json({ error: 'Bu müraciətə giriş icazəniz yoxdur' });
  }
  res.json(app);
});

// Create a new application (end-to-end wizard submits here)
router.post('/', requireAuth, requireRole('applicant', 'admin'), async (req, res) => {
  const {
    landId, purpose, areaHa, businessPlan, investmentAmount, company, files,
    technologies, valueChain, arableAreaHa, permanentJobs, seasonalJobs, annualOutputTons
  } = req.body || {};
  const land = await findLand(landId);
  if (!land) return res.status(400).json({ error: 'Seçilmiş torpaq sahəsi tapılmadı' });
  if (land.status !== 'available') {
    return res.status(409).json({ error: 'Bu torpaq sahəsi artıq ayrılıb və ya rezerv edilib' });
  }

  const requestedArea = areaHa === undefined || areaHa === null || areaHa === '' ? land.areaHa : Number(areaHa);
  if (!Number.isFinite(requestedArea) || requestedArea <= 0) {
    return res.status(400).json({ error: 'Sahə düzgün rəqəm olmalıdır (0-dan böyük)' });
  }
  if (requestedArea > land.areaHa) {
    return res.status(400).json({ error: `Sahə seçilmiş torpaqdan (${land.areaHa} ha) böyük ola bilməz` });
  }

  const parsedInvestment = investmentAmount === undefined || investmentAmount === null || investmentAmount === '' ? null : Number(investmentAmount);
  if (parsedInvestment !== null && (!Number.isFinite(parsedInvestment) || parsedInvestment < 0)) {
    return res.status(400).json({ error: 'İnvestisiya həcmi mənfi ola bilməz' });
  }

  const metrics = {
    arableAreaHa: parseNonNeg(arableAreaHa),
    permanentJobs: parseNonNeg(permanentJobs),
    seasonalJobs: parseNonNeg(seasonalJobs),
    annualOutputTons: parseNonNeg(annualOutputTons)
  };
  if (Object.values(metrics).some((v) => Number.isNaN(v))) {
    return res.status(400).json({ error: 'Göstəricilər (sahə, iş yerləri, həcm) mənfi ola bilməz' });
  }
  const techTags = pickTags(technologies, TECH_KEYS);
  const chainTags = pickTags(valueChain, VALUE_CHAIN_KEYS);

  const roi = simulateRoi({ purpose: purpose || land.purpose, areaHa: requestedArea });
  const now = new Date().toISOString();
  const code = await makeTrackingCode();
  const comp = await activeCompetition();
  const finalInvestment = parsedInvestment ?? (roi ? roi.capex : 0);
  const score = scoreApplication({
    investmentAmount: finalInvestment,
    areaHa: requestedArea,
    fertility: land.fertility,
    paybackYears: roi?.paybackYears || 4
  });

  const app = {
    id: uuid(),
    trackingCode: code,
    voen: req.user.voen,
    applicantName: req.user.name,
    company: company || req.user.company || '',
    landId: land.id,
    landCode: land.code,
    district: land.district,
    districtName: land.districtName,
    purpose: purpose || land.purpose,
    purposeLabel: land.purposeLabel,
    areaHa: requestedArea,
    investmentAmount: finalInvestment,
    businessPlan: businessPlan || '',
    technologies: techTags,
    valueChain: chainTags,
    arableAreaHa: metrics.arableAreaHa,
    permanentJobs: metrics.permanentJobs,
    seasonalJobs: metrics.seasonalJobs,
    annualOutputTons: metrics.annualOutputTons,
    files: Array.isArray(files) ? files : [],
    roi,
    score,
    competitionId: comp?.id || null,
    competitionTitle: comp?.title || null,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
    timeline: [
      { status: 'submitted', label: stageLabel('submitted'), at: now, note: 'Müraciət sistemə qeydə alındı' }
    ],
    nextActions: NEXT_ACTIONS.submitted
  };

  await insertApplication(app);
  await setLandStatus(land.id, 'reserved');

  // Notify operators/admins about the new application
  const staff = (await getUsers()).filter((u) => u.role === 'operator' || u.role === 'admin');
  await Promise.all(
    staff.map((u) =>
      notify(u, {
        type: 'application_new',
        title: 'Yeni müraciət daxil oldu',
        body: `${app.applicantName} — ${app.districtName} · ${app.trackingCode}`,
        link: '/admin',
        applicationId: app.id
      })
    )
  );

  res.status(201).json(publicView(app));
});

// Operator / admin changes the stage
router.patch('/:id/status', requireAuth, requireRole('operator', 'admin'), async (req, res) => {
  const app = await findApplication(req.params.id);
  if (!app) return res.status(404).json({ error: 'Müraciət tapılmadı' });

  const { status, note } = req.body || {};
  if (!APPLICATION_STAGES.some((s) => s.key === status)) {
    return res.status(400).json({ error: 'Yanlış status' });
  }
  const now = new Date().toISOString();
  const timeline = [...app.timeline, { status, label: stageLabel(status), at: now, note: note || '' }];
  const nextActions = NEXT_ACTIONS[status] || app.nextActions;

  await updateApplication(app.id, { status, updatedAt: now, timeline, nextActions });
  app.status = status;
  app.updatedAt = now;
  app.timeline = timeline;
  app.nextActions = nextActions;

  // Notify the applicant about the status change
  const applicant = await findUserByVoen(app.voen);
  await notify(applicant, {
    type: 'status_changed',
    title: `Müraciətinizin statusu: ${stageLabel(status)}`,
    body: `${app.trackingCode} · ${app.districtName}${note ? ` · ${note}` : ''}`,
    link: `/track/${app.trackingCode}`,
    applicationId: app.id
  });

  // Keep the land state in sync with the decision
  if (app.landId) {
    if (status === 'approved') await setLandStatus(app.landId, 'allocated');
    else if (status === 'rejected') await setLandStatus(app.landId, 'available');
    else await setLandStatus(app.landId, 'reserved');
  }
  res.json(publicView(app));
});

export default router;

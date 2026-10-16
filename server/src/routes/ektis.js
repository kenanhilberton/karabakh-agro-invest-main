import { Router } from 'express';
import { listLands, findLand, findUserByVoen, findApplication } from '../data/store.js';
import { findTaxpayer } from '../data/ektisRegistry.js';
import { currentNdvi } from '../utils/score.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Simulated integration layer with EKTIS (central government e-services portal).
// These endpoints mimic how the portal would exchange data with the state system.

// 1) Pull cadastral / land registry data from EKTIS
router.get('/lands', async (req, res) => {
  const district = req.query.district;
  const lands = await listLands(district ? { district } : {});
  const items = lands.map((l) => ({
    kadastrNo: `AZ-${l.district.toUpperCase().slice(0, 3)}-${l.code}`,
    saheHa: l.areaHa,
    rayon: l.districtName,
    teyinat: l.purposeLabel,
    münbitlikIndeksi: l.fertility,
    ph: l.ph,
    status: l.status,
    source: 'EKTİS://cadastre/v2'
  }));
  res.json({ source: 'EKTİS', syncedAt: new Date().toISOString(), count: items.length, items });
});

// 2) Push an approved application into the central system
router.post('/applications/sync', requireAuth, async (req, res) => {
  const { applicationId } = req.body || {};
  const app = await findApplication(applicationId);
  if (!app) return res.status(404).json({ error: 'Müraciət tapılmadı' });
  if (req.user.role === 'applicant' && app.voen !== req.user.voen) {
    return res.status(403).json({ error: 'Bu müraciətə giriş icazəniz yoxdur' });
  }
  res.json({
    source: 'EKTİS',
    syncedAt: new Date().toISOString(),
    ektisReference: `EKTİS-${app.trackingCode}`,
    accepted: true,
    payload: {
      trackingCode: app.trackingCode,
      voen: app.voen,
      saheHa: app.areaHa,
      investisiyaMeblegi: app.investmentAmount,
      status: app.status
    }
  });
});

// 3) Verify a farmer / company by VÖEN via EKTİS
router.get('/farmer/verify/:voen', async (req, res) => {
  const voen = String(req.params.voen || '').trim();
  const user = await findUserByVoen(voen);
  const taxpayer = findTaxpayer(voen);

  // Already a portal user
  if (user) {
    return res.json({
      source: 'EKTİS',
      voen,
      verified: true,
      registered: true,
      name: user.name,
      company: user.company,
      category: 'Kiçik və Orta Sahibkarlıq Subyekti',
      taxStatus: 'Aktiv',
      message: 'Fermer statusu EKTİS üzərindən təsdiqləndi (portalda qeydiyyatlıdır)'
    });
  }

  // In the state registry, but not yet a portal user
  if (taxpayer) {
    return res.json({
      source: 'EKTİS://taxpayer/verify',
      voen,
      verified: true,
      registered: false,
      name: taxpayer.name,
      company: taxpayer.company,
      category: taxpayer.category,
      taxStatus: taxpayer.taxStatus,
      message: 'Sahibkar EKTİS reyestrində tapıldı'
    });
  }

  res.json({
    source: 'EKTİS://taxpayer/verify',
    voen,
    verified: false,
    registered: false,
    message: 'Bu VÖEN üzrə sahibkar EKTİS reyestrində tapılmadı'
  });
});

// 4) Health/status of the integration
router.get('/status', (_req, res) => {
  res.json({
    source: 'EKTİS',
    online: true,
    services: ['cadastre/v2', 'taxpayer/verify', 'applications/sync'],
    latencyMs: 42,
    checkedAt: new Date().toISOString()
  });
});

// 5) Satellite vegetation monitoring (mock Sentinel-2 / Copernicus NDVI)
router.get('/ndvi/:landId', async (req, res) => {
  const land = await findLand(req.params.landId);
  if (!land) return res.status(404).json({ error: 'Torpaq sahəsi tapılmadı' });
  const ndvi = currentNdvi(land);
  res.json({
    source: 'Copernicus Sentinel-2 (mock)',
    landId: land.id,
    landCode: land.code,
    districtName: land.districtName,
    resolution: '10m',
    capturedAt: new Date().toISOString(),
    current: { value: ndvi.value, label: ndvi.label, health: ndvi.health },
    series: ndvi.series
  });
});

export default router;

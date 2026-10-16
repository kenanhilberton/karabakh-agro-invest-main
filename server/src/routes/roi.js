import { Router } from 'express';
import { simulateRoi } from '../utils/roi.js';
import { CROP_ECONOMICS, CROPS } from '../data/seed.js';

const router = Router();

router.get('/crops', (_req, res) => {
  res.json(
    Object.entries(CROPS).map(([key, v]) => ({
      key,
      label: v.label,
      color: v.color,
      ...CROP_ECONOMICS[key]
    }))
  );
});

// Agro-ROI investment simulator
router.post('/simulate', (req, res) => {
  const { purpose, areaHa, opexRatio, horizonYears, yieldTonPerHa, pricePerTon, subsidyPct, maturityYears } = req.body || {};
  const num = (v) => (v != null && v !== '' ? Number(v) : undefined);
  const result = simulateRoi({
    purpose,
    areaHa: Number(areaHa),
    opexRatio: num(opexRatio),
    horizonYears: num(horizonYears),
    yieldTonPerHa: num(yieldTonPerHa),
    pricePerTon: num(pricePerTon),
    subsidyPct: num(subsidyPct),
    maturityYears: num(maturityYears)
  });
  if (!result) {
    return res.status(400).json({ error: 'purpose və areaHa düzgün daxil edilməlidir' });
  }
  res.json(result);
});

export default router;

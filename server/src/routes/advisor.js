import { Router } from 'express';
import { findLand } from '../data/store.js';
import { recommendCrops } from '../utils/advisor.js';

const router = Router();

// AI Agro-Advisor: ranks crops for a given land plot (or ad-hoc attributes).
router.post('/recommend', async (req, res) => {
  const { landId, ph, fertility, waterKm, sunDays, areaHa } = req.body || {};
  let land = landId ? await findLand(landId) : null;

  if (!land) {
    if (ph == null || fertility == null) {
      return res.status(400).json({ error: 'landId və ya ph+fertility tələb olunur' });
    }
    land = {
      districtName: 'Fərdi sahə',
      ph: Number(ph),
      fertility: Number(fertility),
      waterKm: Number(waterKm ?? 2),
      sunDays: Number(sunDays ?? 250),
      areaHa: Number(areaHa ?? 10)
    };
  }
  res.json(recommendCrops(land));
});

export default router;

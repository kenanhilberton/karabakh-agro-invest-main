export const CROP_PH_OPTIMAL = {
  uzum:    { min: 6.0, max: 7.0, ideal: 6.5 },
  pambiq:  { min: 5.8, max: 7.5, ideal: 6.8 },
  findiq:  { min: 6.0, max: 7.2, ideal: 6.5 },
  heyvandarliq: { min: 6.2, max: 7.5, ideal: 6.8 },
  istixana: { min: 5.5, max: 7.0, ideal: 6.2 },
};

export const METRICS = [
  { key: 'areaHa', label: 'Sahə', suffix: ' ha', higherBetter: true, weight: 10 },
  { key: 'fertility', label: 'Münbitlik indeksi', suffix: '/100', higherBetter: true, weight: 35 },
  { key: 'ph', label: 'Torpaq pH', suffix: '', higherBetter: false, weight: 20, optimal: { min: 6.0, max: 7.0 } },
  { key: 'waterKm', label: 'Su mənbəyinə məsafə', suffix: ' km', higherBetter: false, weight: 20 },
  { key: 'sunDays', label: 'Günəşli günlər', suffix: ' gün', higherBetter: true, weight: 15 },
];

export function phSuitability(pH, crop) {
  if (pH === undefined || pH === null) return 0.5;
  const opt = CROP_PH_OPTIMAL[crop] || { min: 5.5, max: 7.5, ideal: 6.5 };
  if (pH >= opt.min && pH <= opt.max) {
    const dist = Math.abs(pH - opt.ideal);
    return Math.max(0, 1 - dist / 0.8);
  }
  const out = pH < opt.min ? opt.min - pH : pH - opt.max;
  return Math.max(0, 1 - out / 1.5);
}

export function waterScore(waterKm) {
  if (waterKm <= 1) return 1;
  if (waterKm <= 2) return 0.85;
  if (waterKm <= 3) return 0.7;
  if (waterKm <= 5) return 0.5;
  return 0.3;
}

export function sunScore(sunDays) {
  if (sunDays >= 260) return 1;
  if (sunDays >= 240) return 0.9;
  if (sunDays >= 220) return 0.75;
  return 0.6;
}

export function areaScore(areaHa) {
  if (areaHa >= 100) return 1;
  if (areaHa >= 50) return 0.9;
  if (areaHa >= 20) return 0.75;
  return 0.6;
}

export function scoreMetric(land, metric) {
  const val = land[metric.key];
  if (val === undefined || val === null) return 0;

  if (metric.optimal) {
    const { min, max } = metric.optimal;
    if (val >= min && val <= max) return 100;
    const dist = val < min ? min - val : val - max;
    return Math.max(0, 100 - dist * 20);
  }

  if (metric.higherBetter) {
    return Math.min(100, (val / 100) * 100);
  } else {
    return Math.max(0, 100 - val * 10);
  }
}

export function calculateLandScore(land) {
  const fertilityNorm = (land.fertility || 50) / 100;
  const ph = phSuitability(land.ph, land.purpose);
  const water = waterScore(land.waterKm);
  const sun = sunScore(land.sunDays);
  const area = areaScore(land.areaHa);

  const score =
    fertilityNorm * 0.35 +
    ph * 0.20 +
    water * 0.20 +
    sun * 0.15 +
    area * 0.10;

  return {
    score: Math.round(score * 1000) / 10,
    breakdown: {
      fertility: Math.round(fertilityNorm * 35),
      ph: Math.round(ph * 20),
      water: Math.round(water * 20),
      sun: Math.round(sun * 15),
      area: Math.round(area * 10),
    },
    grade: score >= 0.8 ? 'A' : score >= 0.65 ? 'B' : score >= 0.5 ? 'C' : 'D',
  };
}

export function sortLandsSmart(lands, options = {}) {
  const { ascending = false, filterStatus } = options;
  let list = [...lands];
  if (filterStatus) list = list.filter(l => l.status === filterStatus);
  return list.sort((a, b) => {
    const sa = calculateLandScore(a).score;
    const sb = calculateLandScore(b).score;
    return ascending ? sa - sb : sb - sa;
  });
}
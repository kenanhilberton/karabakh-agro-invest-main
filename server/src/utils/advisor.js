import { CROPS, CROP_ECONOMICS } from '../data/seed.js';

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function netPerHa(eco, opexRatio = 0.35) {
  return eco.yieldTonPerHa * eco.pricePerTon * (1 - opexRatio);
}

const MARKET_MAX = Math.max(...Object.values(CROP_ECONOMICS).map((e) => netPerHa(e)));

function scoreCrop(cropKey, land) {
  const eco = CROP_ECONOMICS[cropKey];
  const reasons = [];
  const risks = [];

  // --- pH fit: 90..100 inside the optimal band, steep falloff outside it ---
  let phScore;
  if (land.ph >= eco.phMin && land.ph <= eco.phMax) {
    const mid = (eco.phMin + eco.phMax) / 2;
    const span = (eco.phMax - eco.phMin) / 2 || 1;
    phScore = clamp(100 - (Math.abs(land.ph - mid) / span) * 10);
  } else {
    const out = land.ph < eco.phMin ? eco.phMin - land.ph : land.ph - eco.phMax;
    phScore = clamp(100 - out * 35);
  }

  // --- Fertility: scales hard below the crop's minimum requirement ---
  const fertScore = land.fertility >= eco.minFertility
    ? clamp(88 + (land.fertility - eco.minFertility) * 0.6)
    : clamp((land.fertility / eco.minFertility) * 70);

  // --- Water: gentle inside the crop's budget, steep outside it ---
  const waterScore = land.waterKm <= eco.maxWaterKm
    ? clamp(100 - land.waterKm * 3)
    : clamp(100 - (land.waterKm - eco.maxWaterKm) * 24 - eco.maxWaterKm * 3);

  // --- Sun ---
  const sunScore = land.sunDays >= eco.minSunDays
    ? 100
    : clamp(100 - (eco.minSunDays - land.sunDays) * 1.5);

  // --- Market attractiveness, bounded so it can never dominate agronomy ---
  const marketScore = clamp(45 + (netPerHa(eco) / MARKET_MAX) * 55);

  // Agronomic suitability with a limiting-factor ("bottleneck") blend:
  // the weighted mean rewards overall fit while the geometric mean
  // punishes any single weak factor, so an agronomically poor crop
  // cannot win on market value alone.
  const w = { ph: 0.22, fert: 0.3, water: 0.3, sun: 0.18 };
  const mean = phScore * w.ph + fertScore * w.fert + waterScore * w.water + sunScore * w.sun;
  const geo =
    Math.pow(phScore, w.ph) *
    Math.pow(fertScore, w.fert) *
    Math.pow(waterScore, w.water) *
    Math.pow(sunScore, w.sun);
  const agronomic = 0.55 * mean + 0.45 * geo;

  const demanded = land.purpose === cropKey;

  let score = agronomic * 0.82 + marketScore * 0.18;
  if (demanded) score += 6; // land is officially designated for this direction
  score = clamp(Math.round(score));

  if (phScore >= 90) reasons.push(`pH ${land.ph} bu məhsul üçün əlverişlidir`);
  else if (phScore < 60) risks.push(`pH (${land.ph}) optimal aralıqdan (${eco.phMin}–${eco.phMax}) kənardır`);

  if (fertScore >= 92) reasons.push(`Münbitlik indeksi (${land.fertility}) tələbi tam ödəyir`);
  else if (fertScore < 60) risks.push(`Münbitlik (${land.fertility}) tələb olunan ${eco.minFertility} səviyyəsindən aşağıdır`);

  if (waterScore >= 85) reasons.push(`Su mənbəyi yaxındır (${land.waterKm} km)`);
  else if (waterScore < 55) risks.push(`Su tələbi yüksək, mənbə ${land.waterKm} km aralıdadır`);

  if (sunScore >= 95) reasons.push(`Günəşli günlərin sayı (${land.sunDays}) kifayətdir`);
  else if (sunScore < 60) risks.push('Günəş işığı məhdud ola bilər');

  if (marketScore >= 80) reasons.push('Bazar gəlirliliyi yüksəkdir');
  else if (marketScore < 50) risks.push('Bazar marjası nisbətən aşağıdır');

  return {
    crop: cropKey,
    label: CROPS[cropKey].label,
    color: CROPS[cropKey].color,
    icon: eco.icon,
    score,
    confidence: score >= 80 ? 'Yüksək' : score >= 65 ? 'Orta' : 'Aşağı',
    demandMatch: demanded,
    waterNeed: eco.waterNeed,
    labor: eco.labor,
    estimatedRoi: Math.round(((netPerHa(eco) * 5 - eco.costPerHa) / eco.costPerHa) * 100),
    factors: {
      ph: Math.round(phScore),
      münbitlik: Math.round(fertScore),
      su: Math.round(waterScore),
      günəş: Math.round(sunScore),
      bazar: Math.round(marketScore)
    },
    reasons: reasons.slice(0, 3),
    risks: risks.slice(0, 2)
  };
}

export function recommendCrops(land) {
  const ranked = Object.keys(CROPS)
    .map((k) => scoreCrop(k, land))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.demandMatch) - Number(a.demandMatch);
    });

  const top = ranked[0];
  const best = ranked.find((r) => r.estimatedRoi === Math.max(...ranked.map((x) => x.estimatedRoi)));
  return {
    generatedAt: new Date().toISOString(),
    model: 'AgroAdvisor v1 (rule-based scoring engine)',
    land: {
      districtName: land.districtName,
      ph: land.ph,
      fertility: land.fertility,
      waterKm: land.waterKm,
      sunDays: land.sunDays,
      areaHa: land.areaHa
    },
    topPick: top.crop,
    summary:
      top.score >= 80
        ? `${land.districtName} üçün ən uyğun istiqamət "${top.label}" hesab olunur (uyğunluq ${top.score}%).`
        : `${land.districtName} üzrə bütün məhsullar orta səviyyədə uyğundur; ən yaxşı seçim "${top.label}" (${top.score}%).`,
    recommendations: ranked,
    bestRoiPick: best ? best.crop : top.crop
  };
}

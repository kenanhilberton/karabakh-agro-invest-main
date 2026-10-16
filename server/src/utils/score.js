const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// Automatic scoring of an investment application for the operator's shortlist.
export function scoreApplication({ investmentAmount, areaHa, fertility = 70, paybackYears = 4 }) {
  const investK = (investmentAmount || 0) / 1000;
  const investScore = clamp((investK / 500) * 100); // 500k+ -> 100
  const scaleScore = clamp((areaHa / 100) * 100); // 100ha+ -> 100
  const landScore = clamp(fertility);
  const paybackScore = clamp(100 - (paybackYears - 1) * 16); // 1y -> 100, ~7y -> 4

  const total = clamp(
    Math.round(investScore * 0.34 + scaleScore * 0.24 + landScore * 0.22 + paybackScore * 0.2)
  );

  const grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
  return {
    total,
    grade,
    breakdown: {
      investisiya: Math.round(investScore),
      miqyas: Math.round(scaleScore),
      torpaq: Math.round(landScore),
      geriQaytarma: Math.round(paybackScore)
    }
  };
}

// Mock NDVI (vegetation index) time series for a land plot — simulates satellite monitoring.
export function ndviSeries(land) {
  const base = 0.35 + (land.fertility / 100) * 0.4 + (land.sunDays - 230) * 0.001;
  const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
  return months.map((m, i) => {
    const seasonal = Math.max(0, Math.sin(((i - 2) / 12) * Math.PI * 2)) * 0.35;
    const noise = ((Math.sin(land.areaHa * 3.7 + i * 1.9) * 1000) % 1) * 0.06;
    return { month: m, ndvi: Number((Math.min(0.95, base + seasonal + noise)).toFixed(3)) };
  });
}

export function currentNdvi(land) {
  const series = ndviSeries(land);
  // "current" = month index of the planted season peak
  const idx = (new Date().getMonth() + 2) % 12;
  const value = series[idx].ndvi;
  const label = value >= 0.7 ? 'Sıx bitki örtüyü' : value >= 0.5 ? 'Orta örtük' : value >= 0.3 ? 'Zəif örtük' : 'Boş/şumlanmış';
  const health = value >= 0.6 ? 'Yaxşı' : value >= 0.4 ? 'Orta' : 'Zəif';
  return { value, label, health, series };
}

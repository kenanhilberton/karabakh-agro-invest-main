import { calculateLandScore } from './landScore.js';

export const STATUS_FILL = {
  available: '#10b981',
  reserved: '#f59e0b',
  allocated: '#6366f1'
};

export const COLOR_MODES = [
  { key: 'purpose', label: 'Təyinat' },
  { key: 'relief', label: 'Relyef' },
  { key: 'status', label: 'Status' },
  { key: 'fertility', label: 'Münbitlik' },
  { key: 'score', label: 'Uyğunluq skoru' },
  { key: 'heat', label: 'İstilik xəritəsi' }
];

// Relyef (terrain relief) differentiation for state-proposed land.
// Keys accept both the diacritic form and the legacy ASCII form.
export const RELIEF_FILL = {
  'Düzənlik': '#22c55e',
  'Dağ ətəyi': '#d97706',
  'Dağlıq': '#92400e',
  Duzenlik: '#22c55e',
  'Dag eteyi': '#d97706',
  Dagliq: '#92400e'
};

export function reliefLabel(relief) {
  if (relief === 'Dagliq') return 'Dağlıq';
  if (relief === 'Dag eteyi') return 'Dağ ətəyi';
  if (relief === 'Duzenlik') return 'Düzənlik';
  return relief || 'Düzənlik';
}

export function reliefColor(relief) {
  return RELIEF_FILL[relief] || RELIEF_FILL[reliefLabel(relief)] || '#64748b';
}

export function heatColor(v) {
  const t = Math.max(0, Math.min(1, (Number(v) || 0) / 100));
  const hue = 18 + t * 118;
  return `hsl(${Math.round(hue)}, 72%, 45%)`;
}

export function fertilityBand(v) {
  const n = Number(v) || 0;
  if (n >= 75) return '#059669';
  if (n >= 55) return '#65a30d';
  if (n >= 40) return '#f59e0b';
  return '#f97316';
}

export const GRADE_FILL = {
  A: '#059669',
  B: '#65a30d',
  C: '#d97706',
  D: '#ea580c'
};

export function gradeColor(grade) {
  return GRADE_FILL[grade] || '#94a3b8';
}

export function landFillColor(land, mode) {
  if (!land) return '#94a3b8';
  if (mode === 'relief') return reliefColor(land.relief);
  if (mode === 'status') return STATUS_FILL[land.status] || '#94a3b8';
  if (mode === 'fertility') return fertilityBand(land.fertility);
  if (mode === 'score') return gradeColor(calculateLandScore(land).grade);
  if (mode === 'heat') return heatColor(land.fertility);
  return land.color || '#3b82f6';
}

export function legendFor(mode, meta = {}) {
  if (mode === 'relief') {
    return [
      { label: 'Düzənlik', color: RELIEF_FILL['Düzənlik'] },
      { label: 'Dağ ətəyi', color: RELIEF_FILL['Dağ ətəyi'] },
      { label: 'Dağlıq', color: RELIEF_FILL['Dağlıq'] }
    ];
  }
  if (mode === 'status') {
    return (meta.statuses || []).map((s) => ({ label: s.label, color: STATUS_FILL[s.key] }));
  }
  if (mode === 'fertility') {
    return [
      { label: '< 40', color: '#f97316' },
      { label: '40–55', color: '#f59e0b' },
      { label: '55–75', color: '#65a30d' },
      { label: '≥ 75', color: '#059669' }
    ];
  }
  if (mode === 'score') {
    return [
      { label: 'A (≥80)', color: GRADE_FILL.A },
      { label: 'B (65–80)', color: GRADE_FILL.B },
      { label: 'C (50–65)', color: GRADE_FILL.C },
      { label: 'D (<50)', color: GRADE_FILL.D }
    ];
  }
  if (mode === 'heat') {
    return [
      { label: 'Aşağı münbitlik', color: heatColor(15) },
      { label: 'Orta', color: heatColor(50) },
      { label: 'Yüksək münbitlik', color: heatColor(90) }
    ];
  }
  return (meta.crops || []).map((c) => ({ label: c.label, color: c.color }));
}

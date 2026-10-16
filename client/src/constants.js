export const STAGES = [
  { key: 'submitted', label: 'Qəbul edilib', short: 'Qəbul' },
  { key: 'review', label: 'Baxılır', short: 'Baxılır' },
  { key: 'documents', label: 'Əlavə məlumat tələb olunur', short: 'Məlumat' },
  { key: 'approved', label: 'Qərar verilib: Təsdiqləndi', short: 'Təsdiq' },
  { key: 'rejected', label: 'Qərar verilib: İmtina', short: 'İmtina' }
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

export const STATUS_COLORS = {
  available: 'bg-brand-50 text-brand-700',
  reserved: 'bg-amber-50 text-amber-700',
  allocated: 'bg-flag-red/10 text-flag-red',
  submitted: 'bg-slate-100 text-slate-700',
  review: 'bg-sky-50 text-sky-700',
  documents: 'bg-amber-50 text-amber-700',
  approved: 'bg-brand-50 text-brand-700',
  rejected: 'bg-red-50 text-flag-red'
};

export const CROP_COLORS = {
  uzum: '#7c3aed',
  pambiq: '#eab308',
  heyvandarliq: '#16a34a',
  istixana: '#0ea5e9',
  findiq: '#b45309'
};

export const PROJECT_TECHNOLOGIES = [
  { key: 'smart_irrigation', label: 'Ağıllı suvarma', icon: 'droplet' },
  { key: 'precision_farming', label: 'Dəqiq əkinçilik və dronlar', icon: 'cpu' },
  { key: 'green_energy', label: 'Yaşıl enerji mənbələri', icon: 'bolt' }
];

export const VALUE_CHAIN_STEPS = [
  { key: 'cultivation', label: 'Əkin yetişdirmə', icon: 'leaf' },
  { key: 'harvest_storage', label: 'Yığım və saxlama', icon: 'package' },
  { key: 'processing', label: 'Emal', icon: 'factory' },
  { key: 'sales_export', label: 'Satış və ixrac', icon: 'truck' }
];

export const TECH_LABELS = Object.fromEntries(PROJECT_TECHNOLOGIES.map((t) => [t.key, t.label]));
export const VALUE_CHAIN_LABELS = Object.fromEntries(VALUE_CHAIN_STEPS.map((v) => [v.key, v.label]));

// Impact metrics captured per application: key -> { label, unit }
export const IMPACT_METRICS = [
  { key: 'arableAreaHa', label: 'Ümumi əkin və bağ sahələri', unit: 'ha' },
  { key: 'permanentJobs', label: 'Daimi iş yerləri', unit: 'nəfər' },
  { key: 'seasonalJobs', label: 'Mövsümi iş yerləri', unit: 'nəfər' },
  { key: 'annualOutputTons', label: 'İllik məhsul həcmi', unit: 'ton' }
];

export const ACCOUNT_TYPE_LABELS = { sahibkar: 'Sahibkar', investor: 'İnvestor' };

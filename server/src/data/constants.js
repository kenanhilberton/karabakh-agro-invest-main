export const APPLICATION_STAGES = [
  { key: 'submitted', label: 'Qəbul edilib', icon: '1' },
  { key: 'review', label: 'Baxılır', icon: '2' },
  { key: 'documents', label: 'Əlavə məlumat tələb olunur', icon: '3' },
  { key: 'approved', label: 'Qərar verilib: Təsdiqləndi', icon: '4' },
  { key: 'rejected', label: 'Qərar verilib: İmtina', icon: '5' }
];

export const NEXT_ACTIONS = {
  submitted: ['review', 'documents'],
  review: ['documents', 'approved', 'rejected'],
  documents: ['review', 'approved', 'rejected'],
  approved: [],
  rejected: []
};

// Modern technologies an investment project can adopt.
export const PROJECT_TECHNOLOGIES = [
  { key: 'smart_irrigation', label: 'Ağıllı suvarma' },
  { key: 'precision_farming', label: 'Dəqiq əkinçilik və dronlar' },
  { key: 'green_energy', label: 'Yaşıl enerji mənbələri' }
];

// Value-chain stages the project covers.
export const VALUE_CHAIN_STEPS = [
  { key: 'cultivation', label: 'Əkin yetişdirmə' },
  { key: 'harvest_storage', label: 'Yığım və saxlama' },
  { key: 'processing', label: 'Emal' },
  { key: 'sales_export', label: 'Satış və ixrac' }
];

export const TECH_KEYS = PROJECT_TECHNOLOGIES.map((t) => t.key);
export const VALUE_CHAIN_KEYS = VALUE_CHAIN_STEPS.map((v) => v.key);

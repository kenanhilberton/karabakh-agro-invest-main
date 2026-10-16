import { v4 as uuid } from 'uuid';
import { DEMO_ACCOUNTS } from './demoAccounts.js';

// Approximate administrative centres of the liberated districts of Azerbaijan
export const DISTRICTS = {
  Agdam: { name: 'Ağdam', center: [39.9947, 46.93] },
  Fuzuli: { name: 'Füzuli', center: [39.6003, 47.1428] },
  Jabrayil: { name: 'Cəbrayıl', center: [39.3992, 47.0283] },
  Zangilan: { name: 'Zəngilan', center: [39.0844, 46.6544] },
  Gubadli: { name: 'Qubadlı', center: [39.3444, 46.5775] },
  Lachin: { name: 'Laçın', center: [39.6397, 46.5472] },
  Kalbajar: { name: 'Kəlbəcər', center: [40.1072, 46.0428] },
  Shusha: { name: 'Şuşa', center: [39.76, 46.75] },
  Khojavend: { name: 'Xocavənd', center: [39.7836, 47.1167] },
  Aghdara: { name: 'Ağdərə', center: [40.1, 46.7667] }
};

export const CROPS = {
  uzum: { key: 'uzum', label: 'Üzümçülük', color: '#7c3aed' },
  pambiq: { key: 'pambiq', label: 'Pambıqçılıq', color: '#eab308' },
  heyvandarliq: { key: 'heyvandarliq', label: 'Heyvandarlıq', color: '#16a34a' },
  istixana: { key: 'istixana', label: 'İstixana', color: '#0ea5e9' },
  findiq: { key: 'findiq', label: 'Fındıqçılıq', color: '#b45309' }
};

// Investment assumptions + agronomic profile per crop type.
// The agronomic profile drives the AI Agro-Advisor recommendation engine.
// maturityYears = illərlə tam məhsuldarlığa çatma müddəti (çoxillik bitkilər üçün rampa).
export const CROP_ECONOMICS = {
  uzum: { costPerHa: 12000, yieldTonPerHa: 8, pricePerTon: 900, maturityYears: 4, cadence: 'annual', phMin: 6.0, phMax: 7.5, minFertility: 70, maxWaterKm: 3.5, minSunDays: 250, waterNeed: 'Orta', labor: 'Yüksək', icon: '🍇' },
  pambiq: { costPerHa: 3500, yieldTonPerHa: 3.5, pricePerTon: 700, maturityYears: 1, cadence: 'annual', phMin: 6.5, phMax: 8.0, minFertility: 75, maxWaterKm: 2.5, minSunDays: 260, waterNeed: 'Yüksək', labor: 'Orta', icon: '🌱' },
  heyvandarliq: { costPerHa: 9000, yieldTonPerHa: 6, pricePerTon: 1500, maturityYears: 2, cadence: 'annual', phMin: 6.0, phMax: 7.5, minFertility: 60, maxWaterKm: 6.0, minSunDays: 220, waterNeed: 'Aşağı', labor: 'Orta', icon: '🐄' },
  istixana: { costPerHa: 45000, yieldTonPerHa: 40, pricePerTon: 800, maturityYears: 1, cadence: 'annual', phMin: 6.5, phMax: 7.5, minFertility: 80, maxWaterKm: 1.5, minSunDays: 250, waterNeed: 'Çox yüksək', labor: 'Yüksək', icon: '🏠' },
  findiq: { costPerHa: 6000, yieldTonPerHa: 2.2, pricePerTon: 2600, maturityYears: 5, cadence: 'annual', phMin: 5.5, phMax: 7.0, minFertility: 65, maxWaterKm: 4.0, minSunDays: 230, waterNeed: 'Orta', labor: 'Aşağı', icon: '🌰' }
};

// Build a slightly irregular rectangular polygon around a centre point
function plotPolygon(lat, lng, halfW, halfH, seed = 0) {
  const j = (i, k) => (((Math.sin(seed * 12.9898 + i * 4.1 + k * 7.7) * 43758.5453) % 1) * 0.004);
  const pts = [
    [lat - halfH + j(1, 1), lng - halfW - j(1, 2)],
    [lat + halfH + j(2, 1), lng - halfW + j(2, 2)],
    [lat + halfH + j(3, 1), lng + halfW + j(3, 2)],
    [lat - halfH + j(4, 1), lng + halfW - j(4, 2)],
    [lat - halfH + j(1, 1), lng - halfW - j(1, 2)]
  ];
  return {
    type: 'Polygon',
    coordinates: [pts.map(([la, ln]) => [Number(ln.toFixed(5)), Number(la.toFixed(5))])]
  };
}

function districtRelief(d) {
  if (['Kalbajar', 'Lachin'].includes(d)) return 'Dağlıq';
  if (['Shusha', 'Gubadli'].includes(d)) return 'Dağ ətəyi';
  return 'Düzənlik';
}

function makePlot({ district, crop, areaHa, ph, fertility, waterKm, sunDays, halfW, halfH, offset, status, relief }) {
  const c = DISTRICTS[district].center;
  const lat = c[0] + offset[0];
  const lng = c[1] + offset[1];
  const seed = areaHa + lat;
  return {
    id: uuid(),
    code: `${district.toUpperCase().slice(0, 3)}-${String(Math.round(areaHa * 10)).padStart(4, '0')}`,
    district,
    districtName: DISTRICTS[district].name,
    purpose: crop,
    purposeLabel: CROPS[crop].label,
    color: CROPS[crop].color,
    areaHa,
    ph,
    fertility, // soil fertility index 0-100
    waterKm, // distance to nearest water source in km
    sunDays, // sunny days per year
    relief: relief || districtRelief(district),
    status: status || 'available', // available | reserved | allocated
    cadence: 'İllik',
    geometry: plotPolygon(lat, lng, halfW, halfH, seed)
  };
}

export function buildPlots() {
  return [
    makePlot({ district: 'Fuzuli', crop: 'pambiq', areaHa: 50, ph: 7.2, fertility: 78, waterKm: 1.4, sunDays: 265, halfW: 0.019, halfH: 0.014, offset: [0.02, -0.03] }),
    makePlot({ district: 'Fuzuli', crop: 'uzum', areaHa: 32, ph: 6.8, fertility: 82, waterKm: 2.1, sunDays: 260, halfW: 0.015, halfH: 0.012, offset: [-0.03, 0.04] }),
    makePlot({ district: 'Agdam', crop: 'findiq', areaHa: 45, ph: 6.5, fertility: 74, waterKm: 3.2, sunDays: 245, halfW: 0.018, halfH: 0.015, offset: [0.01, 0.03] }),
    makePlot({ district: 'Agdam', crop: 'heyvandarliq', areaHa: 120, ph: 7.0, fertility: 69, waterKm: 4.0, sunDays: 240, halfW: 0.03, halfH: 0.022, offset: [-0.04, -0.02] }),
    makePlot({ district: 'Jabrayil', crop: 'pambiq', areaHa: 68, ph: 7.4, fertility: 80, waterKm: 1.1, sunDays: 270, halfW: 0.022, halfH: 0.017, offset: [0.02, 0.01] }),
    makePlot({ district: 'Jabrayil', crop: 'istixana', areaHa: 12, ph: 7.1, fertility: 85, waterKm: 0.8, sunDays: 275, halfW: 0.01, halfH: 0.008, offset: [-0.02, 0.03] }),
    makePlot({ district: 'Zangilan', crop: 'uzum', areaHa: 40, ph: 6.9, fertility: 83, waterKm: 1.6, sunDays: 262, halfW: 0.017, halfH: 0.013, offset: [0.01, -0.02] }),
    makePlot({ district: 'Zangilan', crop: 'findiq', areaHa: 55, ph: 6.6, fertility: 76, waterKm: 3.5, sunDays: 250, halfW: 0.02, halfH: 0.016, offset: [-0.03, 0.03] }),
    makePlot({ district: 'Gubadli', crop: 'heyvandarliq', areaHa: 150, ph: 7.0, fertility: 66, waterKm: 5.1, sunDays: 235, halfW: 0.034, halfH: 0.026, offset: [0.02, 0.01] }),
    makePlot({ district: 'Lachin', crop: 'heyvandarliq', areaHa: 95, ph: 6.4, fertility: 71, waterKm: 2.7, sunDays: 228, halfW: 0.026, halfH: 0.02, offset: [-0.01, 0.02] }),
    makePlot({ district: 'Kalbajar', crop: 'findiq', areaHa: 60, ph: 6.2, fertility: 73, waterKm: 3.0, sunDays: 220, halfW: 0.021, halfH: 0.017, offset: [0.02, -0.03] }),
    makePlot({ district: 'Shusha', crop: 'uzum', areaHa: 25, ph: 7.3, fertility: 88, waterKm: 1.9, sunDays: 255, halfW: 0.012, halfH: 0.01, offset: [0.01, 0.02] }),
    makePlot({ district: 'Khojavend', crop: 'pambiq', areaHa: 72, ph: 7.5, fertility: 79, waterKm: 1.3, sunDays: 268, halfW: 0.023, halfH: 0.018, offset: [-0.02, 0.01] }),
    makePlot({ district: 'Aghdara', crop: 'istixana', areaHa: 18, ph: 6.7, fertility: 81, waterKm: 2.4, sunDays: 248, halfW: 0.012, halfH: 0.009, offset: [0.02, 0.02] })
  ];
}

export function buildUsers() {
  return DEMO_ACCOUNTS.map((u) => ({ id: uuid(), ...u, status: 'active' }));
}

// Demo job vacancies posted by entrepreneurs / investors. `posterVoen` is
// resolved to a user id at seed time so the poster can manage their listings.
export function buildVacancies() {
  const now = Date.now();
  const ago = (days) => new Date(now - days * 86400000).toISOString();
  return [
    {
      code: 'VAC-2026-0001',
      title: 'Bağçılıq üzrə aqronom',
      company: 'Agro Qarabağ MMC',
      posterVoen: '1234567890',
      posterType: 'sahibkar',
      district: 'Fuzuli',
      employmentType: 'full_time',
      positions: 2,
      salaryMin: 1500,
      salaryMax: 2200,
      description:
        'Füzuli rayonunda üzüm və fındıq bağlarının salınması və idarə olunması üzrə təcrübəli aqronom axtarılır. Dəqiq əkinçilik alətləri ilə iş bacarığı arzuolunandır.',
      requirements: 'Aqrar ixtisas üzrə ali təhsil, 3+ il təcrübə, sürücülük vəsiqəsi.',
      contact: 'elvin@agroqarabag.az · +994 50 123 45 67',
      technologies: ['precision_farming', 'smart_irrigation'],
      status: 'open',
      createdAt: ago(6),
      updatedAt: ago(6)
    },
    {
      code: 'VAC-2026-0002',
      title: 'İstixana üzrə mütəxəssis',
      company: 'GreenFuzuli LLC',
      posterVoen: '9988776655',
      posterType: 'investor',
      district: 'Jabrayil',
      employmentType: 'full_time',
      positions: 3,
      salaryMin: 1200,
      salaryMax: 1800,
      description:
        'Cəbrayıl rayonunda smart istixana kompleksinin istismarı üzrə mütəxəssislər. Avtomatlaşdırılmış suvarma və iqlim nəzarəti sistemləri ilə iş.',
      requirements: 'Aqrotexnika bilikləri, istixana təcrübəsi, komanda ilə iş bacarığı.',
      contact: 'nigar@greenfuzuli.az · +994 55 987 65 43',
      technologies: ['smart_irrigation', 'green_energy'],
      status: 'open',
      createdAt: ago(3),
      updatedAt: ago(3)
    },
    {
      code: 'VAC-2026-0003',
      title: 'Mövsümi üzüm yığımı işçiləri',
      company: 'Agro Qarabağ MMC',
      posterVoen: '1234567890',
      posterType: 'sahibkar',
      district: 'Zangilan',
      employmentType: 'seasonal',
      positions: 40,
      salaryMin: null,
      salaryMax: null,
      description:
        'Zəngilan rayonunda üzüm yığımı mövsümü üçün müvəqqəti işçilər. Gündəlik əmək haqqı ödənilir, yataqxana və yemək təmin olunur.',
      requirements: 'Fiziki hazırlıq, kənd təsərrüfatı sahəsində təcrübə arzuolunandır.',
      contact: 'İnsan Resursları: +994 50 123 45 67',
      technologies: [],
      status: 'open',
      createdAt: ago(1),
      updatedAt: ago(1)
    }
  ];
}

// Investment competitions (the actual "müsabiqə" the portal is built around)
export function buildCompetitions() {
  const now = new Date();
  const plus = (days) => new Date(now.getTime() + days * 86400000).toISOString();
  return [
    {
      id: uuid(),
      code: 'KAI-2026-AGRO',
      title: 'Qarabağ Agro İnvestisiya Müsabiqəsi 2026',
      short: 'Agro 2026',
      description:
        'İşğaldan azad edilmiş ərazilərdə aqrar istehsalın bərpası üçün investisiya layihələrinin seçimi. Qaliblər güzəştli torpaq icarəsi, vergi güzəştləri və subsidiya paketi əldə edir.',
      status: 'active',
      startDate: plus(-20),
      endDate: plus(31),
      totalBudget: 25000000,
      currency: 'AZN',
      categories: ['uzum', 'pambiq', 'heyvandarliq', 'istixana', 'findiq'],
      incentives: [
        '5 il müddətinə güzəştli torpaq icarəsi',
        'İlkin investisiyanın 30%-nə qədər subsidiya',
        '7 il müddətində vergi güzəştləri',
        'Su və infrastruktura çıxışın dövlət hesabına təmini',
        'Mentorluq və aqronom dəstəyi'
      ],
      eligibility: [
        'Azərbaycanda qeydiyyatdan keçmiş KOS subyekti (VÖEN)',
        'Minimum layihə həcmi: 5 hektar',
        'İlkin investisiyanın 20%-i öz vəsaiti hesabına',
        'Aqrar sahədə təcrübə və ya tərəfdaşlıq'
      ],
      stages: ['Qeydiyyat', 'Sənəd yoxlaması', 'Qiymətləndirmə', 'Təqdimat (pitch)', 'Qalibin elanı'],
      applicationsCount: 0
    },
    {
      id: uuid(),
      code: 'KAI-2026-TECH',
      title: 'Aqrar Texnologiya və İstixana Müsabiqəsi',
      short: 'AgroTech',
      description:
        'Dəqiq əkinçilik, smart istixana və aqro-texnologiya layihələri üçün xüsusi müsabiqə.',
      status: 'upcoming',
      startDate: plus(40),
      endDate: plus(100),
      totalBudget: 8000000,
      currency: 'AZN',
      categories: ['istixana'],
      incentives: ['Qrant dəstəyi', 'Texnologiya parkında yer', 'Beynəlxalq aqro-ekspertiza'],
      eligibility: ['İnnovativ texnologiya komponenti', 'Minimum 2 hektar'],
      stages: ['Qeydiyyat', 'Texniki ekspertiza', 'Pitch day'],
      applicationsCount: 0
    }
  ];
}

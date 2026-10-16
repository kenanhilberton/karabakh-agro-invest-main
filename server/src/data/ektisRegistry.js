// Mock EKTİS taxpayer registry.
// Simulates the central e-services return: given a VÖEN, the state system
// exposes the registered taxpayer's name, company and status. Used by the
// registration page to verify + autofill a sahibkar before an account exists.
export const EKTIS_TAXPAYERS = {
  '2501234567': {
    name: 'Rəşad Hüseynov',
    company: 'Qarabağ Bağçılıq MMC',
    category: 'Kiçik sahibkarlıq subyekti',
    taxStatus: 'Aktiv'
  },
  '3009876543': {
    name: 'Leyla Qasımova',
    company: 'Aran Agro MMC',
    category: 'Orta sahibkarlıq subyekti',
    taxStatus: 'Aktiv'
  },
  '4107654321': {
    name: 'Tural İsmayılov',
    company: 'Zəfər Aqro MMC',
    category: 'Kiçik sahibkarlıq subyekti',
    taxStatus: 'Aktiv'
  },
  '5551112233': {
    name: 'Kamran Nəsirov',
    company: 'Bərəkət Fermer Təsərrüfatı',
    category: 'Mikro sahibkarlıq subyekti',
    taxStatus: 'Aktiv'
  },
  '6109998877': {
    name: 'Aysel Rəhimova',
    company: 'Yaşıl Vadi İstixana MMC',
    category: 'Kiçik sahibkarlıq subyekti',
    taxStatus: 'Aktiv'
  }
};

export function findTaxpayer(voen) {
  return EKTIS_TAXPAYERS[String(voen || '').trim()] || null;
}

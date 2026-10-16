// Static demo credentials used by seed + the /auth/demo-accounts helper.
// Kept in plaintext here so judges can preview & prefill them on the login page,
// while the database stores only bcrypt hashes.
export const DEMO_ACCOUNTS = [
  {
    voen: '1234567890',
    name: 'Elvin Məmmədov',
    company: 'Agro Qarabağ MMC',
    role: 'applicant',
    password: 'demo123',
    email: 'elvin@agroqarabag.az',
    phone: '+994 50 123 45 67'
  },
  {
    voen: '9988776655',
    name: 'Nigar Əliyeva',
    company: 'GreenFuzuli LLC',
    role: 'applicant',
    password: 'demo123',
    email: 'nigar@greenfuzuli.az',
    phone: '+994 55 987 65 43'
  },
  {
    voen: 'ADMIN00000',
    name: 'Nazirlik Operatoru',
    company: 'EKTİS / Aqrar Nazirliyi',
    role: 'operator',
    password: 'admin123',
    email: 'operator@agro.gov.az',
    phone: '+994 12 493 00 00'
  },
  {
    voen: 'SYSADMIN000',
    name: 'Sistem Administratoru',
    company: 'Portal Admin',
    role: 'admin',
    password: 'root123',
    email: 'admin@kai.az',
    phone: '+994 12 493 00 01'
  }
];

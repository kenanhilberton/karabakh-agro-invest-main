import bcrypt from 'bcryptjs';

const ROUNDS = 10;

// bcrypt hash format: $2a$/$2b$/$2y$ followed by cost and salt.
export function isHashed(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), ROUNDS);
}

// Supports legacy plaintext rows (before the hashing migration) transparently.
export function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (isHashed(stored)) return bcrypt.compareSync(String(plain), stored);
  return String(plain) === stored;
}

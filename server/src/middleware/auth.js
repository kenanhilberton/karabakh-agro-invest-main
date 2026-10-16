import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'karabakh-agro-invest-demo-secret';
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

if (JWT_SECRET === DEFAULT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    '\n  ⚠  JWT_SECRET təyin olunmayıb — defolt (public) dəyər istifadə olunur. ' +
      'İstehsalatda server/.env daxilində unikal JWT_SECRET təyin edin.\n'
  );
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, voen: user.voen, name: user.name, role: user.role, userType: user.userType || 'sahibkar' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// Optional auth: attaches req.user when a valid Bearer token is present.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autentifikasiya tələb olunur' });
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentifikasiya tələb olunur' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu əməliyyat üçün icazəniz yoxdur' });
    }
    next();
  };
}

import rateLimit from 'express-rate-limit';

function ipKey(req) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox çox sorğu. Bir dəqiqə sonra yenidən cəhd edin.' },
  keyGenerator: (req) => ipKey(req)
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox çox giriş cəhdi. Bir dəqiqə sonra yenidən cəhd edin.' },
  keyGenerator: (req) => ipKey(req)
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Saatda 500 fayl yükləmə limiti aşılıb.' },
  keyGenerator: (req) => ipKey(req)
});

export const auditLog = (req, res, next) => {
  const start = Date.now();
  const userInfo = req.user ? { voen: req.user.voen, role: req.user.role } : { anonymous: true };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      user: req.user ? { voen: req.user.voen, role: req.user.role } : { anonymous: true },
      statusCode: res.statusCode,
      durationMs: duration
    };

    if (res.statusCode >= 400) {
      console.warn('[AUDIT]', JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', JSON.stringify(logEntry));
    }
  });

  next();
};
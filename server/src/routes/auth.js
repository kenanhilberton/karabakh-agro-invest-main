import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  findUserByVoen,
  findUserById,
  insertUser,
  listUsers,
  updateUserStatus
} from '../data/store.js';
import { signToken, requireAuth, requireRole } from '../middleware/auth.js';
import { verifyPassword } from '../utils/password.js';
import { DEMO_ACCOUNTS } from '../data/demoAccounts.js';

const router = Router();

const ALLOWED_STATUS = ['active', 'pending', 'rejected'];
const ALLOWED_USER_TYPE = ['sahibkar', 'investor'];

function publicUser(u) {
  return {
    id: u.id,
    voen: u.voen,
    name: u.name,
    company: u.company,
    email: u.email,
    phone: u.phone,
    role: u.role,
    userType: u.userType || 'sahibkar',
    status: u.status || 'active',
    createdAt: u.createdAt
  };
}

router.post('/login', async (req, res) => {
  const { voen, password } = req.body || {};
  if (!voen || !password) {
    return res.status(400).json({ error: 'VÖEN/FİN və şifrə tələb olunur' });
  }
  const user = await findUserByVoen(String(voen).trim());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'VÖEN/FİN və ya şifrə yanlışdır' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Hesabınız hələ təsdiqlənməyib — operator təsdiqi gözlənilir.' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Qeydiyyat müraciətiniz rədd edilib.' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Simulated "mygov ID" sign-in (mygovid.gov.az). In a real deployment this is
// replaced by the mygov ID OAuth2 / QR handshake: the government portal returns
// a verified identity (FİN) which we exchange for a local session. Here we make
// that exchange directly by FİN so the flow can be demoed end-to-end.
router.post('/mygov', async (req, res) => {
  const fin = String(req.body?.fin || '').trim();
  if (!fin) {
    return res.status(400).json({ error: 'FİN tələb olunur' });
  }
  const user = await findUserByVoen(fin);
  if (!user) {
    return res.status(404).json({ error: 'Bu FİN ilə mygov ID hesabı tapılmadı' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Hesabınız hələ təsdiqlənməyib — operator təsdiqi gözlənilir.' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Qeydiyyat müraciətiniz rədd edilib.' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user), via: 'mygov' });
});

// Self-service registration for sahibkarlar / investors. Creates a `pending`
// account that an operator/admin must approve before first login.
router.post('/register', async (req, res) => {
  const voen = String(req.body?.voen || '').trim();
  const name = String(req.body?.name || '').trim();
  const company = String(req.body?.company || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');
  const userTypeRaw = String(req.body?.userType || 'sahibkar').trim().toLowerCase();
  const userType = ALLOWED_USER_TYPE.includes(userTypeRaw) ? userTypeRaw : 'sahibkar';

  if (!voen || !name || !password) {
    return res.status(400).json({ error: 'VÖEN, ad soyad və şifrə tələb olunur' });
  }
  if (voen.length < 7) {
    return res.status(400).json({ error: 'VÖEN/FİN ən azı 7 simvol olmalıdır' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifrə ən azı 6 simvol olmalıdır' });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'E-poçt ünvanı düzgün deyil' });
  }

  const existing = await findUserByVoen(voen);
  if (existing) {
    return res.status(409).json({ error: 'Bu VÖEN/FİN ilə hesab artıq mövcuddur' });
  }

  const created = await insertUser({
    id: uuid(),
    voen,
    name,
    company: company || null,
    email: email || null,
    phone: phone || null,
    role: 'applicant',
    userType,
    password,
    status: 'pending'
  });

  res.status(201).json({
    pending: true,
    user: publicUser(created),
    message: 'Qeydiyyatınız qeydə alındı. Operator təsdiqindən sonra daxil ola biləcəksiniz.'
  });
});

// Demo helper: list seeded accounts so judges can log in quickly
router.get('/demo-accounts', (_req, res) => {
  res.json(DEMO_ACCOUNTS);
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/* --------------------- user approval (operator/admin) --------------------- */

router.get('/users', requireAuth, requireRole('operator', 'admin'), async (req, res) => {
  const users = await listUsers({
    status: req.query.status || undefined,
    role: req.query.role || undefined
  });
  res.json({
    total: users.length,
    pending: users.filter((u) => u.status === 'pending').length,
    users: users.map(publicUser)
  });
});

router.patch('/users/:id/status', requireAuth, requireRole('operator', 'admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Yanlış status dəyəri' });
  }
  const user = await findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  }
  // Role hierarchy: operators may only manage applicant accounts.
  if (req.user.role === 'operator' && user.role !== 'applicant') {
    return res.status(403).json({ error: 'Operator yalnız sahibkar hesablarını idarə edə bilər' });
  }
  // Never let an operator/admin disable their own account.
  if (user.id === req.user.sub && status !== 'active') {
    return res.status(400).json({ error: 'Öz hesabınızı deaktiv edə bilməzsiniz' });
  }
  await updateUserStatus(req.params.id, status);
  res.json({ user: publicUser({ ...user, status }) });
});

export default router;

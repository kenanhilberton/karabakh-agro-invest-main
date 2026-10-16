import { Router } from 'express';
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    listNotifications(req.user.sub),
    countUnreadNotifications(req.user.sub)
  ]);
  res.json({ unread, items });
});

router.patch('/:id/read', async (req, res) => {
  await markNotificationRead(req.params.id, req.user.sub);
  res.json({ ok: true });
});

router.post('/read-all', async (req, res) => {
  await markAllNotificationsRead(req.user.sub);
  res.json({ ok: true });
});

export default router;

// server/routes/notifications.js
import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.js';
import {
  listMyNotifications,
  markRead,
  markAllRead,
  clearRead,
} from '../services/notificationService.js';

const router = Router();

// GET /api/notifications
router.get('/', ensureAuth, async (req, res) => {
  const rows = await listMyNotifications(req.user.id);
  res.json(rows);
});

// POST /api/notifications/:id/read
router.post('/:id/read', ensureAuth, async (req, res) => {
  await markRead(parseInt(req.params.id, 10), req.user.id);
  res.json({ ok: true });
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', ensureAuth, async (req, res) => {
  const out = await markAllRead(req.user.id);
  res.json(out);
});

// DELETE /api/notifications/clear-read
router.delete('/clear-read', ensureAuth, async (req, res) => {
  const out = await clearRead(req.user.id);
  res.json(out);
});

// === Socket side ===
export function registerNotificationSockets(io) {
  io.on('connection', (socket) => {
    const authedUser = socket.request?.user;
    if (!authedUser?.id) return;

    // osobny pokój dla usera
    const room = `user-${authedUser.id}`;
    socket.join(room);

    // manualne join/leave (opcjonalne – klient może wołać)
    socket.on('notif:join', (userId) => {
      if (Number(userId) === authedUser.id) socket.join(`user-${userId}`);
    });
    socket.on('notif:leave', (userId) => {
      if (Number(userId) === authedUser.id) socket.leave(`user-${userId}`);
    });
  });
}

export default router;

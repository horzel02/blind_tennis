// server/routes/admin.js
import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.js';
import { requireModerator, requireAdmin } from '../middlewares/auth.js';
import prisma from '../prismaClient.js';
import bcrypt from 'bcrypt';

const router = Router();

// ===== USERS (admin only) =====
router.get('/users', ensureAuth, requireAdmin, async (req, res) => {
  const { query, active, role, page = '1', limit = '25' } = req.query;
  const take = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (p - 1) * take;

  const whereUsers = {
    AND: [
      query ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { surname: { contains: query, mode: 'insensitive' } },
        ]
      } : {},
      active === 'true' ? { active: true } : {},
      active === 'false' ? { active: false } : {},
    ]
  };

  // Najpierw łapiemy użytkowników (page), a role dociągamy relacją:
  const [total, rows] = await Promise.all([
    prisma.users.count({ where: whereUsers }),
    prisma.users.findMany({
      where: whereUsers,
      include: { user_roles: { include: { roles: { select: { role_name: true } } } } },
      orderBy: { id: 'asc' },
      skip, take
    }),
  ]);

  // filtr po roli (jeśli trzeba)
  const filtered = role
    ? rows.filter(u => u.user_roles?.some(ur => (ur.roles?.role_name || '').toLowerCase() === role.toLowerCase()))
    : rows;

  res.json({
    total,
    page: p,
    limit: take,
    items: filtered.map(u => ({
      ...u,
      // wygodniejsze pole do frontu:
      appRole: (u.user_roles?.[0]?.roles?.role_name || 'user').toLowerCase()
    }))
  });
});


router.patch('/users/:id/active', ensureAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { active } = req.body || {};
    const u = await prisma.users.update({ where: { id }, data: { active: !!active } });
    res.json({ id: u.id, active: u.active });
    const io = req.app.get('io');
    io.to(`user-${u.id}`).emit('force-logout');
  } catch (e) {
    console.error('[admin PATCH /users/:id/active] ', e);
    res.status(500).json({ error: 'Nie udało się zmienić statusu' });
  }
});

router.patch('/users/:id/role', ensureAuth, requireAdmin, async (req, res) => {
  const targetUserId = Number(req.params.id);
  const wanted = String(req.body?.role || '').toLowerCase();

  if (!['user', 'moderator', 'admin'].includes(wanted)) {
    return res.status(400).json({ error: 'Zła rola' });
  }

  try {
    if (wanted !== 'admin' && targetUserId === req.user.id) {
      const adminCount = await prisma.user_roles.count({
        where: { roles: { role_name: { equals: 'admin', mode: 'insensitive' } } }
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Nie możesz zdegradować ostatniego administratora.' });
      }
    }

    await prisma.$transaction(async (tx) => {
      // wyczyść wszystkie role przypisane userowi
      await tx.user_roles.deleteMany({ where: { user_id: targetUserId } });

      // rola 'user' = brak wpisu w user_roles
      if (wanted === 'user') return;

      // znajdź id roli w tabeli roles (case-insensitive + tylko aktywne)
      const roleRow = await tx.roles.findFirst({
        where: {
          role_name: { equals: wanted, mode: 'insensitive' },
          active: true
        },
        select: { id: true }
      });

      if (!roleRow) {
        throw Object.assign(new Error('ROLE_NOT_FOUND'), { code: 'ROLE_NOT_FOUND' });
      }

      await tx.user_roles.create({
        data: { user_id: targetUserId, role_id: roleRow.id }
      });
    });

    res.json({ id: targetUserId, role: wanted });
  } catch (e) {
    if (e.code === 'ROLE_NOT_FOUND') {
      return res.status(400).json({ error: 'Rola nie istnieje w tabeli roles' });
    }
    console.error('[admin PATCH /users/:id/role]', e);
    res.status(500).json({ error: 'Nie udało się zmienić roli' });
  }
});


// ===== TOURNAMENTS (moderator+) =====
router.get('/tournaments', ensureAuth, requireModerator, async (req, res) => {
  try {
    const { query = '', page = '1', limit = '25' } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (p - 1) * take;

    const where = query
      ? { name: { contains: String(query), mode: 'insensitive' } }
      : {};

    const [total, rows] = await Promise.all([
      prisma.tournament.count({ where }),
      prisma.tournament.findMany({
        where,
        include: { organizer: { select: { id: true, name: true, surname: true } } },
        orderBy: { id: 'desc' },
        skip, take,
      })
    ]);

    res.json({ total, page: p, limit: take, items: rows });
  } catch (e) {
    console.error('[admin GET /tournaments] ', e);
    res.status(500).json({ error: 'Nie udało się pobrać turniejów' });
  }
});


router.delete('/tournaments/:id', ensureAuth, requireModerator, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.tournament.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin DELETE /tournaments/:id] ', e);
    res.status(500).json({ error: 'Nie udało się usunąć turnieju' });
  }
});

router.patch('/tournaments/:id/hide', ensureAuth, requireModerator, async (req, res) => {
  const id = Number(req.params.id);
  const { hidden = true, applicationsOpen } = req.body || {};
  const data = { ...(hidden != null ? { status: hidden ? 'hidden' : 'registration_open' } : {}) };
  if (applicationsOpen != null) data.applicationsOpen = !!applicationsOpen;
  const row = await prisma.tournament.update({ where: { id }, data });
  res.json({ id: row.id, status: row.status, applicationsOpen: row.applicationsOpen });
});

router.patch('/tournaments/:id/delete', ensureAuth, requireModerator, async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.tournament.update({
    where: { id },
    data: { status: 'deleted', applicationsOpen: false },
  });
  res.json({ id: row.id, status: row.status });
});

router.patch('/users/:id/password', ensureAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID użytkownika.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć co najmniej 6 znaków.' });
    }

    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje.' });
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.users.update({
      where: { id },
      data: {
        password_hash: hash,
        modification_date: new Date()
      }
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('Admin set password error:', e);
    return res.status(500).json({ error: 'Błąd serwera podczas zmiany hasła.' });
  }
});


export default router;

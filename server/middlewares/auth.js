// server/middlewares/auth.js
import prisma from '../prismaClient.js';

export function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Brak autoryzacji' });
}

export function isOrganizer(req, res, next) {
    if (!req.user?.roles?.includes('organizer')) {
        return res.status(403).json({ error: 'Brak uprawnień (tylko organizer)' });
    }
    next();
}

export function hasTournamentRole(requiredRole) {
    return async (req, res, next) => {
        const userId = req.user?.id;
        const tournamentId = parseInt(req.params.id, 10);
        if (!userId) return res.status(401).json({ error: 'Brak autoryzacji' });

        const exists = await prisma.tournamentuserrole.findFirst({
            where: { userId, tournamentId, role: requiredRole }
        });
        if (!exists) {
            return res.status(403).json({ error: `Potrzebna rola ${requiredRole}` });
        }
        next();
    };
}

// ====== pomocnicze ======
function pickPrimaryRole(appRoles) {
  const list = (appRoles || []).map(r => (r || '').toLowerCase());
  if (list.includes('admin')) return 'admin';
  if (list.includes('moderator')) return 'moderator';
  return 'user';
}
async function loadPrimaryAppRole(userId) {
  const rows = await prisma.user_roles.findMany({
    where: { user_id: Number(userId) },
    include: { roles: { select: { role_name: true } } },
  });
  const names = rows.map(r => r.roles?.role_name?.toLowerCase()).filter(Boolean);
  return pickPrimaryRole(names);
}

// ====== KLUCZOWE: wymagana rola globalna ======
export function requireGlobalRole(minRole) {
  const order = { user: 0, moderator: 1, admin: 2 };
  return async (req, res, next) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: 'Brak autoryzacji' });
      if (!req.user.role) {
        req.user.role = await loadPrimaryAppRole(req.user.id);
      }
      const r = (req.user.role || 'user').toLowerCase();
      if ((order[r] ?? 0) >= (order[minRole] ?? 0)) return next();
      return res.status(403).json({ error: 'Brak uprawnień' });
    } catch (e) {
      console.error('[requireGlobalRole] error:', e);
      return res.status(500).json({ error: 'Błąd autoryzacji' });
    }
  };
}

export const requireModerator = requireGlobalRole('moderator');
export const requireAdmin = requireGlobalRole('admin');

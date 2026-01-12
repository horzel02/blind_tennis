// server/controllers/userTimetableController.js
import prisma from '../prismaClient.js';

function parseIntSafe(v, d = 20) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
}

// GET /api/my/matches?role=player|referee|guardian&state=upcoming|live|finished&page=1&limit=20
export async function getMyMatches(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const role  = String(req.query.role || 'player').toLowerCase();
    const state = String(req.query.state || 'upcoming').toLowerCase();
    const page  = parseIntSafe(req.query.page || '1', 1);
    const limit = Math.min(parseIntSafe(req.query.limit || '20', 20), 50);
    const skip  = (page - 1) * limit;

    // ---------- STATE FILTER + ORDER ----------
    let stateWhere = {};
    let orderBy = [];

    if (state === 'upcoming') {
      stateWhere = {
        winnerId: null,
        status: { in: ['scheduled', 'pending', 'in_progress', 'planned'] }
      };
      orderBy = [
        { matchTime: 'asc' },
        { id: 'asc' }
      ];
    } else if (state === 'live') {
      stateWhere = { status: 'in_progress' };
      orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
    } else {
      stateWhere = { status: 'finished' };
      orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
    }

    // ---------- ROLE SCOPE ----------
    let roleWhere;

    if (role === 'referee') {
      roleWhere = { refereeId: Number(userId) };
    } else if (role === 'guardian') {
      const links = await prisma.tournamentGuardian.findMany({
        where: { guardianUserId: Number(userId), status: 'accepted' },
        select: { playerId: true, tournamentId: true },
      });

      if (!links.length) {
        return res.json({ page, limit, total: 0, items: [] });
      }

      const playerIds = [...new Set(links.map(l => l.playerId))];
      const tournamentIds = [...new Set(links.map(l => l.tournamentId))];

      roleWhere = {
        tournamentId: { in: tournamentIds },
        OR: [
          { player1Id: { in: playerIds } },
          { player2Id: { in: playerIds } },
        ],
      };
    } else {
      roleWhere = {
        OR: [{ player1Id: Number(userId) }, { player2Id: Number(userId) }]
      };
    }

    const where = { ...roleWhere, ...stateWhere };

    const [items, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tournament: true,
          player1: true,
          player2: true,
          winner: true,
          referee: true,
          matchSets: { orderBy: { setNumber: 'asc' } },
        },
      }),
      prisma.match.count({ where }),
    ]);

    return res.json({ page, limit, total, items });
  } catch (e) {
    console.error('[getMyMatches]', e);
    res.status(500).json({ error: 'Nie udało się pobrać meczów' });
  }
}

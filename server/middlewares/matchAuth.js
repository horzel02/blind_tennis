// server/middlewares/matchAuth.js
import prisma from '../prismaClient.js';

export async function ensureMatchRefereeOrOrganizer(req, res, next) {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: 'Nieautoryzowany' });
    }
    const userId = req.user.id;
    const matchId = parseInt(req.params.matchId, 10);
    if (Number.isNaN(matchId)) {
      return res.status(400).json({ error: 'Błędne matchId' });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { refereeId: true, tournamentId: true, status: true },
    });
    if (!match) return res.status(404).json({ error: 'Mecz nie znaleziono' });

    const isReferee   = match.refereeId === userId;
    const isOrganizer = !!(await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: match.tournamentId, userId, role: 'organizer' },
      select: { id: true },
    }));

    if (!isReferee && !isOrganizer) {
      return res.status(403).json({ error: 'Brak uprawnień do edycji wyniku' });
    }


    return next();
  } catch (e) {
    console.error('ensureMatchRefereeOrOrganizer error:', e);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}


export async function ensureMatchOrganizer(req, res, next) {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: 'Nieautoryzowany' });
    }
    const matchId = parseInt(req.params.matchId, 10);
    if (Number.isNaN(matchId)) {
      return res.status(400).json({ error: 'Błędne matchId' });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { tournamentId: true },
    });
    if (!match) return res.status(404).json({ error: 'Mecz nie znaleziono' });

    const isOrganizer = !!(await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: match.tournamentId, userId: req.user.id, role: 'organizer' },
      select: { id: true },
    }));

    if (!isOrganizer) {
      return res.status(403).json({ error: 'Tylko organizator może przypisać sędziego' });
    }

    next();
  } catch (e) {
    console.error('ensureMatchOrganizer error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
}


export async function ensureTournamentOrganizerFromBody(req, res, next) {
  try {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: 'Nieautoryzowany' });
    }
    const userId = req.user.id;
    const tId = parseInt(req.body?.tournamentId, 10);
    if (!tId) return res.status(400).json({ error: 'Brak tournamentId' });

    const isOrg = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: tId, userId, role: 'organizer' },
      select: { id: true },
    });
    if (!isOrg) return res.status(403).json({ error: 'Brak uprawnień (organizator turnieju wymagany)' });

    return next();
  } catch (e) {
    console.error('ensureTournamentOrganizerFromBody error:', e);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}
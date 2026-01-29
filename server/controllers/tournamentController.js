// server/controllers/tournamentController.js
import prisma from '../prismaClient.js';
import * as tournamentService from '../services/tournamentService.js';
import * as matchService from '../services/matchService.js';

export async function getAll(req, res) {
  try {
    const tours = await tournamentService.findAllPublicTournaments();
    res.json(tours);
  } catch (err) {
    console.error('💥 [getAll] wyjątek:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const tour = await tournamentService.findTournamentById(req.params.id);
    if (!tour) return res.status(404).json({ error: 'Nie znaleziono turnieju' });

    if (['hidden', 'deleted'].includes(tour.status)) {
      const u = req.user;

      // niezalogowany -> nie istnieje
      if (!u) return res.status(404).json({ error: 'Nie znaleziono turnieju' });

      const isPrivileged = (u.roles || []).some(r => ['admin', 'moderator'].includes(String(r).toLowerCase()));
      const isCreator = tour.organizer_id === u.id;

      const isInvitedOrg = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: tour.id, userId: u.id, role: 'organizer' },
        select: { id: true },
      });

      if (!isPrivileged && !isCreator && !isInvitedOrg) {
        return res.status(404).json({ error: 'Nie znaleziono turnieju' });
      }
    }

    res.json(tour);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


export async function create(req, res) {
  try {
    const tour = await tournamentService.createTournament({ ...req.body, organizer_id: req.user.id });

    await prisma.tournamentuserrole.upsert({
      where: {
        tournamentId_userId_role: {
          tournamentId: tour.id,
          userId: req.user.id,
          role: 'organizer',
        }
      },
      update: {},
      create: {
        tournamentId: tour.id,
        userId: req.user.id,
        role: 'organizer',
      }
    });

    res.status(201).json(tour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}


export async function getByOrganizer(req, res) {
  try {
    const tours = await tournamentService.findTournamentsByOrganizer(req.user.id);
    res.json(tours);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const tour = await tournamentService.updateTournament(
      req.params.id,
      req.body
    );
    res.json(tour);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    await tournamentService.deleteTournament(req.params.id);
    res.json({ message: 'Turniej usunięty' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export const generateTournamentStructure = async (req, res) => {
  const io = req.app.get('socketio') || req.app.get('io');
  const { tournamentId } = req.params;
  try {
    const result = await matchService.generateGroupAndKnockoutMatches(tournamentId);

    io?.to(`tournament-${Number(tournamentId)}`).emit('matches-invalidate', { reason: 'generate-groups-ko' });
    io?.to(`tournament-${Number(tournamentId)}`).emit('standings-invalidate', { reason: 'generate-groups-ko' });

    res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const getTournamentSettings = async (req, res) => {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        format: true,
        groupSize: true,
        qualifiersPerGroup: true,
        allowByes: true,
        koSeedingPolicy: true,
        avoidSameGroupInR1: true,
        applicationsOpen: true,
        participant_limit: true,
      },
    });
    if (!t) return res.status(404).json({ error: 'Turniej nie znaleziony' });
    res.json(t);
  } catch (e) {
    console.error('getTournamentSettings error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

export const updateTournamentSettings = async (req, res) => {
  try {
    const {
      format,
      groupSize,
      qualifiersPerGroup,
      allowByes,
      koSeedingPolicy,
      avoidSameGroupInR1,
    } = req.body || {};

    const data = {};
    if (typeof format !== 'undefined') data.format = format;
    if (typeof groupSize !== 'undefined') data.groupSize = groupSize === null ? null : Number(groupSize);
    if (typeof qualifiersPerGroup !== 'undefined') data.qualifiersPerGroup = qualifiersPerGroup === null ? null : Number(qualifiersPerGroup);
    if (typeof allowByes !== 'undefined') data.allowByes = !!allowByes;
    if (typeof koSeedingPolicy !== 'undefined') data.koSeedingPolicy = koSeedingPolicy;
    if (typeof avoidSameGroupInR1 !== 'undefined') data.avoidSameGroupInR1 = !!avoidSameGroupInR1;

    const updated = await prisma.tournament.update({
      where: { id: Number(req.params.id) },
      data,
      select: {
        id: true,
        format: true,
        groupSize: true,
        qualifiersPerGroup: true,
        allowByes: true,
        koSeedingPolicy: true,
        avoidSameGroupInR1: true,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error('updateTournamentSettings error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

export async function createRegistration(req, res) {
  const tournamentId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const reg = await tournamentService.registerForTournament(tournamentId, userId);
    return res.json(reg);
  } catch (err) {
    return res.status(400).json({
      code: err.code || 'GENERIC',
      error: err.message || 'Błąd',
    });
  }
}

export async function changeRegistrationStatus(req, res) {
  try {
    const upd = await tournamentService.updateRegistrationStatus(req.params.registrationId, req.body.status);
    res.json(upd);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function generateKnockoutOnly(req, res) {
  try {
    const { id } = req.params;
    await matchService.generateKnockoutSkeleton(id);
    const out = await matchService.seedKnockout(id, { overwrite: true });
    const io = req.app.get('socketio') || req.app.get('io');
    io?.to(`tournament-${Number(id)}`).emit('matches-invalidate', { reason: 'generate-ko-only' });
    res.json(out);
  } catch (e) {
    console.error('generateKnockoutOnly error:', e);
    res.status(400).json({ error: e.message || 'Błąd generowania KO' });
  }
}

export async function resetGroupPhase(req, res) {
  try {
    const tid = Number(req.params.tournamentId || req.params.id);
    if (!Number.isFinite(tid)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID turnieju' });
    }

    const { alsoKO } = req.body || {};
    const out = await tournamentService.resetGroupPhase(tid, { alsoKO: !!alsoKO });

    const io = req.app.get('socketio') || req.app.get('io');
    io?.to(`tournament-${tid}`).emit('matches-invalidate', { reason: 'reset-groups', ...out });
    io?.to(`tournament-${tid}`).emit('standings-invalidate', { reason: 'reset-groups' });

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Błąd resetu meczów grupowych' });
  }
}

export async function generateKnockoutSkeleton(req, res) {
  const { id } = req.params;
  // Pobieramy instancję socket.io (zależnie jak masz to skonfigurowane w index.js)
  const io = req.app.get('socketio') || req.app.get('io') || global.__io;

  try {
    // 1. Wywołanie logiki biznesowej
    const result = await matchService.generateKnockoutSkeleton(id);

    // 2. Powiadomienie klientów o zmianach (żeby tabela się odświeżyła)
    if (io) {
      io.to(`tournament-${Number(id)}`).emit('matches-invalidate', { reason: 'generate-ko-skeleton' });
    }

    // 3. Zwrócenie sukcesu
    res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania szkieletu KO:', error);
    res.status(400).json({ error: error.message || 'Błąd serwera' });
  }
}
// server/controllers/guardianController.js
import prisma from '../prismaClient.js';
import * as guardianService from '../services/guardianService.js';
import * as notif from '../services/notificationService.js';

export async function list(req, res) {
  try {
    const { tid, playerId } = req.query;
    const out = await guardianService.list({
      tournamentId: tid ? Number(tid) : null,
      playerId: playerId ? Number(playerId) : null,
      requesterId: Number(req.user?.id),
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function invite(req, res) {
  try {
    const { tournamentId, playerId, guardianUserId } = req.body || {};
    const out = await guardianService.invite({
      tournamentId: Number(tournamentId),
      playerId: Number(playerId),
      guardianUserId: Number(guardianUserId),
      invitedByUserId: Number(req.user?.id),
    });
    res.status(201).json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function accept(req, res) {
  try {
    const out = await guardianService.accept({
      guardianId: Number(req.params.id),
      userId: Number(req.user?.id),
    });

    // rozwiąż zaproszenie u OPIEKUNA
    await notif.resolveByContext(
      out.guardianUserId,
      'guardian_invite',
      n => n?.meta?.tournamentId === out.tournamentId &&
           n?.meta?.playerId === out.playerId
    );

    // poinformuj ZAWODNIKA
    await notif.createNotification({
      userId: out.playerId,
      type: 'guardian_joined',
      title: 'Opiekun dołączył',
      body: `Twój opiekun zaakceptował zaproszenie.`,
      link: `/tournaments/${out.tournamentId}/details`,
      meta: { tournamentId: out.tournamentId, playerId: out.playerId, guardianId: out.guardianUserId },
    });

    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}


export async function decline(req, res) {
  try {
    const out = await guardianService.decline({
      guardianId: Number(req.params.id),
      userId: Number(req.user?.id),
    });

    // rozwiąż zaproszenie u OPIEKUNA
    await notif.resolveByContext(
      out.guardianUserId,
      'guardian_invite',
      n => n?.meta?.tournamentId === out.tournamentId &&
           n?.meta?.playerId === out.playerId
    );

    // poinformuj ZAWODNIKA
    await notif.createNotification({
      userId: out.playerId,
      type: 'guardian_declined',
      title: 'Opiekun odrzucił zaproszenie',
      body: `Zaproszony opiekun odrzucił zaproszenie.`,
      link: `/tournaments/${out.tournamentId}/details`,
      meta: { tournamentId: out.tournamentId, playerId: out.playerId, guardianId: out.guardianUserId },
    });

    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export async function remove(req, res) {
  try {
    const guardianId = Number(req.params.id);
    const requesterId = Number(req.user?.id);
    if (!Number.isFinite(guardianId) || !Number.isFinite(requesterId)) {
      return res.status(400).json({ error: 'Błędne dane wejściowe' });
    }

    // 1) Pobierz rekord + minimalne dane
    const row = await prisma.tournamentGuardian.findUnique({
      where: { id: guardianId },
      select: {
        id: true,
        tournamentId: true,
        playerId: true,
        guardianUserId: true,
      },
    });
    if (!row) return res.status(404).json({ error: 'Powiązanie nie istnieje' });

    // 2) Uprawnienia:
    const isGuardian = row.guardianUserId === requesterId;
    const isPlayer   = row.playerId === requesterId;

    const isOrganizer = !!(await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: row.tournamentId, userId: requesterId, role: 'organizer' },
      select: { id: true },
    })) || !!(await prisma.tournament.findFirst({
      where: { id: row.tournamentId, organizer_id: requesterId },
      select: { id: true },
    }));

    if (!(isGuardian || isPlayer || isOrganizer)) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    // 3) Przygotuj meta i powiadomienia (najpierw wyślij, potem usuń)
    const meta = {
      tournamentId: row.tournamentId,
      playerId: row.playerId,
      guardianId: row.guardianUserId,
    };

    // Notyfikujemy ZAWODNIKA że nie ma już opiekuna.
    await notif.createNotification({
      userId: row.playerId,
      type: 'guardian_resigned',
      title: isGuardian ? 'Opiekun zrezygnował' : 'Opiekun usunięty',
      body: isGuardian
        ? 'Twój opiekun wypisał się.'
        : 'Opiekun został usunięty.',
      link: `/tournaments/${row.tournamentId}/details`,
      meta,
    });

    // 4) Usuń rekord
    await prisma.tournamentGuardian.delete({ where: { id: guardianId } });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[guardian.remove] error:', e);
    return res.status(500).json({ error: 'Nie udało się usunąć opiekuna' });
  }
}
export async function resignGuardian(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const me = req.user.id;

    const row = await prisma.tournamentGuardian.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Nie znaleziono powiązania opiekuna' });
    if (row.guardianUserId !== me) return res.status(403).json({ error: 'To nie Twoje powiązanie' });

    await prisma.tournamentGuardian.delete({ where: { id } });

    // powiadom ZAWODNIKA
    await notif.createNotification({
      userId: row.playerId,
      type: 'guardian_resigned',
      title: 'Opiekun zrezygnował',
      body: `Twój opiekun zrezygnował z roli.`,
      link: `/tournaments/${row.tournamentId}/details`,
      meta: { tournamentId: row.tournamentId, playerId: row.playerId, guardianId: me },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[resignGuardian]', e);
    res.status(500).json({ error: 'Nie udało się wypisać' });
  }
}

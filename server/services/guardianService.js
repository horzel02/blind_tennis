// server/services/guardianService.js
import prisma from '../prismaClient.js';
import * as notif from './notificationService.js';

// helpers
async function isOrganizer(tournamentId, userId) {
  if (!userId) return false;
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizer_id: true, tournamentUserRoles: { where: { role: 'organizer', userId }, select: { id: true } } }
  });
  if (!t) return false;
  return t.organizer_id === userId || (t.tournamentUserRoles?.length ?? 0) > 0;
}

async function isAcceptedPlayer(tournamentId, userId) {
  const reg = await prisma.tournamentregistration.findFirst({
    where: { tournamentId, userId, status: 'accepted' },
    select: { id: true }
  });
  return !!reg;
}

export async function list({ tournamentId, playerId, requesterId }) {

  const where = {};
  if (tournamentId) where.tournamentId = Number(tournamentId);
  if (playerId) where.playerId = Number(playerId);


  if (playerId && requesterId && playerId !== requesterId) {
    const org = await isOrganizer(Number(tournamentId), requesterId);
    if (!org) {
      where.guardianUserId = requesterId;
    }
  }

  return prisma.tournamentGuardian.findMany({
    where,
    orderBy: { invitedAt: 'desc' },
    include: {
      player: { select: { id: true, name: true, surname: true } },
      guardian: { select: { id: true, name: true, surname: true } },
      tournament: { select: { id: true, name: true } }
    }
  });
}

export async function invite({ tournamentId, playerId, guardianUserId, invitedByUserId }) {
  if (!tournamentId || !playerId || !guardianUserId) throw new Error('Brak wymaganych pól');

  const org = await isOrganizer(tournamentId, invitedByUserId);
  if (!org && invitedByUserId !== playerId) {
    throw new Error('Brak uprawnień do zaproszenia opiekuna');
  }


  const ok = await isAcceptedPlayer(tournamentId, playerId);
  if (!ok) throw new Error('Opiekuna można dodać tylko dla zaakceptowanego zawodnika');

  if (guardianUserId === playerId) throw new Error('Opiekun nie może być tym samym użytkownikiem co zawodnik');


  const guardian = await prisma.users.findUnique({ where: { id: guardianUserId }, select: { id: true } });
  if (!guardian) throw new Error('Wybrany opiekun nie istnieje');


  const exists = await prisma.tournamentGuardian.findFirst({
    where: { tournamentId, playerId, guardianUserId }
  });
  if (exists) return exists;

  const rec = await prisma.tournamentGuardian.create({
    data: {
      tournamentId,
      playerId,
      guardianUserId,
      status: 'invited',
      invitedAt: new Date(),
      invitedByUserId
    },
    include: {
      player: { select: { id: true, name: true, surname: true } },
      guardian: { select: { id: true, name: true, surname: true } },
      tournament: { select: { id: true, name: true } }
    }
  });
  await notif.createNotification({
    userId: guardianUserId,
    type: 'guardian_invite',
    title: 'Zaproszenie: opiekun zawodnika',
    body: `Zostałeś zaproszony jako opiekun: ${rec.player.name} ${rec.player.surname} (${rec.tournament.name})`,
    link: `/tournaments/${tournamentId}/details`,
    meta: {
      guardianId: rec.id,
      tournamentId,
      playerId
    }
  });
  return rec;
}

export async function accept({ guardianId, userId }) {
  const g = await prisma.tournamentGuardian.findUnique({ where: { id: guardianId } });
  if (!g) throw new Error('Zaproszenie nie istnieje');
  if (g.guardianUserId !== userId) throw new Error('To nie Twoje zaproszenie');
  if (g.status === 'accepted') return g;

  return prisma.tournamentGuardian.update({
    where: { id: guardianId },
    data: { status: 'accepted', respondedAt: new Date() },
  });
}

export async function decline({ guardianId, userId }) {
  const g = await prisma.tournamentGuardian.findUnique({ where: { id: guardianId } });
  if (!g) throw new Error('Zaproszenie nie istnieje');
  if (g.guardianUserId !== userId) throw new Error('To nie Twoje zaproszenie');

  return prisma.tournamentGuardian.update({
    where: { id: guardianId },
    data: { status: 'declined', respondedAt: new Date() },
  });
}

export async function remove({ guardianId, requesterId }) {
  const g = await prisma.tournamentGuardian.findUnique({ where: { id: guardianId } });
  if (!g) throw new Error('Rekord nie istnieje');

  const org = await isOrganizer(g.tournamentId, requesterId);
  const isPlayer = g.playerId === requesterId;
  const isGuardian = g.guardianUserId === requesterId;

  if (!org && !isPlayer && !isGuardian) {
    throw new Error('Brak uprawnień do usunięcia tej relacji');
  }

  await prisma.tournamentGuardian.delete({ where: { id: guardianId } });
  return { ok: true };
}


// server/controllers/tournamentUserRoleController.js
import * as tournamentService from '../services/tournamentService.js';
import * as roleSvc from '../services/tournamentUserRoleService.js';
import * as notif from '../services/notificationService.js';
import prisma from '../prismaClient.js';

async function assertOrganizerPerm(tournamentId, callerId) {
  const tour = await tournamentService.findTournamentById(tournamentId);
  if (!tour) throw new Error('Turniej nie istnieje');

  const isCreator = tour.organizer_id === callerId;
  const isInvitedOrg = Boolean(
    await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId: callerId, role: 'organizer' },
    })
  );
  if (!isCreator && !isInvitedOrg) {
    const err = new Error('Brak uprawnień (tylko organizator)');
    err.status = 403;
    throw err;
  }
}

export async function getMyRoles(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const me = req.user?.id;
    if (!me) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await prisma.tournamentuserrole.findMany({
      where: { tournamentId, userId: me },
      select: { id: true, role: true, userId: true }
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Nie udało się pobrać ról' });
  }
}

export async function listRoles(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    await assertOrganizerPerm(tournamentId, req.user.id);
    const roles = await roleSvc.getRolesForTournament(tournamentId);
    res.json(roles);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function addRole(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const callerId = Number(req.user?.id);
    if (!Number.isFinite(tournamentId)) {
      return res.status(400).json({ error: 'Nieprawidłowe ID turnieju' });
    }

    const org = await prisma.tournament.findFirst({
      where: {
        id: tournamentId,
        OR: [
          { organizer_id: callerId },
          { tournamentUserRoles: { some: { userId: callerId, role: 'organizer' } } }
        ]
      },
      select: { id: true }
    });
    if (!org) return res.status(403).json({ error: 'Brak uprawnień' });

    const { userId, role } = req.body || {};
    if (!userId || !role) return res.status(400).json({ error: 'Brak userId lub role' });

    const exists = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId, role },
    });
    if (exists) return res.json(exists);

    const created = await roleSvc.addRole(tournamentId, userId, role);

    if (role === 'referee') {
      const tour = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, name: true }
      });

      await notif.createNotification({
        userId,
        type: 'referee_added', 
        title: 'Dodano Cię jako sędziego',
        body: `Zostałeś dodany jako sędzia w turnieju: ${tour?.name || 'Turniej'}`,
        link: `/tournaments/${tournamentId}/details`,
        meta: { tournamentId }
      });
    }

    return res.status(201).json(created);
  } catch (e) {
    console.error('[addRole] error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Błąd dodawania roli' });
  }
}


export async function removeRole(req, res) {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);
      const role = req.params.role;
      await assertOrganizerPerm(tournamentId, req.user.id);

      if (!userId || !role) return res.status(400).json({ error: 'Brak userId lub role' });

      const result = await roleSvc.removeRole(tournamentId, userId, role);
      res.json({ deleted: result.count ?? result }); 
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }


  export async function removeRoleById(req, res) {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      const roleRecordId = parseInt(req.params.roleId, 10);
      await assertOrganizerPerm(tournamentId, req.user.id);
      if (Number.isNaN(roleRecordId)) {
        return res.status(400).json({ error: 'Nieprawidłowe roleId' });
      }
      const rec = await prisma.tournamentuserrole.findUnique({ where: { id: roleRecordId } });
      if (!rec || rec.tournamentId !== tournamentId) {
        return res.status(404).json({ error: 'Rola nie istnieje w tym turnieju' });
      }
      await roleSvc.removeRoleById(roleRecordId);
      res.json({ deleted: 1 });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  }

  export async function inviteReferee(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    const tour = await prisma.tournament.findUnique({
      where: { id: tournamentId }, select: { id: true, name: true, organizer_id: true }
    });
    if (!tour) return res.status(404).json({ error: 'Turniej nie istnieje' });

    await notif.createNotification({
      userId,
      type: 'referee_invite',
      title: 'Zaproszenie do sędziowania',
      body: `Organizator zaprasza Cię do sędziowania: ${tour.name}`,
      link: `/tournaments/${tournamentId}/details`,
      meta: { tournamentId, invitedBy: req.user.id }
    });

    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[inviteReferee]', e);
    res.status(500).json({ error: 'Nie udało się wysłać zaproszenia' });
  }
}

export async function acceptRefereeInvite(req, res) {
   console.log('[acceptRefereeInvite] params:', req.params, 'user:', req.user?.id);
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const me = req.user.id;

    const exists = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId: me, role: 'referee' }
    });
    if (exists) return res.json(exists);

    const created = await roleSvc.addRole(tournamentId, me, 'referee');

    // notyfikacja do organizatora
    const orgs = await prisma.tournamentuserrole.findMany({
      where: { tournamentId, role: 'organizer' }, select: { userId: true }
    });
    await Promise.all(orgs.map(o => notif.createNotification({
      userId: o.userId,
      type: 'referee_joined',
      title: 'Sędzia zaakceptował zaproszenie',
      body: `Sędzia dołączył do turnieju.`,
      link: `/tournaments/${tournamentId}/details`,
      meta: { tournamentId, refereeId: me }
    })));

    return res.status(201).json(created);
  } catch (e) {
    console.error('[acceptRefereeInvite]', e);
    res.status(500).json({ error: 'Nie udało się zaakceptować' });
  }
}

// ODRZUCENIE zaproszenia sędziego
export async function declineRefereeInvite(req, res) {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const me = req.user.id;

    // info dla organizatorów
    const orgs = await prisma.tournamentuserrole.findMany({
      where: { tournamentId, role: 'organizer' }, select: { userId: true }
    });
    await Promise.all(orgs.map(o => notif.createNotification({
      userId: o.userId,
      type: 'referee_declined',
      title: 'Sędzia odrzucił zaproszenie',
      body: `Sędzia odrzucił zaproszenie do turnieju.`,
      link: `/tournaments/${tournamentId}/details`,
      meta: { tournamentId, refereeId: me }
    })));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[declineRefereeInvite]', e);
    res.status(500).json({ error: 'Nie udało się odrzucić' });
  }
}

// WYPISANIE SIĘ sędziego po akceptacji (usuń rolę)
export async function resignAsReferee(req, res) {
  console.log('[resignAsReferee] params:', req.params, 'user:', req.user?.id);
  try {
    const tournamentId = parseInt(req.params.id, 10);
    const me = req.user.id;

    const row = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId, userId: me, role: 'referee' }
    });
    if (!row) return res.status(404).json({ error: 'Nie masz roli sędziego w tym turnieju' });

    await prisma.tournamentuserrole.delete({ where: { id: row.id } });

    // powiadom organizatorów
    const orgs = await prisma.tournamentuserrole.findMany({
      where: { tournamentId, role: 'organizer' }, select: { userId: true }
    });
    await Promise.all(orgs.map(o => notif.createNotification({
      userId: o.userId,
      type: 'referee_resigned',
      title: 'Sędzia zrezygnował',
      body: `Sędzia wypisał się z turnieju.`,
      link: `/tournaments/${tournamentId}/details`,
      meta: { tournamentId, refereeId: me }
    })));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[resignAsReferee]', e);
    res.status(500).json({ error: 'Nie udało się wypisać' });
  }
}
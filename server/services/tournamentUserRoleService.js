// server/services/tournmanetUserRoleService.js
import prisma from '../prismaClient.js';

/**
 * Dodanie roli użytkownikowi w turnieju.
 */
export async function addRole(tournamentId, userId, role) {
  const exists = await prisma.tournamentuserrole.findFirst({
    where: { tournamentId, userId, role },
  });
  if (exists) return exists;
  return prisma.tournamentuserrole.create({
    data: { tournamentId, userId, role },
  });
}

/**
 * Usuwa konkretną rolę użytkownika w danym turnieju.
 */
export async function removeRole(tournamentId, userId, role) {
  return prisma.tournamentuserrole.deleteMany({
    where: { tournamentId, userId, role },
  });
}

/**
 * Usuwanie po ID rekordu roli
 */
export async function removeRoleById(roleRecordId) {
  return prisma.tournamentuserrole.delete({
    where: { id: roleRecordId },
  });
}

export async function getRolesForTournament(tournamentId) {
  const rows = await prisma.tournamentuserrole.findMany({
    where: { tournamentId },
    include: {
      user: { select: { id: true, name: true, surname: true, email: true } },
    },
    orderBy: { id: 'asc' },
  });

  // dopasowanie do formatu, którego używa front 
  return rows.map(r => ({
    id: r.id,
    tournamentId: r.tournamentId,
    role: r.role,
    user: r.user,
  }));
}

/**
 * Role użytkownika we wszystkich turniejach 
 */
export async function getRolesForUser(userId) {
  return prisma.tournamentuserrole.findMany({
    where: { userId },
    include: {
      tournament: { select: { id: true, name: true } },
    },
  });
}

export const listRoles = getRolesForTournament;

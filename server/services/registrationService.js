// server/services/registrationService.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function createRegistration(
  tournamentId,
  userId,
  regStatus = 'pending',
  extra = {}
) {
  return prisma.tournamentregistration.create({
    data: {
      tournamentId,
      userId,
      status: regStatus,
    },
  });
}

export async function findByTournamentAndUser(tournamentId, userId) {
  return prisma.tournamentregistration.findFirst({
    where: {
      tournamentId,
      userId,
    },
  });
}

export async function findById(registrationId) {
  return prisma.tournamentregistration.findUnique({
    where: { id: registrationId },
  });
}

export async function findByIdWithUser(registrationId) {
  return prisma.tournamentregistration.findUnique({
    where: { id: registrationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
    },
  });
}

export async function findByUser(userId) {
  return prisma.tournamentregistration.findMany({
    where: { userId },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// server/services/registrationService.js
export async function getRegistrationsByTournament(tournamentId) {
  return prisma.tournamentregistration.findMany({
    where: { tournamentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          gender: true,
          preferredCategory: true,
          guardiansAsPlayer: {
            where: { tournamentId, status: 'accepted' },
            select: {
              guardian: { select: { id: true, name: true, surname: true, email: true } },
              status: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}


export async function updateRegistrationStatus(registrationId, newStatus) {
  return prisma.tournamentregistration.update({
    where: { id: registrationId },
    data: { status: newStatus },
  });
}

export async function deleteRegistration(registrationId) {
  return prisma.tournamentregistration.delete({
    where: { id: registrationId },
  });
}

export const countAcceptedRegistrations = async (tournamentId) => {
  try {
    const count = await prisma.tournamentregistration.count({
      where: {
        tournamentId: parseInt(tournamentId),
        status: 'accepted'
      }
    });
    console.log('DEBUG: Count:', count);
    return count;
  } catch (error) {
    console.error('💥 [countAcceptedRegistrations] wyjątek:', error);
    throw error;
  }
};

export async function findAllByUser(userId) {
  return prisma.tournamentregistration.findMany({
    where: { userId },
    include: {
      tournament: {
        include: {
          categories: true, // <<< TO
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  });
}

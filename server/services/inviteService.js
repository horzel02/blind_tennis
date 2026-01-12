// server/services/inviteService.js
import prisma from '../prismaClient.js';

export async function addParticipant(tournamentId, userId, organizerId) {
  // 1. Sprawdź, że turniej istnieje i należy do organizerId
  const tour = await prisma.tournament.findUnique({
    where: { id: tournamentId }
  });
  if (!tour || tour.organizer_id !== organizerId) {
    throw new Error('Nie masz uprawnień do tego turnieju');
  }

  // 2. Sprawdź limit miejsc i czy user już jest dodany
  const exists = await prisma.tournamentregistration.findFirst({
    where: { tournamentId, userId }
  });
  if (exists) {
    if (exists.status === 'accepted') {
      throw new Error('Ten zawodnik jest już zakwalifikowany do turnieju');
    }
    if (exists.status === 'pending') {
      throw new Error('Ten zawodnik sam wysłał zgłoszenie i czeka na akceptację');
    }
    if (exists.status === 'invited') {
      throw new Error('Ten zawodnik otrzymał już zaproszenie');
    }
  }

  // 3. Tworzymy rekord ze statusem invited, nie od razu accepted
  return prisma.tournamentregistration.create({
    data: {
      tournamentId,
      userId,
      status: 'invited',
      invitedBy: organizerId
    }
  });
}

// server/controllers/inviteController.js
import * as inviteService from '../services/inviteService.js';

export async function addParticipant(req, res) {
  const { tournamentId } = req.params;
  const { userId } = req.body;
  const organizerId = req.user.id;

  try {
    const registration = await inviteService.addParticipant(
      Number(tournamentId),
      Number(userId),
      organizerId
    );
    res.json(registration);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

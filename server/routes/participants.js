// server/routes/participants.js
import express from 'express';
import { ensureAuth, isOrganizer } from '../middlewares/auth.js';
import { addParticipant } from '../controllers/inviteController.js';

const router = express.Router();

// POST /api/tournaments/:tournamentId/participants
router.post(
  '/:tournamentId/participants',
  ensureAuth,
  isOrganizer,
  addParticipant
);

export default router;

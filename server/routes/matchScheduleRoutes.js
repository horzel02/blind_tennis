// server/routes/matchScheduleRoutes.js
import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.js';
import {
  setMatchSchedule,
  clearMatchSchedule,
  autoScheduleTournament
} from '../controllers/matchScheduleController.js';

const router = Router();

// pojedynczy mecz: ustaw / wyczyść
router.put('/matches/:matchId/schedule', ensureAuth, setMatchSchedule);
router.delete('/matches/:matchId/schedule', ensureAuth, clearMatchSchedule);

// auto-rozpiska całego turnieju
router.post('/tournaments/:id/schedule/auto', ensureAuth, autoScheduleTournament);

export default router;

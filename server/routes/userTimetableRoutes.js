// server/routes/userTimetableRoutes.js
import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.js';
import { getMyMatches } from '../controllers/userTimetableController.js';

const router = Router();

router.get('/my/matches', ensureAuth, getMyMatches);

export default router;

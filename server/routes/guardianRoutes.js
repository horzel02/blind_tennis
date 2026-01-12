// server/routes/guardianRoutes.js
import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.js'; // masz to już
import * as guardianController from '../controllers/guardianController.js';

const router = Router();

// LISTA opiekunów (opcjonalne filtry)
router.get('/', ensureAuth, guardianController.list);

// ZAPROSZENIE / PODPIĘCIE opiekuna
router.post('/invite', ensureAuth, guardianController.invite);

// AKCJE po stronie opiekuna
router.post('/:id/accept', ensureAuth, guardianController.accept);
router.post('/:id/decline', ensureAuth, guardianController.decline);

// USUŃ relację (organizer / zawodnik / sam opiekun)
router.delete('/:id', ensureAuth, guardianController.remove);

router.delete('/:id/resign', ensureAuth, guardianController.resignGuardian);

export default router;

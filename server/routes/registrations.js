// server/routes/registrations.js
import { Router } from 'express';
import {
  updateRegistrationStatus,
  deleteRegistration,
  getAllMyRegistrations   // ← nazwa musi się zgadzać z kontrolerem
} from '../controllers/registrationController.js';
import { ensureAuth } from '../middlewares/auth.js';

const router = Router();

// PATCH /api/registrations/:regId
router.patch('/:regId', ensureAuth, updateRegistrationStatus);

// DELETE /api/registrations/:regId
router.delete('/:regId', ensureAuth, deleteRegistration);

// GET /api/registrations/mine
router.get('/mine', ensureAuth, getAllMyRegistrations);

export default router;

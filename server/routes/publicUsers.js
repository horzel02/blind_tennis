// server/routes/publicUsers.js
import { Router } from 'express';
import * as publicUserController from '../controllers/publicUserController.js';

const router = Router();

// Public: profil użytkownika (ID w URL)
router.get('/users/:id', publicUserController.getPublicProfile);

export default router;

// server/routes/tournamentUserRoles.js
import { Router } from 'express';
import {
  listRoles,
  addRole,
  removeRole,
  removeRoleById,
  inviteReferee,
  acceptRefereeInvite,
  declineRefereeInvite,
  resignAsReferee,
  getMyRoles,
} from '../controllers/tournamentUserRoleController.js';
import { ensureAuth } from '../middlewares/auth.js';
import { ensureTournyOrg } from './tournaments.js';

const router = Router({ mergeParams: true });

// --- SPECYFICZNE ---
router.post('/referee/invite',  ensureAuth, ensureTournyOrg, inviteReferee);
router.post('/referee/accept',  ensureAuth, acceptRefereeInvite);
router.post('/referee/decline', ensureAuth, declineRefereeInvite);
router.delete('/referee/self',  ensureAuth, resignAsReferee);

// opcjonalnie: moje role (dla zalogowanego)
if (typeof getMyRoles === 'function') {
  router.get('/me', ensureAuth, getMyRoles);
}

// --- OGÓLNE ---
router.get('/',  ensureAuth, ensureTournyOrg, listRoles);
router.post('/', ensureAuth, ensureTournyOrg, addRole);

router.delete('/:role/:userId', ensureAuth, ensureTournyOrg, removeRole);
router.delete('/:roleId',       ensureAuth, ensureTournyOrg, removeRoleById);

export default router;

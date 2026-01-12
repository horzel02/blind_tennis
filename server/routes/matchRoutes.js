// server/routes/matchRoutes.js
import { Router } from 'express';
import * as matchController from '../controllers/matchController.js';
import { ensureAuth } from '../middlewares/auth.js';
import { ensureMatchRefereeOrOrganizer, ensureMatchOrganizer } from '../middlewares/matchAuth.js';
import { ensureTournyOrg } from './tournaments.js';

const router = Router();

// Generowanie grup + pusty szkielet KO 
router.post('/:tournamentId/generate-matches', ensureAuth, ensureTournyOrg, matchController.generateTournamentStructure);

// Lista meczów / pojedyńczy mecz
router.get('/:tournamentId/matches', matchController.getMatchesByTournamentId);
router.get('/:matchId', matchController.getMatchById);

// Wyniki i sędziowie
router.put('/:matchId/score', ensureAuth, ensureMatchRefereeOrOrganizer, matchController.updateMatchScore);
router.put('/:matchId/referee', ensureAuth, ensureMatchOrganizer, matchController.setMatchReferee);
router.put('/referee/bulk', ensureAuth, matchController.assignRefereeBulk);

// Tabele grupowe
router.get('/:tournamentId/group-standings', matchController.getGroupStandings);

// Zasiew KO )
router.post('/:tournamentId/seed-knockout', ensureAuth, ensureTournyOrg, matchController.seedKnockout);

// Reset KO od wybranej rundy
router.post('/:tournamentId/reset-from', ensureAuth, ensureTournyOrg, matchController.resetKnockoutFromRound);

// Ręczne parowanie i blokada
router.put('/:matchId/pairing', ensureAuth, ensureMatchOrganizer, matchController.setPairing);
router.put('/:matchId/lock', ensureAuth, ensureMatchOrganizer, matchController.setLocked);

// Kto może być wybrany do meczu KO
router.get('/:matchId/eligible', ensureAuth, ensureMatchOrganizer, matchController.getEligiblePlayersForMatch);


export default router;

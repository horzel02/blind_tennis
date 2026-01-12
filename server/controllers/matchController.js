// server/controllers/matchController.js
import prisma from '../prismaClient.js';
import * as matchService from '../services/matchService.js';

/* ------------------------------ LISTA / POJEDYNCZY ------------------------------ */

export const getMatchesByTournamentId = async (req, res) => {
  const { tournamentId } = req.params;
  const { status } = req.query;
  try {
    const matches = await matchService.getMatchesByTournamentId(tournamentId, status);
    res.status(200).json(matches);
  } catch (error) {
    console.error('Błąd pobierania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const getMatchById = async (req, res) => {
  try {
    const match = await matchService.getMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Mecz nie znaleziono.' });
    res.status(200).json(match);
  } catch (error) {
    console.error('Błąd pobierania pojedynczego meczu:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/* ----------------------------------- WYNIK ----------------------------------- */

export const updateMatchScore = async (req, res) => {
  const io = req.app.get('socketio') || req.app.get('io');
  const matchId = Number(req.params.matchId);

  try {
    // meta
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true, player1: true, player2: true },
    });
    if (!match) return res.status(404).json({ error: 'Mecz nie istnieje' });
    if (!match.player1Id || !match.player2Id) {
      return res.status(400).json({ error: 'Brak kompletu zawodników w meczu' });
    }

    // skrót: WO/DQ/RET
    const incoming = (req.body?.outcome || req.body?.resultType || '').toUpperCase();
    const outcome =
      incoming === 'WO' ? 'WALKOVER' :
        incoming === 'DQ' ? 'DISQUALIFICATION' :
          incoming === 'RET' ? 'RETIREMENT' :
            ['WALKOVER', 'DISQUALIFICATION', 'RETIREMENT', 'NORMAL'].includes(incoming) ? incoming : undefined;

    if (outcome && outcome !== 'NORMAL') {
      const winnerId = Number(req.body?.winnerId);
      if (![match.player1Id, match.player2Id].includes(winnerId)) {
        return res.status(400).json({ error: 'winnerId musi być jednym z zawodników meczu' });
      }

      // zapis wyniku (bez setów) + awans
      const updated = await matchService.updateMatchScore(matchId, {
        status: 'finished',
        winnerId,
        matchSets: [],
      });

      // typ rozstrzygnięcia
      const final = await prisma.match.update({
        where: { id: matchId },
        data: { resultType: outcome, resultNote: req.body?.note ?? null, updatedAt: new Date() },
        include: {
          matchSets: { orderBy: { setNumber: 'asc' } },
          player1: true, player2: true, winner: true, tournament: true,
        },
      });

      // emit
      io?.to(`match-${final.id}`).emit('match-updated', final);
      io?.to(`tournament-${final.tournamentId}`).emit('match-status-changed', { matchId: final.id, status: final.status });
      io?.to(`tournament-${final.tournamentId}`).emit('matches-invalidate', { reason: 'cascade' });

      // jeśli to nie KO odśwież tabele grupowe
      const r = (final.round || '').toLowerCase();
      const isKO = /(1\/(8|16|32|64)|ćwierćfina|półfina|finał)/i.test(r);
      if (!isKO) io?.to(`tournament-${final.tournamentId}`).emit('standings-invalidate', { reason: 'group-score-updated' });

      return res.json(final);
    }

    // zwykła ścieżka: sety
    const raw = Array.isArray(req.body?.sets) ? req.body.sets : req.body?.matchSets;
    if (!Array.isArray(raw) || !raw.length) {
      return res.status(400).json({ error: 'Brak danych setów (sets/matchSets)' });
    }

    const setsToWin = match.tournament?.setsToWin ?? 2;
    const gamesToWin = match.tournament?.gamesPerSet ?? 6;
    const tieBreak = (match.tournament?.tieBreakType || 'normal').toLowerCase();
    const maxSets = setsToWin * 2 - 1;
    const SUPER_TB = 10;

    const sets = raw.map((s, i) => {
      const p1 = Number(s.p1 ?? s.player1 ?? s.player1Score ?? s.player1Games);
      const p2 = Number(s.p2 ?? s.player2 ?? s.player2Score ?? s.player2Games);
      if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0) {
        throw new Error(`Nieprawidłowe wartości gemów w secie #${i + 1}`);
      }
      return { p1, p2 };
    });
    if (sets.length > maxSets) {
      return res.status(400).json({ error: `Za dużo setów. Maksymalnie ${maxSets}.` });
    }

    let p1Sets = 0, p2Sets = 0;
    for (let i = 0; i < sets.length; i++) {
      const { p1, p2 } = sets[i];
      if (p1 === p2) return res.status(400).json({ error: `Remis w secie #${i + 1} jest niedozwolony` });

      // czy to decider z super TB?
      const isDecider = (tieBreak === 'super_tie_break')
        && (i === sets.length - 1)
        && (sets.length === maxSets)
        && (p1Sets === p2Sets);

      if (isDecider) {
        // POPRAWKA: Sprawdzamy przewagę 2 punktów
        const mx = Math.max(p1, p2);
        const mn = Math.min(p1, p2);
        // Musi mieć min. 10 pkt ORAZ 2 pkt przewagi
        const ok = (mx >= SUPER_TB) && ((mx - mn) >= 2);

        if (!ok) return res.status(400).json({ error: `Set #${i + 1}: Super TB wymaga 10 pkt i 2 pkt przewagi.` });
        if (p1 > p2) p1Sets++; else p2Sets++;
        continue;
      }

      if (tieBreak === 'no_tie_break') {
        const mx = Math.max(p1, p2), mn = Math.min(p1, p2);
        const ok = (mx >= gamesToWin) && ((mx - mn) >= 2);
        if (!ok) return res.status(400).json({ error: `Set #${i + 1}: bez TB potrzebna przewaga 2 po osiągnięciu ${gamesToWin}.` });
        if (p1 > p2) p1Sets++; else p2Sets++;
        continue;
      }

      // "normal": N:x lub (N+1):N gdy było N:N
      const mx = Math.max(p1, p2), mn = Math.min(p1, p2);
      const okNormal =
        (mx === gamesToWin && (mx - mn) >= 2)        // np. 6:4, 6:3 (musi być przewaga 2)
        || (mx === gamesToWin + 1 && mn === gamesToWin - 1) // np. 7:5
        || (mx === gamesToWin + 1 && mn === gamesToWin);    // np. 7:6 (tie-break)
      if (!okNormal) {
        return res.status(400).json({ error: `Set #${i + 1}: zwykły TB → ${gamesToWin}:x albo ${gamesToWin + 1}:${gamesToWin}.` });
      }
      if (p1 > p2) p1Sets++; else p2Sets++;

      if (p1Sets > setsToWin || p2Sets > setsToWin) {
        return res.status(400).json({ error: `Za dużo setów — ktoś już osiągnął ${setsToWin}.` });
      }
    }

    if (p1Sets < setsToWin && p2Sets < setsToWin) {
      return res.status(400).json({ error: `Wynik nie rozstrzyga meczu. Potrzebne ${setsToWin} wygrane sety.` });
    }
    const winnerId = (p1Sets === setsToWin) ? match.player1Id : match.player2Id;

    const matchSets = sets.map((s, idx) => ({
      setNumber: idx + 1,
      player1Score: s.p1,
      player2Score: s.p2,
    }));

    const updated = await matchService.updateMatchScore(matchId, {
      status: 'finished',
      winnerId,
      matchSets,
    });

    // resultType = NORMAL
    const final = await prisma.match.update({
      where: { id: matchId },
      data: { resultType: 'NORMAL', resultNote: null, updatedAt: new Date() },
      include: {
        matchSets: { orderBy: { setNumber: 'asc' } },
        player1: true, player2: true, winner: true, tournament: true,
      },
    });

    // emit
    io?.to(`match-${final.id}`).emit('match-updated', final);
    io?.to(`tournament-${final.tournamentId}`).emit('match-status-changed', { matchId: final.id, status: final.status });
    io?.to(`tournament-${final.tournamentId}`).emit('matches-invalidate', { reason: 'cascade' });

    const r = (final.round || '').toLowerCase();
    const isKO = /(1\/(8|16|32|64)|ćwierćfina|półfina|finał)/i.test(r);
    if (!isKO) io?.to(`tournament-${final.tournamentId}`).emit('standings-invalidate', { reason: 'group-score-updated' });

    return res.json(final);
  } catch (e) {
    console.error('updateMatchScore error:', e);
    return res.status(400).json({ error: e.message || 'Błąd zapisu wyniku' });
  }
};

/* --------------------------------- GENERATOR --------------------------------- */

export const generateTournamentStructure = async (req, res) => {
  const { tournamentId } = req.params;
  const io = req.app.get('socketio') || req.app.get('io');

  try {
    const t = await prisma.tournament.findUnique({
      where: { id: Number(tournamentId) },
      select: { id: true, format: true }
    });
    if (!t) return res.status(404).json({ error: 'Turniej nie znaleziono' });

    const result = (t.format === 'KO_ONLY')
      ? await matchService.generateKnockoutOnly(tournamentId)
      : await matchService.generateGroupAndKnockoutMatches(tournamentId);

    io?.to(`tournament-${Number(tournamentId)}`).emit('matches-invalidate', { reason: 'generate' });
    if (t.format !== 'KO_ONLY') {
      io?.to(`tournament-${Number(tournamentId)}`).emit('standings-invalidate', { reason: 'generate' });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Błąd generowania meczów:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

/* --------------------------------- SĘDZIOWIE --------------------------------- */

export const setMatchReferee = async (req, res) => {
  const io = req.app.get('socketio') || req.app.get('io');
  const { matchId } = req.params;
  const { refereeId } = req.body;

  try {
    const meta = await prisma.match.findUnique({
      where: { id: Number(matchId) },
      select: { id: true, tournamentId: true, player1Id: true, player2Id: true },
    });
    if (!meta) return res.status(404).json({ error: 'Mecz nie znaleziono' });

    if (refereeId != null) {
      const rid = Number(refereeId);
      if (rid === meta.player1Id || rid === meta.player2Id) {
        return res.status(409).json({ error: 'Wybrany użytkownik jest zawodnikiem w tym meczu' });
      }
      const hasRefRole = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: meta.tournamentId, userId: rid, role: 'referee' },
        select: { id: true },
      });
      if (!hasRefRole) {
        return res.status(400).json({ error: 'Wybrany użytkownik nie ma roli sędziego w tym turnieju' });
      }
    }

    const updated = await matchService.setMatchReferee(matchId, refereeId);
    const payload = updated.referee
      ? { matchId: updated.id, referee: { id: updated.referee.id, name: updated.referee.name, surname: updated.referee.surname } }
      : { matchId: updated.id, referee: null };

    io?.to(`tournament-${updated.tournamentId}`).emit('match-referee-changed', payload);
    io?.to(`match-${updated.id}`).emit('match-referee-changed', payload);

    res.status(200).json(updated);
  } catch (error) {
    console.error('Błąd przypisywania sędziego:', error);
    res.status(500).json({ error: error.message || 'Błąd serwera' });
  }
};

export const assignRefereeBulk = async (req, res) => {
  const io = req.app.get('socketio') || req.app.get('io');
  const { tournamentId, matchIds, refereeId } = req.body;

  try {
    const tId = parseInt(tournamentId, 10);
    if (!tId || !Array.isArray(matchIds) || matchIds.length === 0) {
      return res.status(400).json({ error: 'Brak danych: tournamentId i matchIds są wymagane' });
    }

    const isOrg = await prisma.tournamentuserrole.findFirst({
      where: { tournamentId: tId, userId: req.user.id, role: 'organizer' },
      select: { id: true },
    });
    if (!isOrg) return res.status(403).json({ error: 'Brak uprawnień' });

    const ids = matchIds.map(n => parseInt(n, 10)).filter(Boolean);

    const matches = await prisma.match.findMany({
      where: { tournamentId: tId, id: { in: ids } },
      select: { id: true, player1Id: true, player2Id: true },
    });
    if (!matches.length) return res.json({ updated: 0, skipped: ids });

    const refId = refereeId == null ? null : parseInt(refereeId, 10);

    if (refId != null) {
      const hasRefRole = await prisma.tournamentuserrole.findFirst({
        where: { tournamentId: tId, userId: refId, role: 'referee' },
        select: { id: true },
      });
      if (!hasRefRole) {
        return res.status(400).json({ error: 'Wybrany użytkownik nie ma roli sędziego w tym turnieju' });
      }
    }

    const allowed = refId == null
      ? matches.map(m => m.id)
      : matches.filter(m => !(refId === m.player1Id || refId === m.player2Id)).map(m => m.id);

    const skipped = ids.filter(mid => !allowed.includes(mid));
    if (!allowed.length) return res.json({ updated: 0, skipped });

    const updatedMatches = await prisma.$transaction(
      allowed.map(mid =>
        prisma.match.update({
          where: { id: mid },
          data: { refereeId: refId, updatedAt: new Date() },
          include: { referee: { select: { id: true, name: true, surname: true } }, tournament: { select: { id: true } } },
        })
      )
    );

    for (const m of updatedMatches) {
      const payload = m.referee
        ? { matchId: m.id, referee: { id: m.referee.id, name: m.referee.name, surname: m.referee.surname } }
        : { matchId: m.id, referee: null };
      io?.to(`tournament-${tId}`).emit('match-referee-changed', payload);
      io?.to(`match-${m.id}`).emit('match-referee-changed', payload);
    }

    io?.to(`tournament-${tId}`).emit('matches-invalidate', { reason: 'referee-bulk' });

    res.json({ updated: updatedMatches.length, skipped });
  } catch (e) {
    console.error('assignRefereeBulk error:', e);
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

/* --------------------------------- GRUPY/KO --------------------------------- */

export const getGroupStandings = async (req, res) => {
  try {
    const rows = await matchService.getGroupStandings(req.params.tournamentId);
    res.json(rows);
  } catch (e) {
    console.error('getGroupStandings error:', e);
    res.status(500).json({ error: e.message || 'Błąd serwera' });
  }
};

// SEED KO z grup (top2), wspiera opcje w body:
export const seedKnockout = async (req, res) => {
  try {
    const io = (req.app.get('socketio') || req.app.get('io'));
    const out = await matchService.seedKnockout(req.params.tournamentId, req.body || {});

    // doślij świeże mecze tej rundy, żeby FE się odświeżył
    const matches = await prisma.match.findMany({
      where: {
        tournamentId: Number(req.params.tournamentId),
        round: { startsWith: out.baseRound },
      },
      include: {
        player1: { select: { id: true, name: true, surname: true } },
        player2: { select: { id: true, name: true, surname: true } },
        category: true,
        referee: { select: { id: true, name: true, surname: true } },
        winner: { select: { id: true, name: true, surname: true } },
        matchSets: { orderBy: { setNumber: 'asc' } },
      },
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
    });

    for (const m of matches) {
      io?.to(`tournament-${m.tournamentId}`).emit('match-updated', m);
    }

    io?.to(`tournament-${Number(req.params.tournamentId)}`).emit('matches-invalidate', { reason: 'seed' });
    res.json(out);
  } catch (e) {
    console.error('seedKnockout error:', e);
    res.status(400).json({ error: e.message || 'Błąd zasiewania drabinki' });
  }
};

// Reset KO od wskazanej rundy
export const resetKnockoutFromRound = async (req, res) => {
  const io = req.app.get('socketio') || req.app.get('io');
  try {
    const { from } = req.body || {};
    const out = await matchService.resetKnockoutFromRound(req.params.tournamentId, from);
    io?.to(`tournament-${Number(req.params.tournamentId)}`)
      .emit('matches-invalidate', { reason: 'reset-from', from: out.from });
    res.json(out);
  } catch (e) {
    console.error('resetKnockoutFromRound error:', e);
    res.status(400).json({ error: e.message || 'Błąd resetu od etapu' });
  }
};

/* ------------------------------- PAIRING/LOCK ------------------------------- */

export const setPairing = async (req, res) => {
  try {
    const { player1Id = null, player2Id = null } = req.body || {};
    const io = req.app.get('socketio') || req.app.get('io');
    const updated = await matchService.setPairing(req.params.matchId, { player1Id, player2Id });

    io?.to(`match-${updated.id}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('matches-invalidate', { reason: 'pairing' });
    res.json(updated);
  } catch (e) {
    console.error('setPairing error:', e);
    res.status(400).json({ error: e.message || 'Błąd ustawiania pary' });
  }
};

export const setLocked = async (req, res) => {
  try {
    const { locked = true } = req.body || {};
    const io = req.app.get('socketio') || req.app.get('io');
    const updated = await matchService.setLocked(req.params.matchId, !!locked);

    io?.to(`match-${updated.id}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('match-updated', updated);
    io?.to(`tournament-${updated.tournamentId}`).emit('matches-invalidate', { reason: 'lock' });
    res.json(updated);
  } catch (e) {
    console.error('setLocked error:', e);
    res.status(400).json({ error: e.message || 'Błąd blokowania meczu' });
  }
};

/* ------------------------------- ELIGIBLE LIST ------------------------------ */

export const getEligiblePlayersForMatch = async (req, res) => {
  try {
    const list = await matchService.getEligiblePlayersForMatch(req.params.matchId);
    res.json(list);
  } catch (e) {
    console.error('getEligiblePlayersForMatch error:', e);
    res.status(400).json({ error: e.message || 'Błąd pobierania dopuszczonych' });
  }
};

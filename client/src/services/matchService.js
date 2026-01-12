// client/src/services/matchService.js
import { api, jfetch } from "./api";

const MATCHES_API = api("/api/matches");
const TOURNAMENTS_API = api("/api/tournaments");

/* ========================================================================== */
/*                         LISTY / WIDOKI PER-TURNIEJ                         */
/* ========================================================================== */

export async function getMatchesByTournamentId(tournamentId, status) {
  // bezpiecznie: query bez new URL
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return jfetch(`/api/tournaments/${tournamentId}/matches${qs}`);
}

export async function getGroupStandings(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/group-standings`);
}

export async function generateGroupsAndKO(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/generate-matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
export const generateTournamentStructure = generateGroupsAndKO;

export async function generateKnockoutOnly(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/generate-ko-only`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function seedKnockout(tournamentId, options = {}) {
  return jfetch(`/api/tournaments/${tournamentId}/seed-knockout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export async function resetKnockoutFromRound(tournamentId, from) {
  return jfetch(`/api/tournaments/${tournamentId}/reset-knockout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from }),
  });
}
export const resetFromStage = resetKnockoutFromRound;

export async function resetGroupPhase(tournamentId, alsoKO = true) {
  return jfetch(`/api/tournaments/${tournamentId}/reset-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alsoKO }),
  });
}

/* ========================================================================== */
/*                          OPERACJE NA POJEDYNCZYM MECZU                     */
/* ========================================================================== */

export async function getMatchById(matchId) {
  return jfetch(`${MATCHES_API}/${matchId}`);
}

export async function updateMatchScore(matchId, updateData) {
  return jfetch(`${MATCHES_API}/${matchId}/score`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });
}

export async function setPairing(matchId, { player1Id, player2Id }) {
  return jfetch(`${MATCHES_API}/${matchId}/pairing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player1Id, player2Id }),
  });
}

export async function setLocked(matchId, locked) {
  return jfetch(`${MATCHES_API}/${matchId}/lock`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locked }),
  });
}

export async function assignRefereeBulk({ tournamentId, matchIds, refereeId = null }) {
  if (!tournamentId) throw new Error("Brak tournamentId");
  if (!Array.isArray(matchIds) || matchIds.length === 0) throw new Error("Brak matchIds");

  const payload = {
    tournamentId: Number(tournamentId),
    matchIds: matchIds.map(Number).filter(Boolean),
    refereeId: refereeId === "" || refereeId === undefined ? null : Number(refereeId),
  };

  return jfetch(`${MATCHES_API}/referee/bulk`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function generateKnockoutSkeleton(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/generate-ko-skeleton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function getEligiblePlayersForMatch(matchId) {
  return jfetch(`${MATCHES_API}/${matchId}/eligible`);
}

export const setMatchRefereeBulk = (tournamentId, matchIds, refereeId) =>
  assignRefereeBulk({ tournamentId, matchIds, refereeId });

// client/src/services/tournamentService.js
import { api, jfetch } from "./api";

const TOURNAMENTS_API = api("/api/tournaments");

export async function getAllTournaments() {
  return jfetch(`${TOURNAMENTS_API}`);
}

export async function getMyTournaments() {
  return jfetch(`${TOURNAMENTS_API}/mine`);
}

export async function getTournamentById(id) {
  return jfetch(`${TOURNAMENTS_API}/${id}`);
}

export async function createTournament(data) {
  return jfetch(`${TOURNAMENTS_API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateTournament(id, data) {
  return jfetch(`${TOURNAMENTS_API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteTournament(id) {
  return jfetch(`${TOURNAMENTS_API}/${id}`, { method: "DELETE" });
}

export async function addParticipant(tournamentId, userId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

/* ----- SETTINGS ----- */
export async function getTournamentSettings(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/settings`);
}

/* ----- GENERATORY / KO / RESETY ----- */
export async function generateGroupsAndKO(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-matches`, {
    method: "POST",
  });
}

export async function seedKnockout(tournamentId, body = {}) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/seed-knockout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function generateKnockoutOnly(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-ko-only`, {
    method: "POST",
  });
}

export async function resetKnockoutFromRound(tournamentId, fromLabel) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/reset-knockout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromLabel }),
  });
}

// client/src/services/tournamentUserRoleService.js
import { api } from "./api";
import { jfetch } from './api';

const TOURN_BASE = api("/api/tournaments");

export async function getMyRoles(tournamentId) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles/me`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

export async function listRoles(tournamentId) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

// Dodaj rolę
export async function addRole(tournamentId, userId, role) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

// Usuń rolę po 
export async function removeRole(tournamentId, userId, role) {
  const res = await fetch(
    `${TOURN_BASE}/${tournamentId}/roles/${encodeURIComponent(role)}/${userId}`,
    { method: 'DELETE', credentials: 'include' }
  );
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

async function readErr(res) {
  try {
    const j = await res.json();
    return j.error || j.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function inviteReferee(tournamentId, userId) {
  return jfetch(`/api/tournaments/${tournamentId}/roles/referee/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

export async function acceptRefereeInvite(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/roles/referee/accept`, {
    method: "POST",
  });
}

export async function declineRefereeInvite(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/roles/referee/decline`, {
    method: "POST",
  });
}

export async function resignAsReferee(tournamentId) {
  return jfetch(`/api/tournaments/${tournamentId}/roles/referee/self`, {
    method: "DELETE",
  });
}


// client/src/services/adminService.js
import { api } from './api';

const ADMIN = api('/api/admin');

async function readErr(res) {
  try { const j = await res.json(); return j.error || j.message || res.statusText; }
  catch { return res.statusText; }
}

// USERS
export async function listUsers({ query = '', role = '', active = '', page = 1, limit = 25 } = {}) {
  const u = new URL(`${ADMIN}/users`);
  if (query) u.searchParams.set('query', query);
  if (role) u.searchParams.set('role', role);
  if (active) u.searchParams.set('active', active);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  const r = await fetch(u, { credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}


export async function setUserActive(id, active) {
  const r = await fetch(`${ADMIN}/users/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ active })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function setUserRole(id, role) {
  const r = await fetch(`${ADMIN}/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

// TOURNAMENTS
export async function listTournaments({ query = '', page = 1, limit = 25 } = {}) {
  const u = new URL(`${ADMIN}/tournaments`);
  if (query) u.searchParams.set('query', query);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  const r = await fetch(u, { credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function deleteTournament(id) {
  const r = await fetch(`${ADMIN}/tournaments/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function setTournamentHidden(id, hidden, applicationsOpen) {
  const body = {};
  if (typeof hidden === 'boolean') body.hidden = hidden;
  if (typeof applicationsOpen === 'boolean') body.applicationsOpen = applicationsOpen;
  const r = await fetch(`${ADMIN}/tournaments/${id}/hide`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function softDeleteTournament(id) {
  const r = await fetch(`${ADMIN}/tournaments/${id}/delete`, {
    method: 'PATCH',
    credentials: 'include'
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function setUserPassword(id, password) {
  const r = await fetch(`${ADMIN}/users/${id}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

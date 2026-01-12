// client/src/services/registrationService.js
import { api } from "./api";

const REGISTRATION_API = api("/api/registrations");
const TOURNAMENT_API_PREFIX = api("/api/tournaments");

export async function createRegistration(tournamentId) {
  const res = await fetch(`${TOURNAMENT_API_PREFIX}/${tournamentId}/registrations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd podczas wysyłania zgłoszenia');
  }
  return res.json();
}

export async function getRegistrationsByTournament(tournamentId) {
  const res = await fetch(`${TOURNAMENT_API_PREFIX}/${tournamentId}/registrations`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd pobierania zgłoszeń');
  }
  return res.json();
}

export async function updateRegistrationStatus(regId, data) {
  const res = await fetch(`${REGISTRATION_API}/${regId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd aktualizacji zgłoszenia');
  }
  return res.json();
}

export async function deleteRegistration(regId) {
  const res = await fetch(`${REGISTRATION_API}/${regId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd usuwania zgłoszenia');
  }
  return res.json();
}

export async function getAcceptedCount(tournamentId) {
  const res = await fetch(`${TOURNAMENT_API_PREFIX}/${tournamentId}/registrations/count`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd pobierania liczby uczestników');
  }
  const json = await res.json();
  return json.acceptedCount;
}

export async function getMyRegistration(tournamentId) {
  const res = await fetch(`${TOURNAMENT_API_PREFIX}/${tournamentId}/registrations/me`, {
    credentials: 'include'
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd pobierania mojego zgłoszenia');
  }
  return res.json();
}

export async function inviteUser(tournamentId, userId) {
  const res = await fetch(`${TOURNAMENT_API_PREFIX}/${tournamentId}/invite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Błąd zaproszenia gracza');
  }
  return res.json();
}

export async function getMyRegistrations() {
  const res = await fetch(`${REGISTRATION_API}/mine`, {
    credentials: 'include'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Błąd pobierania Twoich zgłoszeń')
  }
  return res.json()
}
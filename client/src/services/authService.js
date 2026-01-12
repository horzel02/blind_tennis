// client/src/services/authService.js
import { api } from './api';

const AUTH_API = api('/api/auth');

export const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_RULE_MESSAGE =
  'Hasło musi mieć min. 8 znaków, zawierać małą i dużą literę, cyfrę oraz znak specjalny.';

export function validatePasswordComplexity(password) {
  return PASSWORD_RULE.test(password || '');
}

export async function register(data) {
  const res = await fetch(`${AUTH_API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Rejestracja nieudana.');
  }
  return payload;
}

export async function login(data) {
  const res = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const payload = await res.json();

  if (!res.ok) {
    const error = new Error(payload.message || 'Logowanie nieudane.');
    error.status = res.status;
    throw error;
  }
  return payload.user ?? payload;
}

export async function logout() {
  await fetch(`${AUTH_API}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchProfile() {
  const res = await fetch(`${AUTH_API}/profile`, {
    credentials: 'include'
  });
  if (res.status === 401) {
    const err = new Error('Nieautoryzowany');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error('Błąd pobierania profilu');
  return res.json();
}

export async function changePassword(data) {
  const res = await fetch(`${AUTH_API}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Nie udało się zmienić hasła.');
  }
  return payload;
}

export async function updatePreferences(data) {
  const res = await fetch(`${AUTH_API}/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Nie udało się zapisać preferencji.');
  }
  return payload;
}

// client/src/services/userService.js
import { api } from "./api";

const BASE = api("/api/users");

export async function searchUsers(query) {
  const res = await fetch(`${BASE}?search=${encodeURIComponent(query)}`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd wyszukiwania użytkowników');
  }
  return res.json();
}
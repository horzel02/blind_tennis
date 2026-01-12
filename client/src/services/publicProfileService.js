// client/src/services/PublicProfileService.js
import { api } from "./api";

async function readErr(res) {
  try {
    const j = await res.json();
    return j?.error || j?.message || res.statusText || "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}

/**
 * Public profile endpoint:
 * GET /api/public/users/:id
 *
 * Uwaga: daję credentials: 'include', bo u Ciebie session auth.
 * Jeśli to MA być totalnie publiczne bez ciastek, usuń credentials.
 */
export async function getPublicProfile(id) {
  if (!id) throw new Error("Brak id użytkownika");

  const url = api(`/api/public/users/${encodeURIComponent(id)}`);
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    throw new Error(await readErr(res));
  }
  return res.json();
}

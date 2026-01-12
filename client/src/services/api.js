// client/src/services/api.js

const ENV_ORIGIN = (import.meta?.env?.VITE_API_URL || "").replace(/\/$/, "");

// Jeśli env nie podany, lecimy po origin aktualnej strony (czyli prod: ten sam host)
const ORIGIN =
  ENV_ORIGIN ||
  (typeof window !== "undefined" ? window.location.origin : "");

/** Buduje URL do backendu. */
export const api = (path = "") => {
  if (!path) return ORIGIN; // zwróć zawsze pełny origin
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${ORIGIN}${p}`;
};

/** Origin pod Socket.IO. */
export const socketOrigin = () => ORIGIN;

/** Fetch z JSON i sensownym błędem */
export async function jfetch(pathOrUrl, opts = {}) {
  const url =
    typeof pathOrUrl === "string" && pathOrUrl.startsWith("/")
      ? api(pathOrUrl)
      : pathOrUrl;

  const res = await fetch(url, { credentials: "include", ...opts });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const err = new Error(
      data?.error || data?.message || res.statusText || "Request failed"
    );
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

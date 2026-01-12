// client/src/services/userTimetableService.js
import { jfetch } from './api';

export async function getMyMatches(params = {}) {
  const u = new URL('/api/my/matches', window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  });

  // jfetch ogarnie "/api/..." poprawnie
  return jfetch(u.pathname + u.search);
}

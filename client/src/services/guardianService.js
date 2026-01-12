// client/src/services/guardianService.js
import { jfetch } from "./api";

export const guardianApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const qs = q ? `?${q}` : "";
    return jfetch(`/api/guardians${qs}`);
  },
  invite: ({ tournamentId, playerId, guardianUserId }) =>
    jfetch(`/api/guardians/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId, playerId, guardianUserId }),
    }),
  accept: (id) =>
    jfetch(`/api/guardians/${id}/accept`, { method: "POST" }),
  decline: (id) =>
    jfetch(`/api/guardians/${id}/decline`, { method: "POST" }),
  remove: (id) =>
    jfetch(`/api/guardians/${id}`, { method: "DELETE" }),
};

export async function resign(guardianLinkId) {
  return jfetch(`/api/guardians/${guardianLinkId}/resign`, { method: "DELETE" });
}

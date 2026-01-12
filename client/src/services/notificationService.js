// client/src/services/notificationService.js
import { api } from "./api";

export async function listNotifications() {
  const r = await fetch(api("/api/notifications"), { credentials: "include" });
  if (!r.ok) throw new Error("Nie udało się pobrać powiadomień");
  return r.json();
}

export async function markRead(id) {
  const r = await fetch(api(`/api/notifications/${id}/read`), {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error("Nie udało się oznaczyć jako przeczytane");
  return r.json();
}

export async function markAllRead() {
  const r = await fetch(api("/api/notifications/mark-all-read"), {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error("Nie udało się oznaczyć wszystkich");
  return r.json();
}

export async function clearRead() {
  const r = await fetch(api("/api/notifications/clear-read"), {
    method: "DELETE",
    credentials: "include",
  });
  if (!r.ok) throw new Error("Nie udało się wyczyścić przeczytanych");
  return r.json();
}

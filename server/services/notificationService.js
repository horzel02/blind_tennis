// server/services/notificationService.js
import prisma from '../prismaClient.js';

// io jest ustawiany w index.js jako global.__io
function ioEmit(userId, evt, payload) {
  if (!global.__io) return;
  global.__io.to(`user-${userId}`).emit(evt, payload);
}

export async function createNotification({ userId, type, title, body, link, meta = {} }) {
  const row = await prisma.notification.create({
    data: { userId, type, title, body, link, meta },
  });
  ioEmit(userId, 'notif:new', row);
  return row;
}

export async function listMyNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markRead(id, userId) {
  const row = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  ioEmit(userId, 'notif:read', { id });
  return row;
}

export async function markAllRead(userId) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  ioEmit(userId, 'notif:read-all', { count });
  return { count };
}

export async function clearRead(userId) {
  const { count } = await prisma.notification.deleteMany({
    where: { userId, readAt: { not: null } },
  });
  ioEmit(userId, 'notif:clear-read', { count });
  return { count };
}

export async function resolveByContext(userId, type, predicate) {
  const all = await prisma.notification.findMany({
    where: { userId, type, resolvedAt: null },
  });
  const ids = all.filter(predicate).map(n => n.id);
  if (!ids.length) return { count: 0 };
  await prisma.notification.updateMany({
    where: { id: { in: ids } },
    data: { readAt: new Date(), resolvedAt: new Date() },
  });
  ids.forEach(id => ioEmit(userId, 'notif:read', { id }));
  return { count: ids.length };
}

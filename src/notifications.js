import { uid, nowISO } from "./utils.js";

const STORAGE_KEY = "dttv_notifications_v1";
const STORAGE_KEY_OLD = "dt" + "tz_notifications_v1";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY_OLD);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  // Migração: garante que a antiga não fique “competindo”
  localStorage.removeItem(STORAGE_KEY_OLD);
}

function normalizeNotif(n) {
  return {
    id: String(n?.id || uid()),
    type: String(n?.type || "info"), // info | warning | error | success
    title: String(n?.title || "Notificação"),
    message: String(n?.message || ""),
    createdAt: String(n?.createdAt || nowISO()),
    readAt: n?.readAt ? String(n.readAt) : ""
  };
}

export function listNotifications({ unreadOnly = false } = {}) {
  const all = loadAll()
    .map(normalizeNotif)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return unreadOnly ? all.filter((n) => !n.readAt) : all;
}

export function countUnread() {
  return listNotifications({ unreadOnly: true }).length;
}

export function addNotification({ type = "info", title = "Notificação", message = "" } = {}) {
  const all = loadAll();
  const n = normalizeNotif({ type, title, message, createdAt: nowISO() });
  all.push(n);

  // Limite para não crescer infinito
  const MAX = 200;
  if (all.length > MAX) {
    all.splice(0, all.length - MAX);
  }

  saveAll(all);
  return n;
}

export function markAsRead(id) {
  const all = loadAll();
  const idx = all.findIndex((x) => String(x?.id) === String(id));
  if (idx === -1) return;
  all[idx] = { ...all[idx], readAt: nowISO() };
  saveAll(all);
}

export function markAllAsRead() {
  const all = loadAll().map((n) => ({ ...n, readAt: n.readAt || nowISO() }));
  saveAll(all);
}

export function clearAllNotifications() {
  saveAll([]);
}


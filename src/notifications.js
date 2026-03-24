import { uid, nowISO } from "./utils.js";

const STORAGE_KEY = "dttv_notifications_v1";
const STORAGE_KEY_OLD = "dt" + "tz_notifications_v1";

async function notifySystem({ title, body, tag } = {}) {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }

  if (Notification.permission !== "granted") return false;

  // Preferir via SW quando disponível (melhor UX em PWA); fallback para Notification direta.
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(String(title || "Notificação"), {
        body: String(body || ""),
        icon: "./assets/icons/icon-192.svg",
        badge: "./assets/icons/icon-192.svg",
        tag: String(tag || "dttv-notif"),
        renotify: false
      });
      return true;
    }
  } catch {
    // ignore
  }

  try {
    new Notification(String(title || "Notificação"), { body: String(body || "") });
    return true;
  } catch {
    return false;
  }
}

function notifySystemForNotification(n) {
  const title = String(n?.title || "Notificação");
  const body = String(n?.message || "").trim();
  const tag = `dttv-notif:${String(n?.id || "")}`;
  // Fire-and-forget para manter addNotification síncrono.
  queueMicrotask(() => {
    void notifySystem({ title, body, tag });
  });
}

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
  notifySystemForNotification(n);
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


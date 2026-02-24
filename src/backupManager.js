import { exportBackup as exportDbBackup, importBackup as importDbBackup } from "./db.js";
import { uid } from "./utils.js";

const APP_ID = "dttv-agenda-servicos";
const BACKUP_VERSION = 2;

const KEY_NOTIFICATIONS = "dttv_notifications_v1";
const KEY_NOTIFICATIONS_OLD = "dt" + "tz_notifications_v1";
const KEY_DUE_STATE = "dttv_due_notifications_v1";
const KEY_DUE_STATE_OLD = "dt" + "tz_due_notifications_v1";

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function loadLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

function saveLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadNotificationsRaw() {
  const list =
    loadLocalJson(KEY_NOTIFICATIONS, null) ??
    loadLocalJson(KEY_NOTIFICATIONS_OLD, null) ??
    [];
  return Array.isArray(list) ? list : [];
}

function saveNotificationsRaw(list) {
  const arr = Array.isArray(list) ? list : [];
  saveLocalJson(KEY_NOTIFICATIONS, arr);
  try {
    localStorage.removeItem(KEY_NOTIFICATIONS_OLD);
  } catch {
    // ignore
  }
}

function loadDueStateRaw() {
  const obj =
    loadLocalJson(KEY_DUE_STATE, null) ??
    loadLocalJson(KEY_DUE_STATE_OLD, null) ??
    {};
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
}

function saveDueStateRaw(obj) {
  const value = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  saveLocalJson(KEY_DUE_STATE, value);
  try {
    localStorage.removeItem(KEY_DUE_STATE_OLD);
  } catch {
    // ignore
  }
}

function normalizeNotification(n) {
  return {
    id: String(n?.id || uid()),
    type: String(n?.type || "info"),
    title: String(n?.title || "Notificação"),
    message: String(n?.message || ""),
    createdAt: String(n?.createdAt || new Date().toISOString()),
    readAt: n?.readAt ? String(n.readAt) : ""
  };
}

function mergeNotifications(existing, incoming) {
  const byId = new Map();
  for (const n of existing) {
    const nn = normalizeNotification(n);
    byId.set(nn.id, nn);
  }
  let created = 0;
  let skipped = 0;
  for (const n of incoming) {
    const nn = normalizeNotification(n);
    if (byId.has(nn.id)) {
      skipped++;
      continue;
    }
    byId.set(nn.id, nn);
    created++;
  }
  const merged = Array.from(byId.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const MAX = 200;
  const trimmed = merged.slice(0, MAX);
  return { merged: trimmed, created, skipped };
}

function mergeDueState(existing, incoming) {
  const out = { ...(existing || {}) };
  let updated = 0;
  let created = 0;
  let skipped = 0;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  for (const [k, v] of Object.entries(incoming || {})) {
    const key = String(k);
    if (FORBIDDEN_KEYS.has(key)) {
      skipped++;
      continue;
    }
    const val = String(v || "");
    if (!val) {
      skipped++;
      continue;
    }
    if (!out[key]) {
      out[key] = val;
      created++;
      continue;
    }
    // Mantém o maior (normalmente YYYY-MM-DD), evitando regredir
    if (String(out[key]) < val) {
      out[key] = val;
      updated++;
    } else {
      skipped++;
    }
  }
  return { merged: out, created, updated, skipped };
}

export function exportFullBackup() {
  const db = exportDbBackup(); // { exportedAt, app, version, data }
  const notifications = loadNotificationsRaw();
  const dueState = loadDueStateRaw();

  return {
    exportedAt: db.exportedAt,
    app: APP_ID,
    backupVersion: BACKUP_VERSION,
    db,
    notifications,
    dueState
  };
}

export function importFullBackup(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Backup inválido (JSON).");

  // Compatibilidade:
  // - formato antigo: { exportedAt, app, version, data }
  // - formato intermediário: { exportedAt, app, version, data: {...db} }
  // - formato novo: { db: { data: {...} }, notifications: [...], dueState: {...} }
  const dbPayload =
    payload.db && typeof payload.db === "object"
      ? payload.db
      : payload;

  const dbSummary = importDbBackup(dbPayload);

  // Notificações (merge por id)
  const existingNotifs = loadNotificationsRaw();
  const incomingNotifs = Array.isArray(payload.notifications) ? payload.notifications : [];
  const notifsMerged = mergeNotifications(existingNotifs, incomingNotifs);
  saveNotificationsRaw(notifsMerged.merged);

  // Estado anti-spam (merge por chave)
  const existingDue = loadDueStateRaw();
  const incomingDue = payload.dueState && typeof payload.dueState === "object" ? payload.dueState : {};
  const dueMerged = mergeDueState(existingDue, incomingDue);
  saveDueStateRaw(dueMerged.merged);

  return {
    db: dbSummary,
    notifications: { created: notifsMerged.created, skipped: notifsMerged.skipped, total: notifsMerged.merged.length },
    dueState: { created: dueMerged.created, updated: dueMerged.updated, skipped: dueMerged.skipped }
  };
}


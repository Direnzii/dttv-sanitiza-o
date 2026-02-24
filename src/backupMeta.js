import { nowISO } from "./utils.js";
import { showToast } from "./ui/toast.js";

const KEY_LAST_BACKUP_AT = "dttv_last_backup_at_v1";

function safeGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value || ""));
  } catch {
    // ignore
  }
}

export function getLastBackupAt() {
  return safeGet(KEY_LAST_BACKUP_AT);
}

export function setLastBackupNow() {
  const v = nowISO();
  safeSet(KEY_LAST_BACKUP_AT, v);
  return v;
}

export function maybeRemindBackup({ days = 14 } = {}) {
  const last = getLastBackupAt();
  if (!last) return false;
  const lastDate = new Date(last);
  if (Number.isNaN(lastDate.getTime())) return false;

  const diffMs = Date.now() - lastDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < Number(days || 14)) return false;

  showToast(`Lembrete: faça um backup (último há ${Math.floor(diffDays)} dia(s)).`, { type: "info", timeoutMs: 4500 });
  return true;
}


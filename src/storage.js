const STORAGE_KEY = "dttv_agenda_servicos_v1";
const STORAGE_KEY_OLD = "dt" + "tz_agenda_servicos_v1";

export function getStorageKey() {
  return STORAGE_KEY;
}

export function loadRaw() {
  try {
    const cur = localStorage.getItem(STORAGE_KEY);
    if (cur) return cur;

    // Migração: lê chave antiga e move para a nova.
    const old = localStorage.getItem(STORAGE_KEY_OLD);
    if (!old) return null;
    localStorage.setItem(STORAGE_KEY, old);
    localStorage.removeItem(STORAGE_KEY_OLD);
    return old;
  } catch {
    return null;
  }
}

export function saveRaw(text) {
  localStorage.setItem(STORAGE_KEY, text);
}

export function loadJSON(fallback) {
  const raw = loadRaw();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(value) {
  saveRaw(JSON.stringify(value));
}

export function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_OLD);
}

const STORAGE_KEY = "dttz_agenda_servicos_v1";

export function getStorageKey() {
  return STORAGE_KEY;
}

export function loadRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY);
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
}

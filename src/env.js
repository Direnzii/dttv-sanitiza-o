import { EVENTS, emit } from "./state.js";

const KEY_DEV_ENV = "dttv_dev_env_v1";

function readDevEnv() {
  // Global espelhado (para ficar imediato sem depender de storage).
  if (typeof globalThis.__DTTV_DEV_ENV__ === "boolean") return globalThis.__DTTV_DEV_ENV__;
  try {
    return localStorage.getItem(KEY_DEV_ENV) === "1";
  } catch {
    return false;
  }
}

function writeDevEnv(enabled) {
  const next = Boolean(enabled);
  globalThis.__DTTV_DEV_ENV__ = next;
  try {
    localStorage.setItem(KEY_DEV_ENV, next ? "1" : "0");
  } catch {
    // ignore (storage pode estar bloqueado)
  }
  emit(EVENTS.ENV_CHANGED, { devEnv: next });
  return next;
}

// Sincroniza no load (não emite evento para não re-renderizar no boot).
try {
  globalThis.__DTTV_DEV_ENV__ = localStorage.getItem(KEY_DEV_ENV) === "1";
} catch {
  globalThis.__DTTV_DEV_ENV__ = false;
}

export function isDevEnv() {
  return readDevEnv();
}

export function setDevEnv(enabled) {
  return writeDevEnv(enabled);
}


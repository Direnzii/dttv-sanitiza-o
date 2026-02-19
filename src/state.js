const listeners = new Map();

export function on(eventName, handler) {
  const key = String(eventName);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(handler);
  return () => listeners.get(key)?.delete(handler);
}

export function emit(eventName, payload) {
  const key = String(eventName);
  for (const fn of listeners.get(key) || []) {
    try {
      fn(payload);
    } catch (err) {
      // Event bus não deve derrubar a aplicação
      console.error(err);
    }
  }
}

export const EVENTS = {
  ROUTE_CHANGED: "route_changed",
  DATA_CHANGED: "data_changed"
};

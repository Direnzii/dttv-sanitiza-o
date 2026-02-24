import { listClients, listRecords, updateClient } from "./db.js";
import { addDaysISO, addMonthsISO, formatDateBR, todayISO } from "./utils.js";
import { showToast } from "./ui/toast.js";
import { addNotification } from "./notifications.js";

const NOTIF_STORAGE_KEY = "dttv_due_notifications_v1";
const NOTIF_STORAGE_KEY_OLD = "dt" + "tz_due_notifications_v1";

function loadNotifState() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY) || localStorage.getItem(NOTIF_STORAGE_KEY_OLD) || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveNotifState(state) {
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(state || {}));
  localStorage.removeItem(NOTIF_STORAGE_KEY_OLD);
}

export function computeClientDue(client, asOfISO = todayISO(), ctx = {}) {
  const value = Number(client?.periodValue || 0);
  const unit = String(client?.periodUnit || "");
  // Regra de alertas: basear no último serviço executado.
  // Quando `ctx.startISO` for passado (mesmo vazio), NÃO fazemos fallback para `client.periodStartISO`.
  const startSource =
    ctx && Object.prototype.hasOwnProperty.call(ctx, "startISO")
      ? ctx.startISO
      : client?.periodStartISO;
  const startISO = String(startSource ?? "").slice(0, 10);

  if (!value || value <= 0) return { enabled: false };
  if (unit !== "days" && unit !== "months") return { enabled: false };
  if (!startISO) return { enabled: false };

  const dueISO = unit === "days" ? addDaysISO(startISO, value) : addMonthsISO(startISO, value);
  const now = String(asOfISO).slice(0, 10);
  const isOverdue = now >= dueISO;
  return {
    enabled: true,
    dueISO,
    isOverdue,
    value,
    unit,
    startISO,
    lastDoneAt: String(ctx?.lastDoneAt || "")
  };
}

export function getOverdueClients(asOfISO = todayISO(), { onlyWithLastDone = false } = {}) {
  const clients = listClients();

  // Busca 1x e pega o último FEITO por cliente (listRecords já vem ordenado desc por data/hora).
  const all = listRecords({ startISO: "0000-01-01", endISO: "9999-12-31" });
  const lastDoneByClient = new Map();
  for (const r of all) {
    const status = String(r?.status || "").toUpperCase();
    if (status !== "FEITO") continue;
    const cid = String(r?.clientId || "");
    if (!cid) continue;
    if (!lastDoneByClient.has(cid)) lastDoneByClient.set(cid, r);
  }

  return clients
    .map((c) => {
      const last = lastDoneByClient.get(String(c.id));
      const lastDoneAt = last
        ? `${formatDateBR(last.dateISO)}${last.timeHM ? ` ${String(last.timeHM)}` : ""}`
        : "";
      const startISO = last?.dateISO ? String(last.dateISO).slice(0, 10) : "";

      // "serviço que já foi feito": se não há FEITO, não considera para notificação
      if (onlyWithLastDone && !startISO) return { client: c, due: { enabled: false } };

      return { client: c, due: computeClientDue(c, asOfISO, { startISO, lastDoneAt }) };
    })
    .filter((x) => x.due.enabled && x.due.isOverdue);
}

async function notifySystem({ title, body }) {
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
      await reg.showNotification(title, {
        body,
        icon: "./assets/icons/icon-192.svg",
        badge: "./assets/icons/icon-192.svg",
        tag: "dttv-due",
        renotify: false
      });
      return true;
    }
  } catch {
    // ignore
  }

  try {
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

export async function testSystemNotification() {
  return await notifySystem({
    title: "DTTV — teste de notificação",
    body: "Se você viu/escutou isso, as notificações do sistema estão funcionando."
  });
}

function unitLabel(unit, value) {
  if (unit === "days") return value === 1 ? "dia" : "dias";
  if (unit === "months") return value === 1 ? "mês" : "meses";
  return "";
}

export async function runAlertsNow({ maxPerRun = 10 } = {}) {
  const now = todayISO();
  const overdue = getOverdueClients(now, { onlyWithLastDone: true });
  const notifState = loadNotifState();

  let created = 0;
  let already = 0;

  const top = overdue.slice(0, Math.max(1, Number(maxPerRun || 10)));
  for (const { client, due } of top) {
    const key = String(client.id);
    const lastDueNotified = String(notifState[key] || "");
    if (lastDueNotified === due.dueISO) {
      already++;
      continue;
    }

    const last = due.lastDoneAt ? ` Último serviço: ${due.lastDoneAt}.` : "";
    const msg = `Periodicidade atingida para "${client.name}" (${due.value} ${unitLabel(due.unit, due.value)}).${last}`;
    showToast(msg, { type: "warning", timeoutMs: 4500 });
    addNotification({
      type: "warning",
      title: "Periodicidade do cliente atingida",
      message: msg
    });

    await notifySystem({
      title: "Periodicidade do cliente atingida",
      body: msg
    });

    notifState[key] = due.dueISO;
    created++;
  }

  saveNotifState(notifState);
  return { overdue: overdue.length, created, already };
}

export function startAlerts({ intervalMs = 60_000 * 30 } = {}) {
  let timer = null;

  const check = async () => {
    const now = todayISO();
    // Apenas clientes que já têm ao menos 1 serviço FEITO.
    const overdue = getOverdueClients(now, { onlyWithLastDone: true });
    if (overdue.length === 0) return;

    const notifState = loadNotifState();

    // Notifica no máximo os 3 primeiros por ciclo para não poluir.
    const top = overdue.slice(0, 3);
    for (const { client, due } of top) {
      const key = String(client.id);
      const lastDueNotified = String(notifState[key] || "");
      if (lastDueNotified === due.dueISO) continue;

      const last = due.lastDoneAt ? ` Último serviço: ${due.lastDoneAt}.` : "";
      const msg = `Periodicidade atingida para "${client.name}" (${due.value} ${unitLabel(due.unit, due.value)}).${last}`;
      showToast(msg, { type: "warning", timeoutMs: 4500 });
      addNotification({
        type: "warning",
        title: "Periodicidade do cliente atingida",
        message: msg
      });

      await notifySystem({
        title: "Periodicidade do cliente atingida",
        body: msg
      });

      notifState[key] = due.dueISO;
    }
    saveNotifState(notifState);
  };

  // Check inicial e eventos comuns
  check();
  const onVis = () => {
    if (document.visibilityState === "visible") check();
  };
  document.addEventListener("visibilitychange", onVis);

  timer = setInterval(check, intervalMs);

  return () => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}

export function resetClientPeriodStartToday(clientId) {
  updateClient(clientId, { periodStartISO: todayISO() });
}


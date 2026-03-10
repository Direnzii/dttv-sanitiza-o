import { EVENTS, emit, on } from "./state.js";
import { exportFullBackup } from "./backupManager.js";
import { listNotifications } from "./notifications.js";
import { listRecords } from "./db.js";
import { downloadTextFile } from "./utils.js";
import { todayISO } from "./utils.js";
import { showToast } from "./ui/toast.js";
import { getRoute, navigate, setActiveNav, startRouter } from "./ui/router.js";
import { applyTheme } from "./theme.js";
import { isDevEnv, setDevEnv } from "./env.js";
import { maybeRemindBackup, setLastBackupNow } from "./backupMeta.js";

import { renderHome } from "./views/home.js";
import { renderClients } from "./views/clients.js";
import { renderServices } from "./views/services.js";
import { renderRecords } from "./views/records.js";
import { renderBudgets } from "./views/budgets.js";
import { renderBackup } from "./views/backup.js";
import { startAlerts } from "./alerts.js";
import { renderNotifications } from "./views/notifications.js";

const view = () => document.getElementById("view");

const VIEWS = {
  home: renderHome,
  clients: renderClients,
  services: renderServices,
  records: renderRecords,
  budgets: renderBudgets,
  backup: renderBackup,
  notifications: renderNotifications
};

let currentRoute = "home";

function updateNotificationsNavBadge() {
  const badge = document.getElementById("nav-badge-notifications");
  if (!badge) return;

  let total = 0;
  try {
    total += listNotifications({ unreadOnly: false }).length;
  } catch {
    // ignore
  }

  // Conta o aviso fixo "Agendamentos de hoje" como 1 (quando existir).
  try {
    const today = todayISO();
    const todayRecords = listRecords({ startISO: today, endISO: today });
    const approvedToday = todayRecords.filter((r) => String(r?.status || "").toUpperCase() === "AGENDADO");
    if (approvedToday.length > 0) total += 1;
  } catch {
    // ignore
  }

  if (total > 0) {
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.classList.add("hidden");
  }
}

function render(route) {
  currentRoute = route;
  const container = view();
  if (!container) return;
  container.innerHTML = "";
  setActiveNav(route);

  const fn = VIEWS[route] || VIEWS.home;
  fn(container);

  // Ícones (inclusive os criados dinamicamente)
  globalThis.lucide?.createIcons?.();
  applyTheme();
  updateNotificationsNavBadge();
}

function bindNav() {
  document.querySelectorAll("[data-route].nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.getAttribute("data-route")));
  });
}

function bindQuickBackup() {
  const btn = document.getElementById("btn-quick-backup");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const backup = exportFullBackup();
    downloadTextFile({
      filename: `dttv-backup-${String(backup.exportedAt).slice(0, 10)}.json`,
      mime: "application/json",
      text: JSON.stringify(backup, null, 2)
    });
    setLastBackupNow();
    showToast("Backup exportado com sucesso.", { type: "success" });
  });
}

function bindPwaInstall() {
  const btn = document.getElementById("btn-install");
  if (!btn) return;

  /** @type {BeforeInstallPromptEvent | null} */
  let deferred = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    btn.classList.remove("hidden");
    btn.classList.add("inline-flex");
  });

  btn.addEventListener("click", async () => {
    if (!deferred) {
      showToast("Instalação não disponível agora (já instalado ou navegador não suporta).", { type: "info" });
      return;
    }
    deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    btn.classList.add("hidden");
    if (choice?.outcome === "accepted") showToast("App instalado.", { type: "success" });
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    const updateBtn = document.getElementById("btn-update");

    const showUpdate = () => {
      if (!updateBtn) return;
      updateBtn.classList.remove("hidden");
      updateBtn.classList.add("inline-flex");
    };
    const hideUpdate = () => {
      if (!updateBtn) return;
      updateBtn.classList.add("hidden");
      updateBtn.classList.remove("inline-flex");
    };

    const tryUpdateNow = async () => {
      const waiting = reg.waiting;
      if (!waiting) return;
      showToast("Aplicando atualização...", { type: "info", timeoutMs: 2500 });
      waiting.postMessage({ type: "SKIP_WAITING" });
    };

    if (updateBtn) {
      updateBtn.addEventListener("click", async () => {
        await tryUpdateNow();
      });
    }

    // Se houver SW novo esperando, atualiza com um clique do usuário (sem interromper fluxo).
    if (reg.waiting) {
      showUpdate();
    }

    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          showUpdate();
        }
      });
    });

    // Quando o novo SW assumir controle, recarrega para aplicar.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      hideUpdate();
      window.location.reload();
    });
  } catch (err) {
    console.warn("SW register failed", err);
  }
}

function start() {
  bindNav();
  bindQuickBackup();
  bindPwaInstall();

  // Aplica tema o quanto antes (favicon/logo/nav).
  applyTheme();

  // Lembrete leve para fazer backup (uso normal, sem ser intrusivo).
  setTimeout(() => maybeRemindBackup({ days: 14 }), 800);

  startRouter();
  on(EVENTS.ROUTE_CHANGED, ({ route }) => render(route));
  on(EVENTS.DATA_CHANGED, () => render(currentRoute));
  on(EVENTS.ENV_CHANGED, () => render(currentRoute));

  // Primeira renderização (caso o listener seja registrado após startRouter)
  render(getRoute());
  // Mantém badge atualizado mesmo quando alertas são gerados em background.
  setInterval(updateNotificationsNavBadge, 30_000);

  registerServiceWorker();
  startAlerts();
}

// Boot
start();

// Expor um helper útil no console para debug sem poluir UI.
window.__dttv = {
  rerender: () => emit(EVENTS.DATA_CHANGED),
  navigate,
  devEnv: {
    get: () => isDevEnv(),
    set: (v) => setDevEnv(Boolean(v))
  }
};

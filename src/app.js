import { EVENTS, emit, on } from "./state.js";
import { exportFullBackup } from "./backupManager.js";
import { downloadTextFile } from "./utils.js";
import { showToast } from "./ui/toast.js";
import { getRoute, navigate, setActiveNav, startRouter } from "./ui/router.js";

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

    // Se houver SW novo esperando, atualiza com um clique do usuário (sem interromper fluxo).
    if (reg.waiting) {
      showToast("Atualização disponível. Recarregue para aplicar.", { type: "info", timeoutMs: 4500 });
    }

    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          showToast("Atualização instalada. Recarregue para aplicar.", { type: "info", timeoutMs: 4500 });
        }
      });
    });
  } catch (err) {
    console.warn("SW register failed", err);
  }
}

function start() {
  bindNav();
  bindQuickBackup();
  bindPwaInstall();

  startRouter();
  on(EVENTS.ROUTE_CHANGED, ({ route }) => render(route));
  on(EVENTS.DATA_CHANGED, () => render(currentRoute));

  // Primeira renderização (caso o listener seja registrado após startRouter)
  render(getRoute());

  registerServiceWorker();
  startAlerts();
}

// Boot
start();

// Expor um helper útil no console para debug sem poluir UI.
window.__dttv = {
  rerender: () => emit(EVENTS.DATA_CHANGED),
  navigate
};

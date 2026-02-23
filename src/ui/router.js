import { emit, EVENTS } from "../state.js";

const ROUTES = new Set(["home", "clients", "services", "records", "budgets", "backup", "notifications"]);

export function getRoute() {
  const h = String(location.hash || "").replace(/^#/, "").trim();
  return ROUTES.has(h) ? h : "home";
}

export function navigate(route) {
  const r = ROUTES.has(route) ? route : "home";
  if (getRoute() === r) return;
  location.hash = `#${r}`;
}

export function startRouter() {
  const onChange = () => emit(EVENTS.ROUTE_CHANGED, { route: getRoute() });
  window.addEventListener("hashchange", onChange);
  onChange();
  return () => window.removeEventListener("hashchange", onChange);
}

export function setActiveNav(route) {
  document.querySelectorAll("[data-route].nav-btn").forEach((btn) => {
    const isActive = btn.getAttribute("data-route") === route;
    if (isActive) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

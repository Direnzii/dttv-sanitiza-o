const KEY_APP_ICON = "dttv_theme_app_icon_v1";
// Mantido por compatibilidade: antes era usado para ícone do ORC na navegação.
// Agora é usado como "ícone/logo" do PDF de ORC.
const KEY_BUDGET_PDF_ICON = "dttv_theme_budget_icon_v1";
const KEY_BUDGET_ISSUER_NAME = "dttv_theme_budget_issuer_name_v1";
const KEY_BUDGET_ISSUER_FIELDS = "dttv_theme_budget_issuer_fields_v1";
const KEY_DARK_MODE = "dttv_theme_dark_mode_v1";

function safeGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeGetJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value || ""));
  } catch {
    // ignore
  }
}

function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value ?? null));
  } catch {
    // ignore
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getTheme() {
  const rawFields = safeGetJSON(KEY_BUDGET_ISSUER_FIELDS);
  const budgetIssuerFields = Array.isArray(rawFields)
    ? rawFields
        .slice(0, 3)
        .map((x, i) => ({
          title: String(x?.title ?? "").trim(),
          value: String(x?.value ?? "").trim()
        }))
    : [];

  return {
    appIconDataUrl: safeGet(KEY_APP_ICON),
    budgetPdfIconDataUrl: safeGet(KEY_BUDGET_PDF_ICON),
    budgetIssuerName: String(safeGet(KEY_BUDGET_ISSUER_NAME) || "").trim(),
    budgetIssuerFields,
    darkMode: safeGet(KEY_DARK_MODE) === "true"
  };
}

export function setAppIconDataUrl(dataUrl) {
  if (!dataUrl) safeRemove(KEY_APP_ICON);
  else safeSet(KEY_APP_ICON, dataUrl);
}

export function setBudgetPdfIconDataUrl(dataUrl) {
  if (!dataUrl) safeRemove(KEY_BUDGET_PDF_ICON);
  else safeSet(KEY_BUDGET_PDF_ICON, dataUrl);
}

export function setBudgetIssuerName(name) {
  const v = String(name ?? "").trim();
  if (!v) safeRemove(KEY_BUDGET_ISSUER_NAME);
  else safeSet(KEY_BUDGET_ISSUER_NAME, v);
}

export function setBudgetIssuerFields(fields) {
  const raw = Array.isArray(fields) ? fields : [];
  const normalized = raw.slice(0, 3).map((x, i) => ({
    title: String(x?.title ?? "").trim(),
    value: String(x?.value ?? "").trim()
  }));
  safeSetJSON(KEY_BUDGET_ISSUER_FIELDS, normalized);
}

export function setDarkMode(enabled) {
  const v = Boolean(enabled);
  if (v) safeSet(KEY_DARK_MODE, "true");
  else safeRemove(KEY_DARK_MODE);
}

export function clearTheme() {
  safeRemove(KEY_APP_ICON);
  safeRemove(KEY_BUDGET_PDF_ICON);
  safeRemove(KEY_BUDGET_ISSUER_NAME);
  safeRemove(KEY_BUDGET_ISSUER_FIELDS);
  safeRemove(KEY_DARK_MODE);
}

function applyAppIcon(dataUrl) {
  const logoWrap = document.getElementById("app-logo");
  const logoImg = document.getElementById("app-logo-img");
  const logoText = document.getElementById("app-logo-text");

  if (logoImg && logoText && logoWrap) {
    const has = Boolean(dataUrl);
    logoImg.src = has ? dataUrl : "";
    logoImg.classList.toggle("hidden", !has);
    logoText.classList.toggle("hidden", has);
    // Mantém o container com fundo/rounded; imagem ocupa tudo.
    logoWrap.classList.toggle("bg-slate-900", !has);
  }

  const fav = document.getElementById("favicon");
  if (fav && fav.tagName === "LINK") {
    if (!fav.dataset.defaultHref) fav.dataset.defaultHref = fav.getAttribute("href") || "";
    fav.setAttribute("href", dataUrl || fav.dataset.defaultHref || fav.getAttribute("href") || "");
  }
  const apple = document.getElementById("apple-touch-icon");
  if (apple && apple.tagName === "LINK") {
    if (!apple.dataset.defaultHref) apple.dataset.defaultHref = apple.getAttribute("href") || "";
    apple.setAttribute("href", dataUrl || apple.dataset.defaultHref || apple.getAttribute("href") || "");
  }
}

export function applyTheme() {
  const { appIconDataUrl, darkMode } = getTheme();
  applyAppIcon(appIconDataUrl);
  document.documentElement.classList.toggle("dark", darkMode);
}


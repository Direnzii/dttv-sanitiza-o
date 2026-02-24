const KEY_APP_ICON = "dttv_theme_app_icon_v1";
// Mantido por compatibilidade: antes era usado para ícone do ORC na navegação.
// Agora é usado como "ícone/logo" do PDF de ORC.
const KEY_BUDGET_PDF_ICON = "dttv_theme_budget_icon_v1";

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

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getTheme() {
  return {
    appIconDataUrl: safeGet(KEY_APP_ICON),
    budgetPdfIconDataUrl: safeGet(KEY_BUDGET_PDF_ICON)
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

export function clearTheme() {
  safeRemove(KEY_APP_ICON);
  safeRemove(KEY_BUDGET_PDF_ICON);
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
  const { appIconDataUrl } = getTheme();
  applyAppIcon(appIconDataUrl);
}


export function uid() {
  // `crypto.randomUUID()` é rápido e disponível na maioria dos browsers modernos.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

export function toNumber(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function formatCurrencyBRL(value) {
  const n = toNumber(value, 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(dateISO) {
  // Aceita "YYYY-MM-DD" ou ISO completo.
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return String(dateISO ?? "");
  return d.toLocaleDateString("pt-BR");
}

export function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function downloadTextFile({ filename, mime, text }) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsText(file);
  });
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function inRangeInclusive(dateISO, startISO, endISO) {
  // Considera apenas parte YYYY-MM-DD.
  const d = String(dateISO ?? "").slice(0, 10);
  const a = String(startISO ?? "").slice(0, 10);
  const b = String(endISO ?? "").slice(0, 10);
  return d >= a && d <= b;
}

export function addDaysISO(dateISO, days) {
  const d = new Date(String(dateISO).slice(0, 10));
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

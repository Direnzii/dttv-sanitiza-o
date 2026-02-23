export function uid() {
  // `crypto.randomUUID()` é rápido e disponível na maioria dos browsers modernos.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function localDateISO(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODateLocal(dateISO) {
  const s = String(dateISO ?? "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  return new Date(y, mo - 1, d); // local time (00:00 local)
}

export function todayISO() {
  // Importante: data local (evita bug de -1 dia por UTC).
  return localDateISO(new Date());
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
  const local = parseISODateLocal(dateISO);
  const d = local || new Date(dateISO);
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

export function addDaysISO(dateISO, days) {
  const base = parseISODateLocal(dateISO) || new Date(String(dateISO).slice(0, 10));
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + Number(days || 0));
  return localDateISO(d);
}

export function addMonthsISO(dateISO, months) {
  const base = parseISODateLocal(dateISO) || new Date(String(dateISO).slice(0, 10));
  if (Number.isNaN(base.getTime())) return todayISO();

  const m = Math.trunc(Number(months || 0));
  const y = base.getFullYear();
  const mo = base.getMonth();
  const day = base.getDate();

  // vai para o dia 1 para evitar "pulos" em meses curtos, depois corrige o dia
  const target = new Date(y, mo + m, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return localDateISO(target);
}

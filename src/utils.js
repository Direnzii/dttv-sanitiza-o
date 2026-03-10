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

export function isoToBRDate(iso) {
  const d = String(iso || "").slice(0, 10);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function brDateToISO(br) {
  const s = String(br || "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isInteger(dd) || !Number.isInteger(mm) || !Number.isInteger(yyyy)) return "";
  if (yyyy < 1900 || yyyy > 2100) return "";
  if (mm < 1 || mm > 12) return "";
  const lastDay = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > lastDay) return "";
  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function attachBRDateMask(inputEl) {
  if (!(inputEl instanceof HTMLInputElement)) return;
  inputEl.addEventListener("input", () => {
    const digits = String(inputEl.value || "").replace(/\D+/g, "").slice(0, 8);
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    let out = dd;
    if (mm) out += `/${mm}`;
    if (yyyy) out += `/${yyyy}`;
    if (out !== inputEl.value) inputEl.value = out;
  });
}

export function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function openExternal(url) {
  const href = String(url || "").trim();
  if (!href) return false;
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
    return true;
  } catch {
    try {
      window.location.href = href;
      return true;
    } catch {
      return false;
    }
  }
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

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export async function readImageFileAsPngDataUrl(file, { maxPx = 256 } = {}) {
  if (!file) throw new Error("Selecione um arquivo.");
  const type = String(file.type || "").toLowerCase();
  if (type !== "image/png" && type !== "image/jpeg") {
    throw new Error("Formato inválido. Aceita apenas PNG ou JPG.");
  }

  const rawUrl = await readFileAsDataUrl(file);
  const img = new Image();
  img.decoding = "async";

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = rawUrl;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Imagem inválida.");

  const scale = Math.min(1, maxPx / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawUrl; // fallback

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, tw, th);

  return canvas.toDataURL("image/png");
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

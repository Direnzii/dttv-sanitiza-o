import { formatDateBR } from "../utils.js";
import { el } from "./components.js";

export function formatDateTime(record) {
  const d = formatDateBR(record?.dateISO);
  const t = String(record?.timeHM || "").trim();
  return t ? `${d} ${t}` : d;
}

export function statusBadgeClass(status) {
  const s = String(status || "APROVADO").toUpperCase();
  const map = {
    APROVADO: "bg-sky-50 text-sky-800 border-sky-200",
    FEITO: "bg-emerald-50 text-emerald-800 border-emerald-200",
    RECUSADO: "bg-rose-50 text-rose-800 border-rose-200",
    CANCELADO: "bg-amber-50 text-amber-800 border-amber-200"
  };
  return map[s] || "bg-slate-50 text-slate-800 border-slate-200";
}

export function statusCell(record) {
  const s = String(record?.status || "APROVADO").toUpperCase();
  const reason = String(record?.statusReason || "").trim();

  return el("div", { class: "min-w-[120px]" }, [
    el(
      "span",
      { class: `inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(s)}` },
      s
    ),
    reason ? el("div", { class: "mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500" }, reason) : null
  ]);
}


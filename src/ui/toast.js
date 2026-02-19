const root = () => document.getElementById("toasts");

function toastColors(type) {
  if (type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (type === "error") return "border-rose-200 bg-rose-50 text-rose-900";
  if (type === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-white text-slate-900";
}

function toastIcon(type) {
  if (type === "success") return "check-circle-2";
  if (type === "error") return "x-circle";
  if (type === "warning") return "alert-triangle";
  return "info";
}

export function showToast(message, { type = "info", timeoutMs = 2800 } = {}) {
  const container = root();
  if (!container) return;

  const el = document.createElement("div");
  el.className = `pointer-events-auto flex max-w-[92vw] items-start gap-3 rounded-2xl border p-3 shadow-soft ${toastColors(type)}`;

  const icon = document.createElement("i");
  icon.dataset.lucide = toastIcon(type);
  icon.className = "mt-0.5 h-5 w-5 shrink-0";

  const body = document.createElement("div");
  body.className = "min-w-0";
  body.innerHTML = `<div class="text-sm font-semibold">Mensagem</div><div class="mt-0.5 break-words text-sm/5">${String(
    message ?? ""
  )}</div>`;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "ml-1 rounded-lg p-1 text-current/70 hover:bg-black/5";
  close.title = "Fechar";
  close.innerHTML = `<i data-lucide="x" class="h-4 w-4"></i>`;

  const remove = () => {
    el.classList.add("opacity-0", "translate-y-1");
    el.style.transition = "opacity 160ms ease, transform 160ms ease";
    setTimeout(() => el.remove(), 180);
  };

  close.addEventListener("click", remove);

  el.appendChild(icon);
  el.appendChild(body);
  el.appendChild(close);
  container.appendChild(el);

  // Recria ícones gerados dinamicamente
  globalThis.lucide?.createIcons?.();

  if (timeoutMs > 0) setTimeout(remove, timeoutMs);
}

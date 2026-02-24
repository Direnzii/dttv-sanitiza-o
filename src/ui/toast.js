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
  // Defesa contra regressões de z-index no HTML/CSS.
  // Toast precisa ficar acima de modais.
  container.style.zIndex = "1000";

  const toastEl = document.createElement("div");
  toastEl.className = `pointer-events-auto flex max-w-[92vw] items-start gap-3 rounded-2xl border p-3 shadow-soft ${toastColors(type)}`;

  const icon = document.createElement("i");
  icon.dataset.lucide = toastIcon(type);
  icon.className = "mt-0.5 h-5 w-5 shrink-0";

  const body = document.createElement("div");
  body.className = "min-w-0";
  const title = document.createElement("div");
  title.className = "text-sm font-semibold";
  title.textContent = "Mensagem";
  const msg = document.createElement("div");
  msg.className = "mt-0.5 break-words text-sm/5";
  msg.textContent = String(message ?? "");
  body.appendChild(title);
  body.appendChild(msg);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "ml-1 rounded-lg p-1 text-current/70 hover:bg-black/5";
  close.title = "Fechar";
  const closeIcon = document.createElement("i");
  closeIcon.dataset.lucide = "x";
  closeIcon.className = "h-4 w-4";
  close.appendChild(closeIcon);

  const remove = () => {
    toastEl.classList.add("opacity-0", "translate-y-1");
    toastEl.style.transition = "opacity 160ms ease, transform 160ms ease";
    setTimeout(() => toastEl.remove(), 180);
  };

  close.addEventListener("click", remove);

  toastEl.appendChild(icon);
  toastEl.appendChild(body);
  toastEl.appendChild(close);
  container.appendChild(toastEl);

  // Recria ícones gerados dinamicamente
  globalThis.lucide?.createIcons?.();

  if (timeoutMs > 0) setTimeout(remove, timeoutMs);
}

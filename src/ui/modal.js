const root = () => document.getElementById("modal-root");

function buildModalShell({ title, subtitle, maxWidthClass }) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3 backdrop-blur-sm";
  overlay.role = "dialog";
  overlay.ariaModal = "true";

  const card = document.createElement("div");
  card.className = `w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft`;

  const header = document.createElement("div");
  header.className = "flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3";
  header.innerHTML = `
    <div class="min-w-0">
      <div class="truncate text-base font-semibold text-slate-900">${String(title ?? "")}</div>
      ${subtitle ? `<div class="mt-0.5 text-sm text-slate-500">${String(subtitle)}</div>` : ""}
    </div>
    <button type="button" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" data-modal-close title="Fechar">
      <i data-lucide="x" class="h-5 w-5"></i>
    </button>
  `;

  const body = document.createElement("div");
  body.className = "px-4 py-4";

  const footer = document.createElement("div");
  footer.className = "flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3";

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  return { overlay, card, body, footer };
}

export function openModal({
  title,
  subtitle,
  content,
  maxWidthClass = "max-w-xl",
  actions = []
} = {}) {
  const container = root();
  if (!container) throw new Error("Modal root não encontrado.");

  const { overlay, body, footer } = buildModalShell({ title, subtitle, maxWidthClass });

  const close = () => overlay.remove();

  // Clique fora fecha
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  overlay.querySelectorAll("[data-modal-close]").forEach((btn) => btn.addEventListener("click", close));

  if (typeof content === "string") body.innerHTML = content;
  else if (content instanceof Node) body.appendChild(content);

  for (const a of actions) {
    const btn = document.createElement("button");
    btn.type = a.type || "button";
    btn.className =
      a.className ||
      "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";
    btn.textContent = a.label || "OK";
    if (a.autofocus) btn.autofocus = true;
    btn.addEventListener("click", async () => {
      const res = await a.onClick?.({ close });
      if (res !== false) close();
    });
    footer.appendChild(btn);
  }

  container.appendChild(overlay);
  overlay.tabIndex = -1;
  overlay.focus();

  globalThis.lucide?.createIcons?.();
  return { close, overlay };
}

export function confirmDialog({
  title = "Confirmar ação",
  message = "Tem certeza?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = true
} = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      subtitle: "Esta ação não pode ser desfeita.",
      content: `<div class="text-sm text-slate-700">${String(message)}</div>`,
      actions: [
        {
          label: cancelText,
          className:
            "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
          onClick: () => resolve(false)
        },
        {
          label: confirmText,
          autofocus: true,
          className: danger
            ? "rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            : "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => resolve(true)
        }
      ]
    });
  });
}

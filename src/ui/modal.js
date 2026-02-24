const root = () => document.getElementById("modal-root");

function buildModalShell({ title, subtitle, maxWidthClass }) {
  const overlay = document.createElement("div");
  overlay.className =
    // Mobile-friendly: overlay rolável e modal mais compacto.
    "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-2 backdrop-blur-sm sm:p-3";
  overlay.role = "dialog";
  overlay.ariaModal = "true";

  const card = document.createElement("div");
  // Mantém header/footer sempre visíveis e permite scroll do body em modais longos (mobile-friendly).
  card.className = `flex max-h-[85dvh] w-full flex-col ${maxWidthClass} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft sm:max-h-[calc(100dvh-2rem)]`;

  const header = document.createElement("div");
  header.className = "shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3";
  const headLeft = document.createElement("div");
  headLeft.className = "min-w-0";
  const headTitle = document.createElement("div");
  headTitle.className = "truncate text-base font-semibold text-slate-900";
  headTitle.textContent = String(title ?? "");
  headLeft.appendChild(headTitle);
  if (subtitle) {
    const headSub = document.createElement("div");
    headSub.className = "mt-0.5 text-sm text-slate-500";
    headSub.textContent = String(subtitle ?? "");
    headLeft.appendChild(headSub);
  }
  const headClose = document.createElement("button");
  headClose.type = "button";
  headClose.className = "rounded-lg p-2 text-slate-500 hover:bg-slate-100";
  headClose.dataset.modalClose = "";
  headClose.title = "Fechar";
  const headCloseIcon = document.createElement("i");
  headCloseIcon.dataset.lucide = "x";
  headCloseIcon.className = "h-5 w-5";
  headClose.appendChild(headCloseIcon);
  header.appendChild(headLeft);
  header.appendChild(headClose);

  const body = document.createElement("div");
  body.className = "min-h-0 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4";

  const footer = document.createElement("div");
  footer.className =
    "shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3";

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
  actions = [],
  onClose
} = {}) {
  const container = root();
  if (!container) throw new Error("Modal root não encontrado.");

  const { overlay, body, footer } = buildModalShell({ title, subtitle, maxWidthClass });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      onClose?.();
    } catch (err) {
      console.error(err);
    }
    overlay.remove();
  };

  // Clique fora fecha
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  overlay.querySelectorAll("[data-modal-close]").forEach((btn) => btn.addEventListener("click", close));

  if (typeof content === "string") body.textContent = content;
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

  // Hint de scroll: mostra que há conteúdo abaixo.
  // (Ajuda em modais longas no mobile: lista grande de serviços, etc.)
  requestAnimationFrame(() => {
    const hasOverflow = body.scrollHeight > body.clientHeight + 4;
    if (!hasOverflow) return;

    const hint = document.createElement("div");
    hint.className =
      "pointer-events-none sticky bottom-0 -mx-3 px-3 pb-2 pt-6 sm:-mx-4 sm:px-4 bg-gradient-to-t from-white via-white/90 to-transparent";
    const hintRow = document.createElement("div");
    hintRow.className = "flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500";
    const hintIcon = document.createElement("i");
    hintIcon.dataset.lucide = "chevron-down";
    hintIcon.className = "h-4 w-4 animate-bounce";
    hintRow.appendChild(hintIcon);
    hintRow.appendChild(document.createTextNode("Role para ver mais"));
    hint.appendChild(hintRow);
    body.appendChild(hint);

    const sync = () => {
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 8;
      hint.classList.toggle("hidden", atBottom);
    };
    body.addEventListener("scroll", sync, { passive: true });
    sync();
  });

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
      content: (() => {
        const el = document.createElement("div");
        el.className = "text-sm text-slate-700";
        el.textContent = String(message);
        return el;
      })(),
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

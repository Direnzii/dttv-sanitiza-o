import { el } from "./components.js";
import { openModal } from "./modal.js";

function actionBtnClass(variant) {
  const base = "w-full inline-flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold";
  if (variant === "danger") return `${base} bg-rose-600 text-white hover:bg-rose-700`;
  if (variant === "primary") return `${base} bg-slate-900 text-white hover:bg-slate-800`;
  return `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`;
}

/**
 * Abre um modal simples com ações verticais ("...").
 * Mantém comportamento atual: fecha o modal antes de executar a ação.
 */
export function openActionsModal({ title, subtitle, actions, maxWidthClass, closeLabel = "Fechar" } = {}) {
  /** @type {{close: Function, overlay: HTMLElement} | null} */
  let modal = null;

  const content = el("div", { class: "grid gap-2" }, [
    ...(Array.isArray(actions) ? actions : []).map((a) => {
      const disabled = Boolean(a?.disabled);
      return el(
        "button",
        {
          type: "button",
          class: actionBtnClass(String(a?.variant || "default")),
          ...(disabled
            ? { disabled: "true" }
            : {
                onclick: () => {
                  modal?.close?.();
                  a?.onClick?.();
                }
              })
        },
        [el("i", { dataset: { lucide: String(a?.icon || "more-vertical") }, class: "h-4 w-4 shrink-0" }), String(a?.label || "Ação")]
      );
    })
  ]);

  modal = openModal({
    title,
    subtitle,
    content,
    ...(maxWidthClass ? { maxWidthClass } : {}),
    actions: [{ label: closeLabel }]
  });

  // Visual para disabled
  modal.overlay.querySelectorAll("button[disabled]").forEach((b) => {
    b.classList.add("opacity-50", "cursor-not-allowed");
  });

  return modal;
}


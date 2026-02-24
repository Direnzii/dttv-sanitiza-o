import { createService, deleteService, listServices, updateService } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { formatCurrencyBRL } from "../utils.js";
import { card, clear, el, emptyState, input, pageHeader, textarea } from "../ui/components.js";
import { openActionsModal } from "../ui/actions.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { isDevEnv } from "../env.js";
import { mockServiceInitial } from "../mock.js";

function serviceForm({ initial = {}, onSave }) {
  const form = el("form", { class: "space-y-3" });
  form.appendChild(input({ label: "Nome *", name: "name", value: initial.name || "", placeholder: "Ex.: Higienização", required: true }));
  form.appendChild(textarea({ label: "Detalhe", name: "detail", value: initial.detail || "", placeholder: "Descrição livre do serviço (o que inclui, observações...)", rows: 4 }));
  form.appendChild(
    input({
      label: "Custo total (R$)",
      name: "totalCost",
      value: initial.totalCost ?? "",
      placeholder: "Ex.: 250,00",
      type: "text"
    })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      detail: String(fd.get("detail") || "").trim(),
      totalCost: String(fd.get("totalCost") || "").trim()
    };
    try {
      await onSave(payload);
    } catch (err) {
      showToast(err?.message || "Falha ao salvar.", { type: "error" });
      return;
    }
  });

  return form;
}

export function renderServices(container) {
  const state = { q: "" };
  const listHost = el("div");

  const search = el("input", {
    type: "search",
    placeholder: "Buscar serviço...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const applyFilters = () => {
    state.q = search.value;
    renderList();
  };

  function openCreate(initial = {}) {
    const form = serviceForm({
      initial: initial || {},
      onSave: async (payload) => {
        createService(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Serviço criado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Novo serviço",
      subtitle: "Cadastre o serviço e seu custo total.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => form.requestSubmit()
        }
      ]
    });
  }

  function openEdit(service) {
    const form = serviceForm({
      initial: service,
      onSave: async (payload) => {
        updateService(service.id, payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Serviço atualizado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Editar serviço",
      subtitle: "Atualize os dados do serviço.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar alterações",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => form.requestSubmit()
        }
      ]
    });
  }

  function openActions(service) {
    openActionsModal({
      title: service?.name ? String(service.name) : "Serviço",
      subtitle: service?.detail ? String(service.detail).slice(0, 120) : "",
      actions: [
        { label: "Editar", icon: "pencil", onClick: () => openEdit(service) },
        { label: "Excluir", icon: "trash-2", variant: "danger", onClick: () => onDelete(service) }
      ]
    });
  }

  async function onDelete(service) {
    const ok = await confirmDialog({
      title: "Excluir serviço",
      message: `Deseja excluir "${service.name}"? Registros e orçamentos antigos preservam o serviço (snapshot).`,
      confirmText: "Excluir",
      danger: true
    });
    if (!ok) return;
    try {
      deleteService(service.id);
      emit(EVENTS.DATA_CHANGED);
      showToast("Serviço excluído.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao excluir.", { type: "error" });
    }
  }

  function renderList() {
    const items = listServices({ q: state.q });
    clear(listHost);

    if (items.length === 0) {
      listHost.appendChild(
        emptyState({
          title: state.q ? "Nenhum serviço encontrado" : "Sem serviços cadastrados",
          description: state.q ? "Tente outro termo de busca." : "Cadastre serviços para usar em registros e orçamentos.",
          action: el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: openCreate
            },
            [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo serviço"]
          )
        })
      );
      globalThis.lucide?.createIcons?.();
      return;
    }

    listHost.appendChild(
      card([
        // Mobile: cards simples (sem "colunas"/rótulos)
        el("div", { class: "space-y-2 md:hidden" }, [
          ...items.map((s) =>
            el("div", { class: "rounded-2xl border border-slate-200 bg-white p-3" }, [
              el("div", { class: "flex items-start justify-between gap-3" }, [
                el("div", { class: "min-w-0" }, [
                  el("div", { class: "truncate text-sm font-semibold text-slate-800" }, s.name),
                  el("div", { class: "mt-1 line-clamp-2 text-xs text-slate-600" }, s.detail ? s.detail : "Sem detalhe"),
                  el("div", { class: "mt-2" }, [
                    el("div", { class: "text-xs text-slate-500" }, "Total"),
                    el("div", { class: "mt-0.5 text-sm font-semibold text-slate-900" }, formatCurrencyBRL(s.totalCost))
                  ])
                ]),
                el("div", { class: "shrink-0" }, [
                  el(
                    "button",
                    {
                      type: "button",
                      class:
                        "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100",
                      title: "Ações",
                      "aria-label": "Ações",
                      onclick: () => openActions(s)
                    },
                    [el("i", { dataset: { lucide: "more-vertical" }, class: "h-5 w-5" })]
                  )
                ])
              ])
            ])
          )
        ]),

        // Desktop: tabela completa
        el("div", { class: "hidden overflow-x-auto rounded-xl border border-slate-200 md:block" }, [
          el("table", { class: "w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "NOME"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "DETALHE"),
                el("th", { class: "px-3 py-2 text-right" }, "CUSTO"),
                el("th", { class: "px-3 py-2 text-right" }, "AÇÕES")
              ])
            ]),
            el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
              ...items.map((s) =>
                el("tr", { class: "hover:bg-slate-50" }, [
                  el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, s.name),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, s.detail || "—"),
                  el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(s.totalCost)),
                  el("td", { class: "px-3 py-2" }, [
                    el(
                      "button",
                      {
                        type: "button",
                        class:
                          "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100",
                        title: "Ações",
                        "aria-label": "Ações",
                        onclick: () => openActions(s)
                      },
                      [el("i", { dataset: { lucide: "more-vertical" }, class: "h-5 w-5" })]
                    )
                  ])
                ])
              )
            ])
          ])
        ])
      ])
    );

    // Recria ícones após re-render por busca/filtros.
    globalThis.lucide?.createIcons?.();
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" }, [
    el("div", { class: "w-full sm:w-72" }, [search]),
    el(
      "button",
      {
        type: "button",
        class:
          "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto",
        onclick: applyFilters
      },
      [el("i", { dataset: { lucide: "filter" }, class: "h-4 w-4" }), "Filtrar"]
    ),
    isDevEnv()
      ? el(
          "button",
          {
            type: "button",
            class:
              "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto",
            onclick: () => openCreate(mockServiceInitial())
          },
          [el("i", { dataset: { lucide: "sparkles" }, class: "h-4 w-4" }), "Criar Mock"]
        )
      : null,
    el(
      "button",
      {
        type: "button",
        class:
          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800 sm:w-auto",
        onclick: openCreate
      },
      [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo"]
    )
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({ title: "Serviços", right }),
      listHost
    ])
  );

  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });

  renderList();
}

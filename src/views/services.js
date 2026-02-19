import { createService, deleteService, listServices, updateService } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { formatCurrencyBRL } from "../utils.js";
import { card, clear, el, emptyState, input, pageHeader, textarea } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

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

  function openCreate() {
    const form = serviceForm({
      initial: {},
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
      return;
    }

    listHost.appendChild(
      card([
        el("div", { class: "overflow-hidden rounded-xl border border-slate-200" }, [
          el("table", { class: "w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "Nome"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "Detalhe"),
                el("th", { class: "px-3 py-2 text-right" }, "Custo total"),
                el("th", { class: "px-3 py-2 text-right" }, "Ações")
              ])
            ]),
            el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
              ...items.map((s) =>
                el("tr", { class: "hover:bg-slate-50" }, [
                  el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, s.name),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, s.detail || "—"),
                  el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(s.totalCost)),
                  el("td", { class: "px-3 py-2" }, [
                    el("div", { class: "flex items-center justify-end gap-2" }, [
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                          onclick: () => openEdit(s)
                        },
                        [el("i", { dataset: { lucide: "pencil" }, class: "h-4 w-4" }), "Editar"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700",
                          onclick: () => onDelete(s)
                        },
                        [el("i", { dataset: { lucide: "trash-2" }, class: "h-4 w-4" }), "Excluir"]
                      )
                    ])
                  ])
                ])
              )
            ])
          ])
        ])
      ])
    );
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" }, [
    el("div", { class: "w-full sm:w-72" }, [search]),
    el(
      "button",
      {
        type: "button",
        class:
          "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
        onclick: openCreate
      },
      [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo"]
    )
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({ title: "Serviços", subtitle: "CRUD completo de serviços (com custo total).", right }),
      listHost
    ])
  );

  search.addEventListener("input", () => {
    state.q = search.value;
    renderList();
  });

  renderList();
}

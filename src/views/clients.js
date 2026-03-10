import { createClient, deleteClient, listClients, listRecords, updateClient } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { card, clear, el, emptyState, input, pageHeader } from "../ui/components.js";
import { openActionsModal } from "../ui/actions.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { computeClientDue } from "../alerts.js";
import { todayISO, openExternal } from "../utils.js";
import { isDevEnv } from "../env.js";
import { mockClientInitial } from "../mock.js";

function clientForm({ initial = {}, onSave }) {
  const form = el("form", { class: "space-y-3" });
  form.appendChild(input({ label: "Nome *", name: "name", value: initial.name || "", placeholder: "Ex.: Maria Silva", required: true }));
  form.appendChild(input({ label: "Contato", name: "contact", value: initial.contact || "", placeholder: "Telefone / WhatsApp" }));
  form.appendChild(input({ label: "E-mail", name: "email", value: initial.email || "", placeholder: "email@exemplo.com", type: "email" }));
  form.appendChild(input({ label: "Localização", name: "location", value: initial.location || "", placeholder: "Cidade / Bairro / Endereço" }));

  // Periodicidade recomendada
  const pvWrap = input({
    label: "Periodicidade recomendada",
    name: "periodValue",
    value: initial.periodValue > 0 ? String(initial.periodValue) : "",
    placeholder: "Ex.: 2",
    type: "number",
    required: false
  });
  const pvInput = pvWrap.querySelector("input");
  pvInput.min = "0";
  pvInput.step = "1";

  const unitId = `f_periodUnit_${Math.random().toString(36).slice(2, 7)}`;
  const unitSelect = el(
    "select",
    {
      id: unitId,
      name: "periodUnit",
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    },
    [el("option", { value: "months" }, "Meses"), el("option", { value: "days" }, "Dias")]
  );
  unitSelect.value = initial.periodUnit === "days" ? "days" : "months";

  form.appendChild(
    el("div", { class: "grid grid-cols-1 gap-3 sm:grid-cols-2" }, [
      pvWrap,
      el("div", { class: "space-y-1" }, [
        el("label", { for: unitId, class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Unidade"),
        unitSelect
      ])
    ])
  );

  // Fallback para browsers sem `requestSubmit()`: um submit hidden.
  const hiddenSubmit = el("button", { type: "submit", class: "hidden", dataset: { hiddenSubmit: "1" } }, "submit");
  form.appendChild(hiddenSubmit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      periodValue: String(fd.get("periodValue") || "").trim(),
      periodUnit: String(fd.get("periodUnit") || "months")
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

function waLinkFromContact(contact) {
  const digits = String(contact || "").replace(/\D+/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function renderClients(container) {
  const state = { q: "" };
  const listHost = el("div");

  const search = el("input", {
    type: "search",
    placeholder: "Buscar cliente...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const applyFilters = () => {
    state.q = search.value;
    renderList();
  };

  function openCreate(initial = {}) {
    const form = clientForm({
      initial: initial || {},
      onSave: async (payload) => {
        createClient(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Cliente criado.", { type: "success" });
        modal.close();
      }
    });

    function submitSafely() {
      if (!form.checkValidity()) {
        form.reportValidity();
        showToast("Verifique os campos obrigatórios antes de salvar.", { type: "warning" });
        return;
      }
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.querySelector('button[type="submit"][data-hidden-submit="1"]')?.click();
    }

    const modal = openModal({
      title: "Novo cliente",
      subtitle: "Cadastre as informações do cliente.",
      content: el("div", { class: "space-y-3" }, [
        el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" }, [
          "Dica: somente o nome é obrigatório. O restante ajuda em orçamentos e organização."
        ]),
        form
      ]),
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            submitSafely();
            return false; // não fecha o modal automaticamente
          }
        }
      ]
    });
  }

  function openEdit(client) {
    const form = clientForm({
      initial: client,
      onSave: async (payload) => {
        updateClient(client.id, payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Cliente atualizado.", { type: "success" });
        modal.close();
      }
    });

    function submitSafely() {
      if (!form.checkValidity()) {
        form.reportValidity();
        showToast("Verifique os campos obrigatórios antes de salvar.", { type: "warning" });
        return;
      }
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.querySelector('button[type="submit"][data-hidden-submit="1"]')?.click();
    }

    const modal = openModal({
      title: "Editar cliente",
      subtitle: "Atualize os dados do cliente.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar alterações",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            submitSafely();
            return false; // não fecha o modal automaticamente
          }
        }
      ]
    });
  }

  function openActions(client) {
    const waUrl = waLinkFromContact(client?.contact);
    openActionsModal({
      title: client?.name ? String(client.name) : "Cliente",
      subtitle: client?.contact ? String(client.contact) : "",
      actions: [
        {
          label: "WhatsApp",
          icon: "message-circle",
          disabled: !waUrl,
          onClick: () => {
            if (!waUrl) return;
            openExternal(waUrl);
          }
        },
        { label: "Editar", icon: "pencil", onClick: () => openEdit(client) },
        { label: "Excluir", icon: "trash-2", variant: "danger", onClick: () => onDelete(client) }
      ]
    });
  }

  async function onDelete(client) {
    const ok = await confirmDialog({
      title: "Excluir cliente",
      message: `Deseja excluir "${client.name}"? Registros e orçamentos antigos preservam o nome (snapshot).`,
      confirmText: "Excluir",
      danger: true
    });
    if (!ok) return;
    try {
      deleteClient(client.id);
      emit(EVENTS.DATA_CHANGED);
      showToast("Cliente excluído.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao excluir.", { type: "error" });
    }
  }

  function renderList() {
    const items = listClients({ q: state.q });
    const allRecords = listRecords({ startISO: "0000-01-01", endISO: "9999-12-31" });
    const lastConcludedByClient = new Map();
    for (const r of allRecords) {
      const status = String(r?.status || "").toUpperCase();
      if (status !== "CONCLUIDO") continue;
      const cid = String(r?.clientId || "");
      if (!cid) continue;
      if (!lastConcludedByClient.has(cid)) lastConcludedByClient.set(cid, r);
    }
    clear(listHost);

    if (items.length === 0) {
      listHost.appendChild(
        emptyState({
          title: state.q ? "Nenhum cliente encontrado" : "Sem clientes cadastrados",
          description: state.q ? "Tente outro termo de busca." : "Cadastre seu primeiro cliente para começar.",
          action: el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: openCreate
            },
            [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo cliente"]
          )
        })
      );
      globalThis.lucide?.createIcons?.();
      return;
    }

    listHost.appendChild(
      card([
        el("div", { class: "overflow-hidden rounded-xl border border-slate-200" }, [
          el("table", { class: "w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "Nome"),
                el("th", { class: "px-3 py-2 hidden md:table-cell" }, "Periodicidade"),
                el("th", { class: "px-3 py-2 hidden md:table-cell" }, "Contato"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "E-mail"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "Localização"),
                el("th", { class: "px-3 py-2 text-right" }, "Ações")
              ])
            ]),
            el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
              ...items.map((c) =>
                el("tr", { class: "hover:bg-slate-50" }, [
                  el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, c.name),
                  el("td", { class: "px-3 py-2 hidden md:table-cell text-slate-700" }, (() => {
                    const last = lastConcludedByClient.get(String(c.id));
                    const startISO = last?.dateISO ? String(last.dateISO).slice(0, 10) : "";
                    const due = computeClientDue(c, todayISO(), { startISO });
                    if (!due.enabled) return "—";
                    const label = due.unit === "days" ? "dias" : "meses";
                    const status = due.isOverdue ? " • VENCIDO" : "";
                    return `${due.value} ${label}${status}`;
                  })()),
                  el("td", { class: "px-3 py-2 hidden md:table-cell text-slate-700" }, c.contact || "—"),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, c.email || "—"),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, c.location || "—"),
                  el("td", { class: "px-3 py-2 text-right align-middle" }, [
                    el("div", { class: "flex items-center justify-end" }, [
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100",
                          title: "Ações",
                          "aria-label": "Ações",
                          onclick: () => openActions(c)
                        },
                        [el("i", { dataset: { lucide: "more-vertical" }, class: "h-5 w-5" })]
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
            onclick: () => openCreate(mockClientInitial())
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
      pageHeader({ title: "Clientes", right }),
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

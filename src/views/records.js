import { createRecord, deleteRecord, listClients, listRecords, listServices, updateRecord } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { formatCurrencyBRL, todayISO } from "../utils.js";
import { card, clear, el, emptyState, pageHeader, textarea } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { formatDateTime, statusCell } from "../ui/recordUi.js";

const STATUSES = ["APROVADO", "FEITO", "RECUSADO", "CANCELADO"];
const NEEDS_REASON = new Set(["RECUSADO", "CANCELADO"]);

function askReasonModal({ statusLabel }) {
  return new Promise((resolve) => {
    const ta = el("textarea", {
      rows: "4",
      placeholder: "Descreva o motivo (opcional)...",
      class:
        "w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    });

    openModal({
      title: `Motivo para ${statusLabel}`,
      subtitle: "Pode ser vazio, mas precisamos registrar que você confirmou o motivo.",
      content: el("div", { class: "space-y-2" }, [
        el("div", { class: "text-sm text-slate-600" }, "Informe o motivo abaixo:"),
        ta
      ]),
      actions: [
        {
          label: "Cancelar",
          onClick: () => resolve(null)
        },
        {
          label: "Confirmar",
          autofocus: true,
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => resolve(String(ta.value || ""))
        }
      ]
    });
  });
}

function recordForm({ initial = null, onSave }) {
  const clients = listClients();
  const services = listServices();

  const form = el("form", { class: "space-y-3" });

  const date = el("input", {
    type: "date",
    name: "dateISO",
    value: initial?.dateISO || todayISO(),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const time = el("input", {
    type: "time",
    name: "timeHM",
    value: initial?.timeHM || new Date().toTimeString().slice(0, 5),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const client = el(
    "select",
    {
      name: "clientId",
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    },
    [
      el("option", { value: "" }, "Selecione..."),
      ...clients.map((c) => el("option", { value: c.id }, c.name))
    ]
  );

  client.value = initial?.clientId || "";

  const selectedIds = new Set(
    Array.isArray(initial?.items) ? initial.items.map((it) => it.serviceId).filter(Boolean) : []
  );

  const servicesBox = el("div", { class: "max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2" });
  if (services.length === 0) {
    servicesBox.appendChild(
      el("div", { class: "p-3 text-sm text-slate-600" }, "Cadastre serviços antes de criar um registro.")
    );
  } else {
    for (const s of services) {
      const id = `svc_${s.id}`;
      const row = el("label", { for: id, class: "flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-slate-50" }, [
        el("input", {
          id,
          type: "checkbox",
          name: "serviceId",
          value: s.id,
          class: "mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
        }),
        el("div", { class: "min-w-0" }, [
          el("div", { class: "truncate text-sm font-semibold text-slate-900" }, s.name),
          el("div", { class: "mt-0.5 text-xs text-slate-500" }, s.detail ? s.detail : "Sem detalhe"),
          el("div", { class: "mt-1 text-xs font-semibold text-slate-700" }, formatCurrencyBRL(s.totalCost))
        ])
      ]);
      const cb = row.querySelector("input");
      cb.checked = selectedIds.has(s.id);
      servicesBox.appendChild(row);
    }
  }

  const notes = textarea({ label: "Observações", name: "notes", value: initial?.notes || "", placeholder: "Anotações do atendimento...", rows: 4 });
  notes.querySelector("textarea").name = "notes";

  const status = el(
    "select",
    {
      name: "status",
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    },
    STATUSES.map((s) => el("option", { value: s }, s))
  );
  status.value = String(initial?.status || "APROVADO").toUpperCase();

  form.appendChild(el("div", { class: "grid grid-cols-1 gap-3 sm:grid-cols-3" }, [
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Data"),
      date
    ]),
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Hora"),
      time
    ]),
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Cliente"),
      client
    ])
  ]));

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Status"),
    status
  ]));

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Serviços (1+ obrigatório)"),
    servicesBox
  ]));

  form.appendChild(notes);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const serviceIds = Array.from(form.querySelectorAll('input[name="serviceId"]:checked')).map((x) => x.value);
    const oldStatus = String(initial?.status || "").toUpperCase();
    const nextStatus = String(status.value || "APROVADO").toUpperCase();

    let statusReasonPatch;
    if (NEEDS_REASON.has(nextStatus) && nextStatus !== oldStatus) {
      const reason = await askReasonModal({ statusLabel: nextStatus });
      if (reason === null) return; // usuário cancelou
      statusReasonPatch = reason; // pode ser vazio
    } else if (!NEEDS_REASON.has(nextStatus) && NEEDS_REASON.has(oldStatus)) {
      statusReasonPatch = ""; // limpando motivo ao sair de RECUSADO/CANCELADO
    }

    const payload = {
      dateISO: date.value,
      timeHM: time.value,
      clientId: client.value,
      serviceIds,
      notes: form.querySelector('textarea[name="notes"]')?.value || "",
      status: nextStatus,
      ...(statusReasonPatch !== undefined ? { statusReason: statusReasonPatch } : {})
    };
    try {
      await onSave(payload);
    } catch (err) {
      showToast(err?.message || "Falha ao salvar.", { type: "error" });
    }
  });

  return { form, canSubmit: () => services.length > 0 && clients.length > 0 };
}

export function renderRecords(container) {
  const FILTER_KEY = "dttv_records_filters_v1";
  const state = { q: "", from: "", to: todayISO() };
  const listHost = el("div");

  function loadFilters() {
    try {
      const raw = sessionStorage.getItem(FILTER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      state.q = String(parsed.q ?? "");
      state.from = String(parsed.from ?? "");
      state.to = String(parsed.to ?? todayISO());
    } catch {
      // ignore
    }
  }

  function saveFilters() {
    try {
      sessionStorage.setItem(
        FILTER_KEY,
        JSON.stringify({
          q: state.q,
          from: state.from,
          to: state.to
        })
      );
    } catch {
      // ignore
    }
  }

  const q = el("input", {
    type: "search",
    placeholder: "Buscar por cliente/serviço...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const from = el("input", {
    type: "date",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  const to = el("input", {
    type: "date",
    value: state.to,
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  // Restaura filtro quando a view é re-renderizada (ex.: após salvar edição).
  loadFilters();
  q.value = state.q;
  from.value = state.from;
  to.value = state.to;

  const applyFilters = () => {
    state.q = q.value;
    state.from = from.value;
    state.to = to.value || todayISO();
    saveFilters();
    renderList();
  };

  function openCreate() {
    const { form, canSubmit } = recordForm({
      initial: null,
      onSave: async (payload) => {
        createRecord(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Registro criado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Novo registro (Agenda)",
      subtitle: "Registre um serviço prestado. Isso alimenta o Dashboard.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            if (!canSubmit()) {
              showToast("Cadastre ao menos 1 cliente e 1 serviço antes.", { type: "warning" });
              return false;
            }
            form.requestSubmit();
            return false;
          }
        }
      ]
    });
  }

  function openEdit(record) {
    const { form } = recordForm({
      initial: record,
      onSave: async (payload) => {
        updateRecord(record.id, payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Registro atualizado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Editar registro",
      subtitle: "Atualize data, cliente, serviços e observações.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar alterações",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            form.requestSubmit();
            return false;
          }
        }
      ]
    });
  }

  async function onDelete(record) {
    const ok = await confirmDialog({
      title: "Excluir registro",
      message: `Deseja excluir o registro de ${formatDateBR(record.dateISO)} para "${record.clientName}"?`,
      confirmText: "Excluir",
      danger: true
    });
    if (!ok) return;
    try {
      deleteRecord(record.id);
      emit(EVENTS.DATA_CHANGED);
      showToast("Registro excluído.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao excluir.", { type: "error" });
    }
  }

  function renderList() {
    const items = listRecords({
      startISO: state.from || "0000-01-01",
      endISO: state.to || "9999-12-31",
      q: state.q
    });
    clear(listHost);

    if (items.length === 0) {
      listHost.appendChild(
        emptyState({
          title: state.q || state.from ? "Nenhum registro encontrado" : "Sua agenda está vazia",
          description: "Registre serviços prestados para acompanhar ganhos e histórico.",
          action: el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: openCreate
            },
            [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo registro"]
          )
        })
      );
      globalThis.lucide?.createIcons?.();
      return;
    }

    listHost.appendChild(
      card([
        el("div", { class: "overflow-x-auto rounded-xl border border-slate-200" }, [
          el("table", { class: "min-w-[860px] w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "Data"),
                el("th", { class: "px-3 py-2" }, "Cliente"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "Serviços"),
                el("th", { class: "px-3 py-2" }, "Status"),
                el("th", { class: "px-3 py-2 text-right" }, "Total"),
                el("th", { class: "px-3 py-2 text-right" }, "Ações")
              ])
            ]),
            el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
              ...items.map((r) =>
                el("tr", { class: "hover:bg-slate-50" }, [
                  el("td", { class: "px-3 py-2 text-slate-700" }, formatDateTime(r)),
                  el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, r.clientName || "—"),
                  el(
                    "td",
                    { class: "px-3 py-2 hidden lg:table-cell text-slate-700" },
                    Array.isArray(r.items) ? r.items.map((it) => it.name).join(", ") : "—"
                  ),
                  el("td", { class: "px-3 py-2 align-top" }, statusCell(r)),
                  el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(r.total)),
                  el("td", { class: "px-3 py-2" }, [
                    el("div", { class: "flex items-center justify-end gap-2" }, [
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                          onclick: () => openEdit(r)
                        },
                        [el("i", { dataset: { lucide: "pencil" }, class: "h-4 w-4" }), "Editar"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700",
                          onclick: () => onDelete(r)
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

    // Recria ícones após re-render por filtros (data/busca).
    globalThis.lucide?.createIcons?.();
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto" }, [
    el("div", { class: "grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center" }, [
      el("div", { class: "sm:col-span-1" }, [q]),
      el("div", { class: "grid grid-cols-2 gap-2 sm:col-span-1" }, [from, to]),
      el("div", { class: "flex flex-wrap items-center justify-end gap-2" }, [
        el(
          "button",
          {
            type: "button",
            class:
              "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
            onclick: applyFilters
          },
          [el("i", { dataset: { lucide: "filter" }, class: "h-4 w-4" }), "Filtrar"]
        ),
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
      ])
    ])
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({ title: "Agenda", right }),
      listHost
    ])
  );

  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });
  from.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });
  to.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });

  renderList();
}

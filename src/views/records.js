import { createRecord, deleteRecord, getClientById, listClients, listRecords, listServices, updateRecord } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { brDateToISO, attachBRDateMask, formatCurrencyBRL, formatDateBR, isoToBRDate, normalizeText, openExternal, todayISO } from "../utils.js";
import { card, clear, el, emptyState, pageHeader, textarea } from "../ui/components.js";
import { openActionsModal } from "../ui/actions.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { formatDateTime, statusBadgeClass, statusCell } from "../ui/recordUi.js";
import { isDevEnv } from "../env.js";
import { mockRecordInitial } from "../mock.js";

const STATUSES = ["AGENDADO", "PEND. DE PAGAMENTO", "CONCLUIDO"];

function mapUrlFromLocation(location) {
  const q = String(location || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

async function applyStatusChange(record, nextStatus) {
  const oldStatus = String(record?.status || "AGENDADO").toUpperCase();
  const ns = String(nextStatus || "AGENDADO").toUpperCase();
  if (ns === oldStatus) return true;

  /** @type {{status: string}} */
  const patch = { status: ns };

  try {
    updateRecord(record.id, patch);
    emit(EVENTS.DATA_CHANGED);
    showToast("Status atualizado.", { type: "success" });
    return true;
  } catch (err) {
    showToast(err?.message || "Falha ao atualizar status.", { type: "error" });
    return false;
  }
}

function askObservationModal({ title = "Observação", initialValue = "" } = {}) {
  return new Promise((resolve) => {
    const ta = el("textarea", {
      rows: "4",
      placeholder: "Escreva uma observação (opcional)...",
      class:
        "w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    });
    ta.value = String(initialValue || "");

    openModal({
      title,
      subtitle: "Opcional. Fica registrado no status deste agendamento.",
      content: el("div", { class: "space-y-2" }, [
        el("div", { class: "text-sm text-slate-600" }, "Informe a observação abaixo:"),
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
    type: "text",
    inputmode: "numeric",
    placeholder: "DD/MM/AAAA",
    name: "dateBR",
    value: isoToBRDate(initial?.dateISO || todayISO()),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  attachBRDateMask(date);

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
  const qtyById = new Map(
    Array.isArray(initial?.items)
      ? initial.items
          .map((it) => [String(it.serviceId || ""), Math.max(1, Math.floor(Number(it.qty || 1)))])
          .filter((x) => x[0])
      : []
  );

  const servicesSearch = el("input", {
    type: "search",
    placeholder: "Buscar serviço...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const servicesBox = el("div", { class: "max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2" });
  const servicesIndex = services.map((s) => ({
    svc: s,
    hay: normalizeText(`${s.name} ${s.detail || ""}`)
  }));

  function renderServicesList() {
    clear(servicesBox);
    if (services.length === 0) {
      servicesBox.appendChild(el("div", { class: "p-3 text-sm text-slate-600" }, "Cadastre serviços antes de criar um registro."));
      return;
    }

    const q = normalizeText(servicesSearch.value);
    const filtered = q ? servicesIndex.filter((x) => x.hay.includes(q)).map((x) => x.svc) : services;

    if (filtered.length === 0) {
      servicesBox.appendChild(el("div", { class: "p-3 text-sm text-slate-600" }, "Nenhum serviço encontrado para esta busca."));
      return;
    }

    for (const s of filtered) {
      const id = `svc_${s.id}`;
      const row = el("div", { class: "flex items-start gap-3 rounded-xl p-2 hover:bg-slate-50" }, [
        el("input", {
          id,
          type: "checkbox",
          name: "serviceId",
          value: s.id,
          class: "mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
        }),
        el("label", { for: id, class: "min-w-0 flex-1 cursor-pointer" }, [
          el("div", { class: "truncate text-sm font-semibold text-slate-900" }, s.name),
          el("div", { class: "mt-0.5 text-xs text-slate-500" }, s.detail ? s.detail : "Sem detalhe"),
          el("div", { class: "mt-1 text-xs font-semibold text-slate-700" }, formatCurrencyBRL(s.totalCost))
        ]),
        el("div", { class: "shrink-0 w-20" }, [
          el("input", {
            type: "number",
            min: "1",
            step: "1",
            value: String(qtyById.get(s.id) || 1),
            class:
              "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20",
            disabled: "true"
          })
        ])
      ]);
      const cb = row.querySelector(`input[type="checkbox"]`);
      const qtyInput = row.querySelector(`input[type="number"]`);
      cb.checked = selectedIds.has(s.id);
      if (cb.checked) {
        qtyInput.removeAttribute("disabled");
      }
      cb.addEventListener("change", () => {
        if (cb.checked) {
          selectedIds.add(s.id);
          qtyInput.removeAttribute("disabled");
          qtyById.set(s.id, Math.max(1, Math.floor(Number(qtyInput.value || 1))));
        } else {
          selectedIds.delete(s.id);
          qtyInput.value = "1";
          qtyInput.setAttribute("disabled", "true");
          qtyById.delete(s.id);
        }
      });
      qtyInput.addEventListener("change", () => {
        const v = Math.max(1, Math.floor(Number(qtyInput.value || 1)));
        qtyInput.value = String(v);
        if (cb.checked) qtyById.set(s.id, v);
      });
      servicesBox.appendChild(row);
    }
  }

  servicesSearch.addEventListener("input", renderServicesList);
  renderServicesList();

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
  status.value = String(initial?.status || "AGENDADO").toUpperCase();

  const obs = textarea({
    label: "Observação (status)",
    name: "statusReason",
    value: initial?.statusReason || "",
    placeholder: "Opcional...",
    rows: 3
  });
  obs.querySelector("textarea").name = "statusReason";

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

  form.appendChild(el("div", { class: "grid grid-cols-1 gap-3 sm:grid-cols-2" }, [
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Status"),
      status
    ]),
    obs
  ]));

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Serviços (1+ obrigatório)"),
    services.length ? el("div", { class: "mt-1" }, servicesSearch) : null,
    servicesBox
  ]));

  form.appendChild(notes);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dateISO = brDateToISO(date.value);
    if (!dateISO) {
      showToast("Data inválida. Use DD/MM/AAAA.", { type: "warning" });
      date.focus?.();
      return;
    }
    const serviceIds = Array.from(selectedIds).map((id) => ({ serviceId: id, qty: qtyById.get(id) || 1 }));
    const nextStatus = String(status.value || "AGENDADO").toUpperCase();

    const payload = {
      dateISO,
      timeHM: time.value,
      clientId: client.value,
      serviceIds,
      notes: form.querySelector('textarea[name="notes"]')?.value || "",
      status: nextStatus,
      statusReason: form.querySelector('textarea[name="statusReason"]')?.value || ""
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
    type: "text",
    inputmode: "numeric",
    placeholder: "DD/MM/AAAA",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  const to = el("input", {
    type: "text",
    inputmode: "numeric",
    placeholder: "DD/MM/AAAA",
    value: isoToBRDate(state.to),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  attachBRDateMask(from);
  attachBRDateMask(to);

  // Restaura filtro quando a view é re-renderizada (ex.: após salvar edição).
  loadFilters();
  q.value = state.q;
  from.value = isoToBRDate(state.from);
  to.value = isoToBRDate(state.to);
  // Se não tiver filtro salvo (ou vier vazio), não deixa a data vazia.
  if (!from.value) from.value = isoToBRDate(todayISO());
  if (!to.value) to.value = isoToBRDate(todayISO());

  const applyFilters = () => {
    state.q = q.value;
    const fromISO = brDateToISO(from.value);
    const toISO = brDateToISO(to.value);
    if (from.value && !fromISO) {
      showToast("Data 'De' inválida. Use DD/MM/AAAA.", { type: "warning" });
      from.focus?.();
      return;
    }
    if (to.value && !toISO) {
      showToast("Data 'Até' inválida. Use DD/MM/AAAA.", { type: "warning" });
      to.focus?.();
      return;
    }
    state.from = fromISO;
    state.to = toISO || todayISO();
    saveFilters();
    renderList();
  };

  function openCreate(initial = null) {
    const { form, canSubmit } = recordForm({
      initial,
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

  function openActions(record) {
    const client = record?.clientId ? getClientById(record.clientId) : null;
    const mapUrl = mapUrlFromLocation(client?.location);
    openActionsModal({
      title: record?.clientName ? String(record.clientName) : "Registro",
      subtitle: formatDateTime(record),
      actions: [
        {
          label: "Mapa",
          icon: "map",
          disabled: !mapUrl,
          onClick: () => {
            if (!mapUrl) return;
            openExternal(mapUrl);
          }
        },
        { label: "Editar", icon: "pencil", onClick: () => openEdit(record) },
        { label: "Excluir", icon: "trash-2", variant: "danger", onClick: () => onDelete(record) }
      ]
    });
  }

  function openStatusPicker(record) {
    /** @type {{close: Function, overlay: HTMLElement} | null} */
    let modal = null;

    const content = el("div", { class: "grid grid-cols-2 gap-2" }, [
      ...STATUSES.map((s) => {
        const isActive = String(record?.status || "AGENDADO").toUpperCase() === s;
        return el(
          "button",
          {
            type: "button",
            class: `inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold ${statusBadgeClass(
              s
            )} ${isActive ? "ring-2 ring-slate-900/20" : "hover:opacity-90"}`,
            onclick: async () => {
              const ok = await applyStatusChange(record, s);
              if (ok) modal?.close?.();
            }
          },
          s
        );
      })
    ]);

    modal = openModal({
      title: "Alterar status",
      subtitle: `${record?.clientName || "—"} • ${formatDateTime(record)}`,
      content: el("div", { class: "space-y-3" }, [
        content,
        el(
          "button",
          {
            type: "button",
            class:
              "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
            onclick: async () => {
              const next = await askObservationModal({
                title: "Observação do status",
                initialValue: String(record?.statusReason || "")
              });
              if (next === null) return;
              try {
                updateRecord(record.id, { statusReason: next });
                emit(EVENTS.DATA_CHANGED);
                showToast("Observação atualizada.", { type: "success" });
                modal?.close?.();
              } catch (err) {
                showToast(err?.message || "Falha ao atualizar observação.", { type: "error" });
              }
            }
          },
          [el("i", { dataset: { lucide: "message-square" }, class: "h-4 w-4" }), "Adicionar/editar observação"]
        )
      ]),
      actions: [{ label: "Fechar" }]
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
        // Mobile: lista/cartões (sem scroll lateral)
        el("div", { class: "space-y-2 md:hidden" }, [
          ...items.map((r) =>
            el("div", { class: "rounded-2xl border border-slate-200 bg-white p-3" }, [
              el("div", { class: "flex items-start justify-between gap-3" }, [
                el("div", { class: "min-w-0" }, [
                  el("div", { class: "flex items-start justify-between gap-2" }, [
                    el("div", { class: "min-w-0" }, [
                      el("div", { class: "truncate text-sm font-semibold text-slate-800" }, r.clientName || "—"),
                      el("div", { class: "mt-1 text-xs text-slate-500" }, formatDateTime(r))
                    ]),
                    el(
                      "button",
                      {
                        type: "button",
                        title: "Alterar status",
                        "aria-label": "Alterar status",
                        class: `shrink-0 inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                          r.status
                        )} hover:opacity-90`,
                        onclick: () => openStatusPicker(r)
                      },
                      String(r.status || "AGENDADO").toUpperCase()
                    )
                  ]),

                  el(
                    "div",
                    { class: "mt-2 text-xs text-slate-600 line-clamp-2" },
                    Array.isArray(r.items)
                      ? r.items
                          .map((it) => {
                            const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
                            return qty > 1 ? `${qty}x ${it.name}` : it.name;
                          })
                          .join(", ")
                      : "—"
                  ),

                  el("div", { class: "mt-2 flex items-end justify-between gap-3" }, [
                    el("div", { class: "shrink-0" }, [
                      el("div", { class: "text-xs text-slate-500" }, "Total"),
                      el("div", { class: "mt-0.5 text-sm font-semibold text-slate-900" }, formatCurrencyBRL(r.total))
                    ]),
                    el("div", { class: "min-w-0 text-right text-xs text-slate-500" }, [
                      r.statusReason ? el("div", { class: "line-clamp-2" }, String(r.statusReason)) : null
                    ])
                  ])
                ]),
                el(
                  "button",
                  {
                    type: "button",
                    class:
                      "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100",
                    title: "Ações",
                    "aria-label": "Ações",
                    onclick: () => openActions(r)
                  },
                  [el("i", { dataset: { lucide: "more-vertical" }, class: "h-5 w-5" })]
                )
              ])
            ])
          )
        ]),

        // Desktop: tabela
        el("div", { class: "hidden overflow-x-auto rounded-xl border border-slate-200 md:block" }, [
          el("table", { class: "min-w-[860px] w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "DATA"),
                el("th", { class: "px-3 py-2" }, "CLIENTE"),
                el("th", { class: "px-3 py-2 hidden lg:table-cell" }, "SERVIÇOS"),
                el("th", { class: "px-3 py-2" }, "STATUS"),
                el("th", { class: "px-3 py-2 text-right" }, "TOTAL"),
                el("th", { class: "px-3 py-2 text-right" }, "AÇÕES")
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
                    Array.isArray(r.items)
                      ? r.items
                          .map((it) => {
                            const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
                            return qty > 1 ? `${qty}x ${it.name}` : it.name;
                          })
                          .join(", ")
                      : "—"
                  ),
                  el("td", { class: "px-3 py-2 align-top" }, [
                    el(
                      "button",
                      {
                        type: "button",
                        class: "text-left hover:opacity-90",
                        title: "Alterar status",
                        "aria-label": "Alterar status",
                        onclick: () => openStatusPicker(r)
                      },
                      [statusCell(r)]
                    )
                  ]),
                  el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(r.total)),
                  el("td", { class: "px-3 py-2" }, [
                    el(
                      "button",
                      {
                        type: "button",
                        class:
                          "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100",
                        title: "Ações",
                        "aria-label": "Ações",
                        onclick: () => openActions(r)
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

    // Recria ícones após re-render por filtros (data/busca).
    globalThis.lucide?.createIcons?.();
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto" }, [
    el("div", { class: "grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center" }, [
      el("div", { class: "sm:col-span-1" }, [q]),
      el("div", { class: "grid grid-cols-2 gap-2 sm:col-span-1" }, [from, to]),
      el("div", { class: "grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end" }, [
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
                onclick: () => {
                  const clients = listClients();
                  const services = listServices();
                  if (clients.length === 0 || services.length === 0) {
                    showToast("Para criar mock na Agenda, cadastre ao menos 1 cliente e 1 serviço.", { type: "warning" });
                    return;
                  }
                  openCreate(mockRecordInitial({ clients, services }));
                }
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

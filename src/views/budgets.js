import {
  createBudget,
  createRecordFromBudget,
  deleteBudget,
  getClientById,
  listBudgets,
  listClients,
  listServices,
  updateBudget
} from "../db.js";
import { EVENTS, emit } from "../state.js";
import { formatCurrencyBRL, formatDateBR, todayISO, toNumber } from "../utils.js";
import { card, clear, el, emptyState, pageHeader, textarea } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

function safeFilename(name) {
  return String(name || "orcamento")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]+/g, "")
    .slice(0, 48);
}

function generateBudgetPdf(budget) {
  const { jsPDF } = globalThis.jspdf || {};
  if (!jsPDF) throw new Error("jsPDF não carregou. Verifique sua conexão/Cache offline.");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 15;
  const line = (y) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
  };

  const issuer = "DTTV";
  const created = budget.createdAt ? budget.createdAt.slice(0, 10) : todayISO();
  const validUntil = (() => {
    const d = new Date(created);
    d.setDate(d.getDate() + Number(budget.validityDays || 0));
    return d.toISOString().slice(0, 10);
  })();

  const client = getClientById(budget.clientId);

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ORÇAMENTO", margin, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(issuer, pageW - margin, 16, { align: "right" });

  doc.setTextColor(15, 23, 42);

  // Meta
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Dados do cliente", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Cliente: ${budget.clientName || "—"}`, margin, y);
  y += 5;
  if (client?.contact) {
    doc.text(`Contato: ${client.contact}`, margin, y);
    y += 5;
  }
  if (client?.email) {
    doc.text(`E-mail: ${client.email}`, margin, y);
    y += 5;
  }
  if (client?.location) {
    doc.text(`Localização: ${client.location}`, margin, y);
    y += 5;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Informações do orçamento", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Código: ${budget.code || budget.id}`, margin, y);
  doc.text(`Data: ${formatDateBR(created)}`, pageW - margin, y, { align: "right" });
  y += 5;
  doc.text(`Validade: até ${formatDateBR(validUntil)}`, margin, y);
  y += 6;
  line(y);
  y += 8;

  // Items table (manual)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Serviço", margin, y);
  doc.text("Valor", pageW - margin, y, { align: "right" });
  y += 3;
  line(y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const items = Array.isArray(budget.items) ? budget.items : [];
  const maxY = pageH - 40;
  const currency = (n) => formatCurrencyBRL(toNumber(n, 0));

  const subtotal = items.reduce((acc, it) => acc + toNumber(it.cost, 0), 0);
  const discount = toNumber(budget.discount, 0);
  const total = toNumber(budget.total, subtotal - discount);

  for (const it of items) {
    if (y > maxY) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text(String(it.name || "Serviço"), margin, y);
    doc.text(currency(it.cost), pageW - margin, y, { align: "right" });
    y += 5;

    const detail = String(it.detail || "").trim();
    if (detail) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // slate-600
      const lines = doc.splitTextToSize(detail, pageW - margin * 2);
      doc.text(lines.slice(0, 3), margin, y);
      y += Math.min(lines.length, 3) * 4.2;
      doc.setTextColor(15, 23, 42);
    }
    y += 2;
  }

  y += 2;
  line(y);
  y += 8;

  // Totals
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", margin, y);
  doc.text(currency(subtotal), pageW - margin, y, { align: "right" });
  y += 6;
  doc.text("Desconto", margin, y);
  doc.text(currency(discount), pageW - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", margin, y);
  doc.text(currency(total), pageW - margin, y, { align: "right" });

  // Notes
  const notes = String(budget.notes || "").trim();
  if (notes) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Observações", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(notes, pageW - margin * 2), margin, y);
    doc.setTextColor(15, 23, 42);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 10);
  doc.text("DTTV — PWA Offline", pageW - margin, pageH - 10, { align: "right" });

  const filename = `orcamento-${String(budget.code || "").toLowerCase()}-${safeFilename(budget.clientName)}-${created}.pdf`;
  doc.save(filename);
}

function budgetForm({ initial = null, onSave }) {
  const clients = listClients();
  const services = listServices();

  const form = el("form", { class: "space-y-3" });

  const client = el(
    "select",
    {
      name: "clientId",
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    },
    [el("option", { value: "" }, "Selecione..."), ...clients.map((c) => el("option", { value: c.id }, c.name))]
  );
  client.value = initial?.clientId || "";

  const selectedIds = new Set(
    Array.isArray(initial?.items) ? initial.items.map((it) => it.serviceId).filter(Boolean) : []
  );

  const servicesBox = el("div", { class: "max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2" });
  if (services.length === 0) {
    servicesBox.appendChild(el("div", { class: "p-3 text-sm text-slate-600" }, "Cadastre serviços antes de criar um orçamento."));
  } else {
    for (const s of services) {
      const id = `bsvc_${s.id}`;
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

  const discount = el("input", {
    type: "text",
    name: "discount",
    value: initial?.discount ?? "",
    placeholder: "Ex.: 20,00",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const validityDays = el("input", {
    type: "number",
    name: "validityDays",
    value: initial?.validityDays ?? 7,
    min: "0",
    step: "1",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const notes = textarea({ label: "Observações", name: "notes", value: initial?.notes || "", placeholder: "Condições, prazos, observações...", rows: 4 });
  notes.querySelector("textarea").name = "notes";

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Cliente"),
    client
  ]));

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Serviços (1+ obrigatório)"),
    servicesBox
  ]));

  form.appendChild(el("div", { class: "grid grid-cols-1 gap-3 sm:grid-cols-2" }, [
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Desconto (R$)"),
      discount
    ]),
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Validade (dias)"),
      validityDays
    ])
  ]));

  form.appendChild(notes);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const serviceIds = Array.from(form.querySelectorAll('input[name="serviceId"]:checked')).map((x) => x.value);
    const payload = {
      clientId: client.value,
      serviceIds,
      discount: discount.value,
      validityDays: validityDays.value,
      notes: form.querySelector('textarea[name="notes"]')?.value || ""
    };
    try {
      await onSave(payload);
    } catch (err) {
      showToast(err?.message || "Falha ao salvar.", { type: "error" });
    }
  });

  return { form, canSubmit: () => services.length > 0 && clients.length > 0 };
}

export function renderBudgets(container) {
  const state = { q: "" };
  const listHost = el("div");

  const q = el("input", {
    type: "search",
    placeholder: "Buscar por cliente ou código...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const applyFilters = () => {
    state.q = q.value;
    renderList();
  };

  function openCreate() {
    const { form, canSubmit } = budgetForm({
      initial: null,
      onSave: async (payload) => {
        createBudget(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Orçamento criado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Novo orçamento",
      subtitle: "Vincule 1 cliente a N serviços e gere um PDF profissional.",
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

  function openEdit(budget) {
    const { form } = budgetForm({
      initial: budget,
      onSave: async (payload) => {
        updateBudget(budget.id, payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Orçamento atualizado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Editar orçamento",
      subtitle: "Atualize cliente, serviços, desconto, validade e observações.",
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

  async function onDelete(budget) {
    const ok = await confirmDialog({
      title: "Excluir orçamento",
      message: `Deseja excluir o orçamento de "${budget.clientName}"?`,
      confirmText: "Excluir",
      danger: true
    });
    if (!ok) return;
    try {
      deleteBudget(budget.id);
      emit(EVENTS.DATA_CHANGED);
      showToast("Orçamento excluído.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao excluir.", { type: "error" });
    }
  }

  async function onConvertToRecord(budget) {
    const now = new Date();
    const defaultDate = todayISO();
    const defaultTime = now.toTimeString().slice(0, 5);

    const date = el("input", {
      type: "date",
      value: defaultDate,
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    });
    const time = el("input", {
      type: "time",
      value: defaultTime,
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    });

    openModal({
      title: "Converter para Agenda",
      subtitle: "Informe a data e a hora da execução do serviço.",
      content: el("div", { class: "space-y-3" }, [
        el("div", { class: "grid grid-cols-1 gap-3 sm:grid-cols-2" }, [
          el("div", { class: "space-y-1" }, [
            el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Data"),
            date
          ]),
          el("div", { class: "space-y-1" }, [
            el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Hora"),
            time
          ])
        ]),
        el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" }, [
          "Isso ajuda no histórico. Você poderá ajustar depois na Agenda se quiser."
        ])
      ]),
      actions: [
        { label: "Cancelar" },
        {
          label: "Converter",
          autofocus: true,
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            try {
              const dateISO = String(date.value || defaultDate).slice(0, 10);
              const timeHM = String(time.value || defaultTime).slice(0, 5);
              createRecordFromBudget(budget.id, { dateISO, timeHM });
              emit(EVENTS.DATA_CHANGED);
              showToast("Registro criado a partir do orçamento.", { type: "success" });
            } catch (err) {
              showToast(err?.message || "Falha ao converter.", { type: "error" });
              return false;
            }
          }
        }
      ]
    });
  }

  function renderList() {
    const items = listBudgets({ q: state.q });
    clear(listHost);

    if (items.length === 0) {
      listHost.appendChild(
        emptyState({
          title: state.q ? "Nenhum orçamento encontrado" : "Sem orçamentos",
          description: "Crie um orçamento e gere um PDF para enviar ao cliente.",
          action: el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: openCreate
            },
            [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo orçamento"]
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
                el("th", { class: "px-3 py-2" }, "Código"),
                el("th", { class: "px-3 py-2" }, "Cliente"),
                el("th", { class: "px-3 py-2 hidden md:table-cell" }, "Data"),
                el("th", { class: "px-3 py-2 text-right" }, "Total"),
                el("th", { class: "px-3 py-2 text-right" }, "Ações")
              ])
            ]),
            el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
              ...items.map((b) =>
                el("tr", { class: "hover:bg-slate-50" }, [
                  el("td", { class: "px-3 py-2 font-mono text-xs font-semibold text-slate-700" }, b.code || "—"),
                  el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, b.clientName || "—"),
                  el("td", { class: "px-3 py-2 hidden md:table-cell text-slate-700" }, formatDateBR(b.createdAt?.slice(0, 10) || "")),
                  el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(b.total)),
                  el("td", { class: "px-3 py-2" }, [
                    el("div", { class: "flex flex-wrap items-center justify-end gap-2" }, [
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
                          onclick: () => {
                            try {
                              generateBudgetPdf(b);
                              showToast("PDF gerado.", { type: "success" });
                            } catch (err) {
                              showToast(err?.message || "Falha ao gerar PDF.", { type: "error" });
                            }
                          }
                        },
                        [el("i", { dataset: { lucide: "file-down" }, class: "h-4 w-4" }), "PDF"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                          onclick: () => onConvertToRecord(b)
                        },
                        [el("i", { dataset: { lucide: "arrow-right-left" }, class: "h-4 w-4" }), "Agenda"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                          onclick: () => openEdit(b)
                        },
                        [el("i", { dataset: { lucide: "pencil" }, class: "h-4 w-4" }), "Editar"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700",
                          onclick: () => onDelete(b)
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

    // Recria ícones após re-render por busca/filtros.
    globalThis.lucide?.createIcons?.();
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" }, [
    el("div", { class: "w-full sm:w-72" }, [q]),
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
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({ title: "Orçamentos & PDF", right }),
      listHost
    ])
  );

  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });

  renderList();
}


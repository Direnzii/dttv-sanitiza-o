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
import { brDateToISO, attachBRDateMask, formatCurrencyBRL, formatDateBR, isoToBRDate, normalizeText, todayISO, toNumber } from "../utils.js";
import { card, clear, el, emptyState, pageHeader, textarea } from "../ui/components.js";
import { openActionsModal } from "../ui/actions.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { getTheme } from "../theme.js";
import { isDevEnv } from "../env.js";
import { mockBudgetInitial } from "../mock.js";

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
  const ensureSpace = (needed = 12) => {
    if (y + needed <= pageH - margin) return;
    doc.addPage();
    y = margin;
  };
  const line = (y) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
  };

  const { budgetIssuerName, budgetIssuerFields } = getTheme();
  const issuer = String(budgetIssuerName || "").trim(); // se vazio, fica vazio mesmo
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

  // Ícone do PDF (opcional) configurável em Config > Tema
  let issuerX = pageW - margin;
  try {
    const { budgetPdfIconDataUrl } = getTheme();
    if (budgetPdfIconDataUrl) {
      const iconSize = 10; // mm
      const x = pageW - margin - iconSize;
      const y = 6.5;
      doc.addImage(budgetPdfIconDataUrl, "PNG", x, y, iconSize, iconSize, undefined, "FAST");
      issuerX = x - 2; // deixa espaço para não colidir com o ícone
    }
  } catch {
    // ignore (não deixa o PDF falhar por causa do ícone)
  }

  if (issuer) doc.text(issuer, issuerX, 16, { align: "right" });

  doc.setTextColor(15, 23, 42);

  // Informações fixas (Config) no topo do PDF
  // Header ocupa 26mm; deixa um respiro antes do bloco fixo.
  let y = 40;
  const fixed = Array.isArray(budgetIssuerFields) ? budgetIssuerFields.slice(0, 3) : [];
  const fixedPrintable = fixed
    .map((x, i) => ({
      title: String(x?.title ?? "").trim(),
      value: String(x?.value ?? "").trim()
    }))
    .filter((x) => x.value);

  if (fixedPrintable.length) {
    y = 40;
    if (issuer) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(issuer, margin, y);
      y += 5.5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    for (const f of fixedPrintable) {
      const lineText = f.title ? `${f.title}: ${f.value}` : String(f.value || "");
      const lines = doc.splitTextToSize(lineText, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 4.2;
      y += 1.5;
    }
    doc.setTextColor(15, 23, 42);
    y += 2;
    line(y);
    y += 8;
  }

  // Meta
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

  // Campos adicionais (movidos para cá, logo após informações do orçamento)
  const additional = Array.isArray(budget.additionalFields) ? budget.additionalFields.slice(0, 3) : [];
  const additionalPrintable = additional
    .map((x, i) => ({
      title: String(x?.title ?? "").trim(),
      value: String(x?.value ?? "").trim()
    }))
    .filter((x) => x.title || x.value);

  if (additionalPrintable.length) {
    for (const f of additionalPrintable) {
      ensureSpace(18);
      const title = String(f.title || "").trim();
      if (title) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(title, margin, y);
        y += 5;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const value = String(f.value || "").trim();
      if (value) {
        const lines = doc.splitTextToSize(value, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 4.2;
      } else {
        doc.text("—", margin, y);
        y += 4.2;
      }
      y += 6;
    }
    doc.setTextColor(15, 23, 42);
    line(y);
    y += 8;
  }

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
    const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
    const label = qty > 1 ? `${qty}x ${String(it.name || "Serviço")}` : String(it.name || "Serviço");
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
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
  if (toNumber(discount, 0) > 0) {
    doc.text("Desconto", margin, y);
    doc.text(currency(discount), pageW - margin, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", margin, y);
  doc.text(currency(total), pageW - margin, y, { align: "right" });

  // Notes
  const notes = String(budget.notes || "").trim();

  if (notes) {
    y += 10;
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Observações", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(notes, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.2;

    doc.setTextColor(15, 23, 42);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 10);
  doc.text("DTTV — PWA App", pageW - margin, pageH - 10, { align: "right" });

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
      required: "true",
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    },
    [el("option", { value: "" }, "Selecione..."), ...clients.map((c) => el("option", { value: c.id }, c.name))]
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
      servicesBox.appendChild(el("div", { class: "p-3 text-sm text-slate-600" }, "Cadastre serviços antes de criar um orçamento."));
      return;
    }

    const q = normalizeText(servicesSearch.value);
    const filtered = q ? servicesIndex.filter((x) => x.hay.includes(q)).map((x) => x.svc) : services;

    if (filtered.length === 0) {
      servicesBox.appendChild(el("div", { class: "p-3 text-sm text-slate-600" }, "Nenhum serviço encontrado para esta busca."));
      return;
    }

    for (const s of filtered) {
      const id = `bsvc_${s.id}`;
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
      if (cb.checked) qtyInput.removeAttribute("disabled");
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
    min: "1",
    step: "1",
    required: "true",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const notes = textarea({ label: "Observações", name: "notes", value: initial?.notes || "", placeholder: "Condições, prazos, observações...", rows: 4 });
  notes.querySelector("textarea").name = "notes";

  // Campos adicionais (0-3)
  const initialExtrasRaw = Array.isArray(initial?.additionalFields) ? initial.additionalFields : [];
  const extras = initialExtrasRaw
    .slice(0, 3)
    .map((x, i) => ({
      title: String(x?.title ?? `Campo ${i + 1}`).trim() || `Campo ${i + 1}`,
      value: String(x?.value ?? "").trim()
    }));

  const extrasCount = el("input", {
    type: "number",
    min: "0",
    max: "3",
    step: "1",
    value: String(Math.min(3, Math.max(0, extras.length))),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  const extrasHost = el("div", { class: "space-y-3" });

  function clampExtrasCount() {
    const n = Math.max(0, Math.min(3, Math.floor(Number(extrasCount.value || 0))));
    extrasCount.value = String(n);
    return n;
  }

  function ensureExtrasLength(n) {
    while (extras.length < n) {
      const i = extras.length;
      extras.push({ title: `Campo ${i + 1}`, value: "" });
    }
    if (extras.length > n) extras.splice(n);
  }

  function renderExtras() {
    clear(extrasHost);
    const n = clampExtrasCount();
    ensureExtrasLength(n);
    if (n === 0) return;

    for (let i = 0; i < n; i++) {
      const titleInput = el("input", {
        type: "text",
        value: extras[i].title,
        placeholder: "Título (ex.: Descrição)",
        class:
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      });
      titleInput.addEventListener("input", () => {
        extras[i].title = String(titleInput.value ?? "");
      });

      const valueBox = textarea({
        label: "Texto",
        name: `additional_${i}_value`,
        value: extras[i].value,
        placeholder: "Conteúdo livre...",
        rows: 3
      });
      const valueTa = valueBox.querySelector("textarea");
      valueTa.addEventListener("input", () => {
        extras[i].value = String(valueTa.value ?? "");
      });

      extrasHost.appendChild(
        el("div", { class: "rounded-2xl border border-slate-200 bg-white p-3" }, [
          el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, `Campo adicional ${i + 1}`),
          el("div", { class: "mt-2 space-y-2" }, [
            el("div", { class: "space-y-1" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Título"),
              titleInput
            ]),
            valueBox
          ])
        ])
      );
    }
  }

  extrasCount.addEventListener("change", renderExtras);
  extrasCount.addEventListener("input", renderExtras);
  renderExtras();

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Cliente"),
    client
  ]));

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Serviços (1+ obrigatório)"),
    services.length ? el("div", { class: "mt-1" }, servicesSearch) : null,
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

  form.appendChild(el("div", { class: "space-y-1" }, [
    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Campos adicionais (0-3)"),
    extrasCount
  ]));
  form.appendChild(extrasHost);

  // Fallback para browsers sem `requestSubmit()`: um submit hidden.
  const hiddenSubmit = el("button", { type: "submit", class: "hidden", dataset: { hiddenSubmit: "1" } }, "submit");
  form.appendChild(hiddenSubmit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clientId = String(client.value || "").trim();
    const serviceIds = Array.from(selectedIds).map((id) => ({ serviceId: id, qty: qtyById.get(id) || 1 }));

    if (!clientId) {
      showToast("Campo obrigatório: selecione um cliente.", { type: "warning" });
      client.focus?.();
      return;
    }
    if (serviceIds.length === 0) {
      showToast("Campo obrigatório: selecione pelo menos 1 serviço.", { type: "warning" });
      return;
    }

    const vdRaw = String(validityDays.value ?? "").trim();
    if (!vdRaw) {
      showToast("Campo obrigatório: informe a validade (dias).", { type: "warning" });
      validityDays.focus?.();
      return;
    }
    const vd = Number(vdRaw);
    if (!Number.isFinite(vd) || vd < 1) {
      showToast("Validade inválida: use 1 dia ou mais.", { type: "warning" });
      validityDays.focus?.();
      return;
    }

    const payload = {
      clientId,
      serviceIds,
      discount: discount.value,
      validityDays: validityDays.value,
      notes: form.querySelector('textarea[name="notes"]')?.value || "",
      additionalFields: extras
        .slice(0, clampExtrasCount())
        .map((x, i) => ({
          title: String(x?.title ?? "").trim(),
          value: String(x?.value ?? "").trim()
        }))
    };
    try {
      await onSave(payload);
    } catch (err) {
      showToast(err?.message || "Falha ao salvar.", { type: "error" });
    }
  });

  return {
    form,
    canSubmit: () => services.length > 0 && clients.length > 0,
    submitSafely: () => {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.querySelector('button[type="submit"][data-hidden-submit="1"]')?.click();
    }
  };
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

  function openCreate(initial = null) {
    const { form, canSubmit, submitSafely } = budgetForm({
      initial,
      onSave: async (payload) => {
        createBudget(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Orçamento criado.", { type: "success" });
        modal.close();
      }
    });

    const modal = openModal({
      title: "Novo orçamento",
      subtitle: "",
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
            submitSafely();
            return false;
          }
        }
      ]
    });
  }

  function openEdit(budget) {
    const { form, submitSafely } = budgetForm({
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
            submitSafely();
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
      type: "text",
      inputmode: "numeric",
      placeholder: "DD/MM/AAAA",
      value: isoToBRDate(defaultDate),
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    });
    attachBRDateMask(date);
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
      ]),
      actions: [
        { label: "Cancelar" },
        {
          label: "Converter",
          autofocus: true,
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => {
            try {
              const dateISO = brDateToISO(date.value) || defaultDate;
              if (!dateISO) {
                showToast("Data inválida. Use DD/MM/AAAA.", { type: "warning" });
                date.focus?.();
                return false;
              }
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

  function openActions(budget) {
    openActionsModal({
      title: budget.code ? `ORC ${budget.code}` : "ORC",
      subtitle: budget.clientName ? String(budget.clientName) : "",
      actions: [
        {
          label: "Gerar PDF",
          icon: "file-down",
          variant: "primary",
          onClick: () => {
            try {
              generateBudgetPdf(budget);
              showToast("PDF gerado.", { type: "success" });
            } catch (err) {
              showToast(err?.message || "Falha ao gerar PDF.", { type: "error" });
            }
          }
        },
        { label: "Converter para Agenda", icon: "arrow-right-left", onClick: () => onConvertToRecord(budget) },
        { label: "Editar", icon: "pencil", onClick: () => openEdit(budget) },
        { label: "Excluir", icon: "trash-2", variant: "danger", onClick: () => onDelete(budget) }
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
                    el(
                      "button",
                      {
                        type: "button",
                        class:
                          "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                        title: "Ações",
                        "aria-label": "Ações",
                        onclick: () => openActions(b)
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
    el("div", { class: "w-full sm:w-72" }, [q]),
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
                showToast("Para criar mock no ORC, cadastre ao menos 1 cliente e 1 serviço.", { type: "warning" });
                return;
              }
              openCreate(mockBudgetInitial({ clients, services }));
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
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({ title: "ORC", right }),
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


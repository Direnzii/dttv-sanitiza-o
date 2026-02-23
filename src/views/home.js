import { listRecords } from "../db.js";
import { addDaysISO, formatCurrencyBRL, formatDateBR, todayISO, toNumber } from "../utils.js";
import { card, clear, el, pageHeader } from "../ui/components.js";
import { navigate } from "../ui/router.js";
import { formatDateTime, statusCell } from "../ui/recordUi.js";

function computeRange({ mode, from, to }) {
  const end = String(to || todayISO()).slice(0, 10);
  if (mode === "custom") {
    const start = String(from || end).slice(0, 10);
    return { startISO: start <= end ? start : end, endISO: start <= end ? end : start };
  }
  const days = Number(mode || 7);
  const startISO = addDaysISO(end, -(Math.max(1, days) - 1));
  return { startISO, endISO: end };
}

function sumTotals(records) {
  return records
    .filter((r) => String(r?.status || "").toUpperCase() === "FEITO")
    .reduce((acc, r) => acc + toNumber(r.total, 0), 0);
}

export function renderHome(container) {
  const defaults = { mode: "7", from: "", to: todayISO() };
  const state = { ...defaults };

  const select = el("select", {
    class:
      "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  }, [
    el("option", { value: "7" }, "Últimos 7 dias"),
    el("option", { value: "14" }, "Últimos 14 dias"),
    el("option", { value: "30" }, "Últimos 30 dias"),
    el("option", { value: "custom" }, "Período personalizado")
  ]);

  const inputFrom = el("input", {
    type: "date",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  const inputTo = el("input", {
    type: "date",
    value: state.to,
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const summaryHost = el("div");
  const listHost = el("div");

  function renderAll() {
    const { startISO, endISO } = computeRange({ mode: state.mode, from: state.from, to: state.to });
    const records = listRecords({ startISO, endISO });
    const total = sumTotals(records);

    clear(summaryHost);
    summaryHost.appendChild(
      el("div", { class: "grid grid-cols-1 gap-3 md:grid-cols-3" }, [
        card([
          el("div", { class: "flex items-center justify-between gap-3" }, [
            el("div", {}, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Total ganho"),
              el("div", { class: "mt-1 text-2xl font-semibold text-slate-900" }, formatCurrencyBRL(total))
            ]),
            el("div", { class: "grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700" }, [
              el("i", { dataset: { lucide: "badge-dollar-sign" }, class: "h-6 w-6" })
            ])
          ])
        ]),
        card([
          el("div", { class: "flex items-center justify-between gap-3" }, [
            el("div", {}, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Qtd. de serviços"),
              el("div", { class: "mt-1 text-2xl font-semibold text-slate-900" }, String(records.length))
            ]),
            el("div", { class: "grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sky-700" }, [
              el("i", { dataset: { lucide: "activity" }, class: "h-6 w-6" })
            ])
          ])
        ]),
        card([
          el("div", { class: "flex items-center justify-between gap-3" }, [
            el("div", {}, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Período"),
              el("div", { class: "mt-1 text-base font-semibold text-slate-900" }, `${formatDateBR(startISO)} → ${formatDateBR(endISO)}`)
            ]),
            el("div", { class: "grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700" }, [
              el("i", { dataset: { lucide: "calendar-range" }, class: "h-6 w-6" })
            ])
          ])
        ])
      ])
    );

    clear(listHost);
    const recent = records.slice(0, 8);
    listHost.appendChild(
      card([
        el("div", { class: "flex flex-wrap items-center justify-between gap-3" }, [
          el("div", {}, [
            el("div", { class: "text-base font-semibold text-slate-900" }, "Serviços"),
            el("div", { class: "mt-0.5 text-sm text-slate-500" }, "Registros de agenda no período selecionado.")
          ]),
          el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: () => navigate("records")
            },
            [el("i", { dataset: { lucide: "plus" }, class: "h-4 w-4" }), "Novo registro"]
          )
        ]),
        recent.length === 0
          ? el("div", { class: "mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" }, [
              "Sem registros no período. Cadastre um serviço prestado para alimentar o dashboard."
            ])
          : el("div", { class: "mt-4 overflow-hidden rounded-xl border border-slate-200" }, [
              el("table", { class: "w-full text-left text-sm" }, [
                el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
                  el("tr", {}, [
                    el("th", { class: "px-3 py-2" }, "Data"),
                    el("th", { class: "px-3 py-2" }, "Cliente"),
                    el("th", { class: "px-3 py-2" }, "Serviços"),
                    el("th", { class: "px-3 py-2" }, "Status"),
                    el("th", { class: "px-3 py-2 text-right" }, "Total")
                  ])
                ]),
                el("tbody", { class: "divide-y divide-slate-200 bg-white" }, [
                  ...recent.map((r) =>
                    el("tr", { class: "hover:bg-slate-50" }, [
                      el("td", { class: "px-3 py-2 text-slate-700" }, formatDateTime(r)),
                      el("td", { class: "px-3 py-2 font-semibold text-slate-900" }, r.clientName || "—"),
                      el(
                        "td",
                        { class: "px-3 py-2 text-slate-700" },
                        Array.isArray(r.items) ? r.items.map((it) => it.name).join(", ") : "—"
                      ),
                      el("td", { class: "px-3 py-2 align-top" }, statusCell(r)),
                      el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(r.total))
                    ])
                  )
                ])
              ])
            ])
      ])
    );

    // Recria ícones após re-render por período/data.
    globalThis.lucide?.createIcons?.();
  }

  const customRangeBox = el("div", { class: "grid grid-cols-2 gap-2" }, [
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "De"),
      inputFrom
    ]),
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Até"),
      inputTo
    ])
  ]);

  const applyBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
      onclick: () => renderAll()
    },
    [el("i", { dataset: { lucide: "filter" }, class: "h-4 w-4" }), "Filtrar"]
  );

  const right = el("div", { class: "flex flex-wrap items-end gap-2" }, [
    el("div", { class: "space-y-1" }, [
      el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Período"),
      select
    ]),
    customRangeBox,
    applyBtn
  ]);

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({
        title: "Dashboard",
        right
      }),
      summaryHost,
      listHost
    ])
  );

  function syncCustomVisibility() {
    const custom = state.mode === "custom";
    customRangeBox.classList.toggle("hidden", !custom);
    applyBtn.classList.toggle("hidden", !custom);

    if (!custom) {
      // em períodos fixos, "até" não aparece e usamos hoje automaticamente
      state.from = "";
      state.to = todayISO();
      inputFrom.value = "";
      inputTo.value = state.to;
    } else {
      // garante valores coerentes ao entrar no personalizado
      if (!state.to) state.to = todayISO();
      inputTo.value = state.to;
      inputFrom.value = state.from || "";
    }
  }

  select.value = state.mode;
  syncCustomVisibility();

  select.addEventListener("change", () => {
    state.mode = select.value;
    syncCustomVisibility();
    renderAll();
  });
  inputFrom.addEventListener("change", () => {
    state.from = inputFrom.value;
  });
  inputTo.addEventListener("change", () => {
    state.to = inputTo.value;
  });

  renderAll();
}

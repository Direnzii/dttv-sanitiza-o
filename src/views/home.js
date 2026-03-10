import { listRecords } from "../db.js";
import { addDaysISO, brDateToISO, attachBRDateMask, formatCurrencyBRL, formatDateBR, isoToBRDate, todayISO, toNumber } from "../utils.js";
import { card, clear, el, pageHeader } from "../ui/components.js";
import { navigate } from "../ui/router.js";
import { formatDateTime, statusCell } from "../ui/recordUi.js";

function computeRange({ mode, from, to }) {
  if (mode === "upcoming") {
    return { startISO: todayISO(), endISO: "9999-12-31" };
  }
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
    .filter((r) => String(r?.status || "").toUpperCase() === "CONCLUIDO")
    .reduce((acc, r) => acc + toNumber(r.total, 0), 0);
}

export function renderHome(container) {
  const defaults = { mode: "upcoming", from: "", to: todayISO() };
  const state = { ...defaults };

  const select = el("select", {
    class:
      "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  }, [
    el("option", { value: "upcoming" }, "Próximos agendamentos"),
    el("option", { value: "custom" }, "Período personalizado")
  ]);

  const inputFrom = el("input", {
    type: "text",
    inputmode: "numeric",
    placeholder: "DD/MM/AAAA",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  const inputTo = el("input", {
    type: "text",
    inputmode: "numeric",
    placeholder: "DD/MM/AAAA",
    value: isoToBRDate(state.to),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });
  attachBRDateMask(inputFrom);
  attachBRDateMask(inputTo);

  const summaryHost = el("div");
  const listHost = el("div");

  function renderAll() {
    const { startISO, endISO } = computeRange({ mode: state.mode, from: state.from, to: state.to });
    const all = listRecords({ startISO, endISO });
    const records =
      state.mode === "upcoming"
        ? all.filter((r) => String(r?.status || "").toUpperCase() === "AGENDADO")
        : all;
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
              el(
                "div",
                { class: "mt-1 text-base font-semibold text-slate-900" },
                state.mode === "upcoming" ? `Hoje → Futuro` : `${formatDateBR(startISO)} → ${formatDateBR(endISO)}`
              )
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
            el("div", { class: "text-base font-semibold text-slate-900" }, state.mode === "upcoming" ? "Próximos agendamentos" : "Serviços"),
            el(
              "div",
              { class: "mt-0.5 text-sm text-slate-500" },
              state.mode === "upcoming" ? "Agendamentos de hoje e futuros com status AGENDADO." : "Registros de agenda no período selecionado."
            )
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
              state.mode === "upcoming"
                ? "Sem agendamentos futuros. Crie um novo registro para aparecer aqui."
                : "Sem registros no período. Cadastre um serviço prestado para alimentar o dashboard."
            ])
          : el("div", { class: "mt-4" }, [
              // Mobile: lista/cartões (sem scroll lateral)
              el("div", { class: "space-y-2 md:hidden" }, [
                ...recent.map((r) =>
                  el("div", { class: "rounded-2xl border border-slate-200 bg-white p-3" }, [
                    el("div", { class: "flex items-start justify-between gap-3" }, [
                      el("div", { class: "min-w-0" }, [
                        el("div", { class: "truncate text-sm font-semibold text-slate-900" }, r.clientName || "—"),
                        el("div", { class: "mt-1 text-xs text-slate-500" }, formatDateTime(r)),
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
                  el("div", { class: "mt-2" }, [
                    el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "STATUS"),
                    el("div", { class: "mt-1" }, statusCell(r))
                  ])
                      ]),
                      el("div", { class: "shrink-0 text-right" }, [
                        el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Total"),
                        el("div", { class: "mt-0.5 text-sm font-semibold text-slate-900" }, formatCurrencyBRL(r.total))
                      ])
                    ])
                  ])
                )
              ]),

              // Desktop: tabela
              el("div", { class: "hidden overflow-hidden rounded-xl border border-slate-200 md:block" }, [
                el("table", { class: "w-full text-left text-sm" }, [
                el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
                  el("tr", {}, [
                    el("th", { class: "px-3 py-2" }, "DATA"),
                    el("th", { class: "px-3 py-2" }, "CLIENTE"),
                    el("th", { class: "px-3 py-2" }, "SERVIÇOS"),
                    el("th", { class: "px-3 py-2" }, "STATUS"),
                    el("th", { class: "px-3 py-2 text-right" }, "TOTAL")
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
                        Array.isArray(r.items)
                          ? r.items
                              .map((it) => {
                                const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
                                return qty > 1 ? `${qty}x ${it.name}` : it.name;
                              })
                              .join(", ")
                          : "—"
                      ),
                      el("td", { class: "px-3 py-2 align-top" }, statusCell(r)),
                      el("td", { class: "px-3 py-2 text-right font-semibold text-slate-900" }, formatCurrencyBRL(r.total))
                    ])
                  )
                ])
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
      // "Próximos agendamentos": range fixo (hoje → futuro)
      state.from = "";
      state.to = todayISO();
      inputFrom.value = "";
      inputTo.value = isoToBRDate(state.to);
    } else {
      // garante valores coerentes ao entrar no personalizado
      if (!state.to) state.to = todayISO();
      if (!state.from) state.from = state.to; // default: hoje → hoje
      inputTo.value = isoToBRDate(state.to);
      inputFrom.value = isoToBRDate(state.from || state.to);
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
    state.from = brDateToISO(inputFrom.value);
  });
  inputTo.addEventListener("change", () => {
    state.to = brDateToISO(inputTo.value) || todayISO();
  });

  renderAll();
}

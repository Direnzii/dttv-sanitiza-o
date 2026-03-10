import { EVENTS, emit } from "../state.js";
import {
  addNotification,
  clearAllNotifications,
  countUnread,
  listNotifications,
  markAsRead
} from "../notifications.js";
import { listRecords } from "../db.js";
import { formatCurrencyBRL, formatDateBR, todayISO } from "../utils.js";
import { card, clear, el, emptyState, pageHeader } from "../ui/components.js";
import { confirmDialog } from "../ui/modal.js";
import { navigate } from "../ui/router.js";
import { showToast } from "../ui/toast.js";
import { runAlertsNow, testSystemNotification } from "../alerts.js";
import { isDevEnv } from "../env.js";

function formatArrivedDate(createdAt) {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function formatArrivedTime(createdAt) {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function badge(type) {
  const map = {
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    info: "bg-slate-50 text-slate-800 border-slate-200"
  };
  return map[type] || map.info;
}

export function renderNotifications(container) {
  const pinnedHost = el("div");
  const listHost = el("div");

  const refreshBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
      onclick: async () => {
        try {
          const res = await runAlertsNow({ maxPerRun: 10 });
          emit(EVENTS.DATA_CHANGED);
          showToast(
            res.created > 0
              ? `Varredura concluída: ${res.created} nova(s) notificação(ões).`
              : `Varredura concluída: nada novo (pendentes: ${res.overdue}, já notificadas: ${res.already}).`,
            { type: "success", timeoutMs: 3500 }
          );
          renderList();
        } catch (err) {
          showToast(err?.message || "Falha ao revalidar periodicidade.", { type: "error" });
        }
      }
    },
    [el("i", { dataset: { lucide: "refresh-cw" }, class: "h-4 w-4" }), "Revalidar"]
  );

  const devTestBtn = isDevEnv()
    ? el(
        "button",
        {
          type: "button",
          class:
            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
          onclick: () => {
            addNotification({
              type: "info",
              title: "Notificação teste",
              message: "Gerada manualmente no Ambiente Dev."
            });
            emit(EVENTS.DATA_CHANGED);
            showToast("Notificação teste criada.", { type: "success" });
            renderList();
          }
        },
        [el("i", { dataset: { lucide: "sparkles" }, class: "h-4 w-4" }), "Notificação teste"]
      )
    : null;

  const devSystemBtn = isDevEnv()
    ? el(
        "button",
        {
          type: "button",
          class:
            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
          onclick: async () => {
            const ok = await testSystemNotification();
            showToast(
              ok
                ? "Notificação do sistema enviada (verifique o celular)."
                : "Permissão negada/indisponível. Ative Notificações para este app no navegador/PWA.",
              { type: ok ? "success" : "warning", timeoutMs: 4500 }
            );
          }
        },
        [el("i", { dataset: { lucide: "bell" }, class: "h-4 w-4" }), "Teste apito"]
      )
    : null;

  function renderPinned() {
    clear(pinnedHost);

    const today = todayISO();
    const todayRecords = listRecords({ startISO: today, endISO: today });
    const approvedToday = todayRecords.filter((r) => String(r?.status || "").toUpperCase() === "AGENDADO");

    if (approvedToday.length === 0) return false;

    const openAgendaToday = () => {
      try {
        sessionStorage.setItem(
          "dttv_records_filters_v1",
          JSON.stringify({ q: "", from: today, to: today })
        );
      } catch {
        // ignore
      }
      navigate("records");
    };

    pinnedHost.appendChild(
      card([
        el("div", { class: "flex flex-wrap items-start justify-between gap-3" }, [
          el("div", { class: "min-w-0" }, [
            el("div", { class: "flex items-center gap-2" }, [
              el("i", { dataset: { lucide: "bell-ring" }, class: "h-5 w-5 text-amber-700" }),
              el("div", { class: "text-base font-semibold text-slate-900" }, "Agendamentos de hoje")
            ]),
            el(
              "div",
              { class: "mt-1 text-sm text-slate-500" },
              `Há ${approvedToday.length} agendamento(s) para hoje com status AGENDADO. Este aviso não pode ser removido até mudar o status para outro estado.`
            )
          ]),
          el(
            "button",
            {
              type: "button",
              class:
                "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800",
              onclick: openAgendaToday
            },
            [el("i", { dataset: { lucide: "calendar-days" }, class: "h-4 w-4" }), "Abrir Agenda (hoje)"]
          )
        ]),
        el("div", { class: "mt-3 space-y-2" }, [
          ...approvedToday.slice(0, 6).map((r) =>
            el("div", { class: "rounded-2xl border border-amber-200 bg-amber-50 p-3" }, [
              el("div", { class: "flex flex-wrap items-start justify-between gap-3" }, [
                el("div", { class: "min-w-0" }, [
                  el("div", { class: "flex flex-wrap items-center gap-2" }, [
                    el("span", { class: "inline-flex items-center rounded-full border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-800" }, "AGENDADO"),
                    el("div", { class: "truncate text-sm font-semibold text-slate-900" }, r.clientName || "—")
                  ]),
                  el(
                    "div",
                    { class: "mt-1 text-sm text-slate-700" },
                    `${formatDateBR(r.dateISO)}${r.timeHM ? ` ${r.timeHM}` : ""} • ${Array.isArray(r.items) ? r.items.map((it) => it.name).join(", ") : "—"}`
                  )
                ]),
                el("div", { class: "text-right" }, [
                  el("div", { class: "text-xs font-semibold uppercase tracking-wider text-amber-800/80" }, "Total"),
                  el("div", { class: "mt-0.5 text-sm font-semibold text-slate-900" }, formatCurrencyBRL(r.total))
                ])
              ])
            ])
          ),
          approvedToday.length > 6
            ? el("div", { class: "text-xs text-slate-500" }, `+ ${approvedToday.length - 6} agendamento(s) a mais...`)
            : null
        ])
      ])
    );

    globalThis.lucide?.createIcons?.();
    return true;
  }

  const clearBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center justify-center rounded-lg bg-rose-600 p-2 text-white hover:bg-rose-700",
      title: "Limpar tudo",
      "aria-label": "Limpar tudo",
      onclick: async () => {
        const ok = await confirmDialog({
          title: "Limpar notificações",
          message: "Deseja apagar todas as notificações do app? (Avisos de agendamento de hoje não são apagados.)",
          confirmText: "Limpar",
          danger: true
        });
        if (!ok) return;
        clearAllNotifications();
        emit(EVENTS.DATA_CHANGED);
        showToast("Notificações apagadas.", { type: "success" });
        renderList();
      }
    },
    [el("i", { dataset: { lucide: "trash-2" }, class: "h-5 w-5" })]
  );

  function renderList() {
    const hasPinned = renderPinned();
    const unread = countUnread();
    const items = listNotifications({ unreadOnly: false });

    clear(listHost);

    if (items.length === 0) {
      // Se já existe o aviso fixo de “agendamentos de hoje”, não mostramos o empty state padrão.
      if (hasPinned) {
        globalThis.lucide?.createIcons?.();
        return;
      }
      listHost.appendChild(
        emptyState({
          title: "Sem notificações",
          description: "Quando o app gerar alertas, eles aparecem aqui.",
          action: null
        })
      );
      globalThis.lucide?.createIcons?.();
      return;
    }

    listHost.appendChild(
      card([
        el("div", { class: "flex flex-wrap items-center justify-between gap-2" }, [
          el("div", { class: "text-sm text-slate-500" }, [
            "Total: ",
            el("span", { class: "font-semibold text-slate-900" }, String(items.length)),
            unread ? el("span", { class: "ml-2 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800" }, `${unread} não lida(s)`) : null
          ]),
          el("div", { class: "flex flex-wrap items-center gap-2" }, [clearBtn])
        ]),
        el("div", { class: "mt-3 space-y-2" }, [
          ...items.map((n) =>
            el("div", { class: `relative rounded-2xl border border-slate-200 bg-white p-4 ${n.readAt ? "opacity-80" : ""}` }, [
              // Data/Hora sempre no canto do card inteiro
              el("div", { class: "absolute right-3 top-3 text-right" }, [
                el("div", { class: "text-xs font-semibold text-slate-500" }, formatArrivedTime(n.createdAt) || ""),
                el("div", { class: "mt-0.5 text-[11px] text-slate-400" }, formatArrivedDate(n.createdAt) || "")
              ]),

              // Conteúdo com padding à direita para não sobrepor a data/hora
              el("div", { class: "min-w-0 pr-24" }, [
                el("div", { class: "flex flex-wrap items-center gap-2" }, [
                  el(
                    "span",
                    { class: `inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${badge(n.type)}` },
                    n.type
                  ),
                  el("div", { class: "truncate text-base font-semibold text-slate-900" }, n.title)
                ]),
                el("div", { class: "mt-2 text-sm text-slate-700" }, n.message || "—")
              ]),

              n.readAt
                ? null
                : el("div", { class: "mt-3 flex justify-start" }, [
                    el(
                      "button",
                      {
                        type: "button",
                        class:
                          "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                        onclick: () => {
                          markAsRead(n.id);
                          emit(EVENTS.DATA_CHANGED);
                          renderList();
                        }
                      },
                      [el("i", { dataset: { lucide: "check" }, class: "h-4 w-4" }), "Lido"]
                    )
                  ])
            ])
          )
        ])
      ])
    );

    // Recria ícones após re-render (marcar/limpar).
    globalThis.lucide?.createIcons?.();
  }

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({
        title: "Notificações",
        right: el("div", { class: "flex flex-wrap items-center gap-2" }, [refreshBtn, devTestBtn, devSystemBtn])
      }),
      pinnedHost,
      listHost
    ])
  );

  renderList();
}


import { exportBackup, getMeta, hardResetDb, importBackup } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { downloadTextFile, readFileAsText } from "../utils.js";
import { card, el, pageHeader } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

function summaryText(summary) {
  const parts = [];
  parts.push(`Clientes: +${summary.clients.created} (atualizados: ${summary.clients.updated}, ignorados: ${summary.clients.skipped})`);
  parts.push(`Serviços: +${summary.services.created} (atualizados: ${summary.services.updated}, ignorados: ${summary.services.skipped})`);
  parts.push(`Agenda: +${summary.records.created} (ignorados: ${summary.records.skipped})`);
  parts.push(`Orçamentos: +${summary.budgets.created} (ignorados: ${summary.budgets.skipped})`);
  return parts.join("\n");
}

export function renderBackup(container) {
  const meta = getMeta();

  const exportBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-soft hover:bg-slate-800"
    },
    [el("i", { dataset: { lucide: "download" }, class: "h-4 w-4" }), "Exportar backup (.json)"]
  );

  const importInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    class:
      "block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
  });

  const resetBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
    },
    [el("i", { dataset: { lucide: "trash-2" }, class: "h-4 w-4" }), "Zerar dados locais"]
  );

  exportBtn.addEventListener("click", () => {
    const backup = exportBackup();
    downloadTextFile({
      filename: `dttz-backup-${String(backup.exportedAt).slice(0, 10)}.json`,
      mime: "application/json",
      text: JSON.stringify(backup, null, 2)
    });
    showToast("Backup exportado.", { type: "success" });
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text);
      const summary = importBackup(json);
      emit(EVENTS.DATA_CHANGED);

      openModal({
        title: "Importação concluída",
        subtitle: "Duplicados foram ignorados (ou usados para preencher campos vazios).",
        content: `<pre class="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">${summaryText(
          summary
        )}</pre>`,
        actions: [
          {
            label: "Ok",
            className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          }
        ]
      });
      showToast("Backup importado.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao importar backup.", { type: "error" });
    } finally {
      importInput.value = "";
    }
  });

  resetBtn.addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Zerar dados locais",
      message: "Isso apagará todos os dados do app neste navegador. Recomendado exportar um backup antes.",
      confirmText: "Zerar agora",
      danger: true
    });
    if (!ok) return;
    hardResetDb();
    emit(EVENTS.DATA_CHANGED);
    showToast("Dados zerados.", { type: "success" });
  });

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({
        title: "Backup (JSON)",
        subtitle: "Exporte/importe todo o estado do app (localStorage)."
      }),
      el("div", { class: "grid grid-cols-1 gap-3 md:grid-cols-2" }, [
        card([
          el("div", { class: "text-sm font-semibold text-slate-900" }, "Exportar"),
          el("div", { class: "mt-1 text-sm text-slate-500" }, "Gera um arquivo `.json` com todos os dados locais."),
          el("div", { class: "mt-3" }, exportBtn)
        ]),
        card([
          el("div", { class: "text-sm font-semibold text-slate-900" }, "Importar"),
          el("div", { class: "mt-1 text-sm text-slate-500" }, "Lê um `.json`, ignora duplicados e atualiza o banco local."),
          el("div", { class: "mt-3" }, importInput)
        ])
      ]),
      card([
        el("div", { class: "text-sm font-semibold text-slate-900" }, "Estado local"),
        el(
          "div",
          { class: "mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-4" },
          [
            el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Clientes"),
              el("div", { class: "mt-1 text-lg font-semibold text-slate-900" }, String(meta.counts.clients))
            ]),
            el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Serviços"),
              el("div", { class: "mt-1 text-lg font-semibold text-slate-900" }, String(meta.counts.services))
            ]),
            el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Agenda"),
              el("div", { class: "mt-1 text-lg font-semibold text-slate-900" }, String(meta.counts.records))
            ]),
            el("div", { class: "rounded-xl border border-slate-200 bg-slate-50 p-3" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Orçamentos"),
              el("div", { class: "mt-1 text-lg font-semibold text-slate-900" }, String(meta.counts.budgets))
            ])
          ]
        ),
        el("div", { class: "mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500" }, [
          el("div", {}, [`Chave: `, el("span", { class: "font-mono text-slate-700" }, meta.storageKey)]),
          el("div", {}, [`Atualizado em: `, el("span", { class: "font-mono text-slate-700" }, meta.updatedAt)])
        ]),
        el("div", { class: "mt-4" }, resetBtn)
      ])
    ])
  );
}


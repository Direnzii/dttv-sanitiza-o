import { getMeta, hardResetDb } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { exportFullBackup, importFullBackup } from "../backupManager.js";
import { downloadTextFile, readFileAsText, readImageFileAsPngDataUrl } from "../utils.js";
import { card, clear, el, pageHeader } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import {
  applyTheme,
  clearTheme,
  getTheme,
  setAppIconDataUrl,
  setBudgetIssuerFields,
  setBudgetIssuerName,
  setBudgetPdfIconDataUrl,
  setDarkMode
} from "../theme.js";
import { isDevEnv, setDevEnv } from "../env.js";
import { clearAllNotifications } from "../notifications.js";
import { setLastBackupNow } from "../backupMeta.js";

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
  const theme = getTheme();

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
    const backup = exportFullBackup();
    downloadTextFile({
      filename: `dttv-backup-${String(backup.exportedAt).slice(0, 10)}.json`,
      mime: "application/json",
      text: JSON.stringify(backup, null, 2)
    });
    setLastBackupNow();
    showToast("Backup exportado.", { type: "success" });
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const json = JSON.parse(text);
      const summary = importFullBackup(json);
      emit(EVENTS.DATA_CHANGED);

      const pre = el("pre", {
        class:
          "whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
      });
      pre.textContent =
        `${summaryText(summary.db)}` +
        `\n\nNotificações: +${summary.notifications.created} (ignoradas: ${summary.notifications.skipped})` +
        `\nAnti-spam: +${summary.dueState.created} (atualizados: ${summary.dueState.updated}, ignorados: ${summary.dueState.skipped})`;

      openModal({
        title: "Importação concluída",
        subtitle: "Duplicados foram ignorados (ou usados para preencher campos vazios).",
        content: pre,
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

  // ----- Tema -----
  const appIconInput = el("input", {
    type: "file",
    accept: "image/png,image/jpeg,.png,.jpg,.jpeg",
    class:
      "block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
  });
  const budgetIconInput = el("input", {
    type: "file",
    accept: "image/png,image/jpeg,.png,.jpg,.jpeg",
    class:
      "block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
  });

  const appPreview = el("img", {
    src: theme.appIconDataUrl || "",
    alt: "Prévia do ícone do app",
    class: `h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200 ${theme.appIconDataUrl ? "" : "hidden"}`
  });
  const budgetPreview = el("img", {
    src: theme.budgetPdfIconDataUrl || "",
    alt: "Prévia do ícone do PDF (ORC)",
    class: `h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 ${theme.budgetPdfIconDataUrl ? "" : "hidden"}`
  });

  const clearAppBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto",
      onclick: () => {
        setAppIconDataUrl("");
        applyTheme();
        appPreview.src = "";
        appPreview.classList.add("hidden");
        showToast("Ícone do app removido.", { type: "success" });
      }
    },
    [el("i", { dataset: { lucide: "x" }, class: "h-4 w-4" }), "Remover ícone do app"]
  );
  const clearBudgetBtn = el(
    "button",
    {
      type: "button",
      class:
        "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto",
      onclick: () => {
        setBudgetPdfIconDataUrl("");
        budgetPreview.src = "";
        budgetPreview.classList.add("hidden");
        showToast("Ícone do PDF (ORC) removido.", { type: "success" });
      }
    },
    [el("i", { dataset: { lucide: "x" }, class: "h-4 w-4" }), "Remover ícone do PDF"]
  );

  appIconInput.addEventListener("change", async () => {
    const file = appIconInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsPngDataUrl(file, { maxPx: 256 });
      setAppIconDataUrl(dataUrl);
      applyTheme();
      appPreview.src = dataUrl;
      appPreview.classList.remove("hidden");
      showToast("Ícone do app atualizado.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao aplicar ícone do app.", { type: "error" });
    } finally {
      appIconInput.value = "";
    }
  });

  budgetIconInput.addEventListener("change", async () => {
    const file = budgetIconInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsPngDataUrl(file, { maxPx: 96 });
      setBudgetPdfIconDataUrl(dataUrl);
      budgetPreview.src = dataUrl;
      budgetPreview.classList.remove("hidden");
      showToast("Ícone do PDF (ORC) atualizado.", { type: "success" });
    } catch (err) {
      showToast(err?.message || "Falha ao aplicar ícone do PDF.", { type: "error" });
    } finally {
      budgetIconInput.value = "";
    }
  });

  // ----- Informações de orçamento (fixas no topo do PDF do ORC) -----
  const issuerName = el("input", {
    type: "text",
    value: theme.budgetIssuerName || "",
    placeholder: "Ex.: Minha Empresa LTDA",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const fields = (Array.isArray(theme.budgetIssuerFields) ? theme.budgetIssuerFields : [])
    .slice(0, 3)
    .map((x, i) => ({
      title: String(x?.title ?? `Campo ${i + 1}`).trim() || `Campo ${i + 1}`,
      value: String(x?.value ?? "").trim()
    }));

  const fieldsCount = el("input", {
    type: "number",
    min: "0",
    max: "3",
    step: "1",
    value: String(Math.min(3, Math.max(0, fields.length))),
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  const fieldsHost = el("div", { class: "space-y-3" });

  const clampCount = () => {
    const n = Math.max(0, Math.min(3, Math.floor(Number(fieldsCount.value || 0))));
    fieldsCount.value = String(n);
    return n;
  };
  const ensureLen = (n) => {
    while (fields.length < n) {
      const i = fields.length;
      fields.push({ title: `Campo ${i + 1}`, value: "" });
    }
    if (fields.length > n) fields.splice(n);
  };
  const persistBudgetInfo = () => {
    setBudgetIssuerName(issuerName.value);
    setBudgetIssuerFields(fields);
  };

  function renderBudgetInfoFields() {
    clear(fieldsHost);
    const n = clampCount();
    ensureLen(n);
    for (let i = 0; i < n; i++) {
      const t = el("input", {
        type: "text",
        value: fields[i].title,
        placeholder: "Título (ex.: CNPJ)",
        class:
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      });
      const v = el("input", {
        type: "text",
        value: fields[i].value,
        placeholder: "Valor (ex.: 00.000.000/0000-00)",
        class:
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      });

      t.addEventListener("input", () => {
        fields[i].title = String(t.value ?? "");
      });
      v.addEventListener("input", () => {
        fields[i].value = String(v.value ?? "");
      });
      t.addEventListener("change", persistBudgetInfo);
      v.addEventListener("change", persistBudgetInfo);

      fieldsHost.appendChild(
        el("div", { class: "rounded-2xl border border-slate-200 bg-white p-3" }, [
          el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, `Campo ${i + 1}`),
          el("div", { class: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" }, [
            el("div", { class: "space-y-1" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Título"),
              t
            ]),
            el("div", { class: "space-y-1" }, [
              el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Valor"),
              v
            ])
          ])
        ])
      );
    }
    persistBudgetInfo();
  }

  issuerName.addEventListener("change", () => {
    persistBudgetInfo();
    showToast("Informações de orçamento atualizadas.", { type: "success" });
  });
  fieldsCount.addEventListener("input", renderBudgetInfoFields);
  fieldsCount.addEventListener("change", () => {
    renderBudgetInfoFields();
    showToast("Informações de orçamento atualizadas.", { type: "success" });
  });
  renderBudgetInfoFields();

  // ----- Ambiente Dev -----
  function askDevPassword() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(Boolean(v));
      };

      const pass = el("input", {
        type: "password",
        placeholder: "Senha",
        autocomplete: "current-password",
        class:
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
      });

      const content = el("div", { class: "space-y-2" }, [
        el("div", { class: "text-sm text-slate-600" }, "Digite a senha para ativar o Ambiente Dev."),
        pass
      ]);

      openModal({
        title: "Ativar Ambiente Dev",
        subtitle: "Requer senha",
        content,
        onClose: () => finish(false),
        actions: [
          { label: "Cancelar", onClick: () => finish(false) },
          {
            label: "Ativar",
            autofocus: true,
            className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
            onClick: () => {
              if (String(pass.value || "") === "112233") return finish(true);
              showToast("Senha incorreta.", { type: "error" });
              pass.focus();
              return false;
            }
          }
        ]
      });

      requestAnimationFrame(() => pass.focus());
    });
  }

  const devToggleBtn = el("button", {
    type: "button",
    class: "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
    title: "Ambiente Dev",
    "aria-label": "Ambiente Dev"
  });
  const devKnob = el("span", { class: "inline-block h-5 w-5 transform rounded-full bg-white transition-transform" });
  devToggleBtn.appendChild(devKnob);

  const devStatus = el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Desativado");
  const devActionsHost = el("div");

  async function resetDev() {
    const ok = await confirmDialog({
      title: "Reset Dev",
      message:
        "Isso vai limpar dados locais, notificações, estado anti-spam e tema (ícones). Útil quando algo ficou preso no cache/storage.",
      confirmText: "Resetar agora",
      danger: true
    });
    if (!ok) return;

    // DB principal
    hardResetDb();
    // Notificações
    clearAllNotifications();
    // Estado anti-spam (periodicidade)
    try {
      localStorage.removeItem("dttv_due_notifications_v1");
      localStorage.removeItem("dt" + "tz_due_notifications_v1");
    } catch {
      // ignore
    }
    // Tema
    clearTheme();
    applyTheme();
    // Dev env off
    setDevEnv(false);

    // Limpa filtros de sessão que podem confundir em dev
    try {
      sessionStorage.removeItem("dttv_records_filters_v1");
    } catch {
      // ignore
    }

    emit(EVENTS.DATA_CHANGED);
    showToast("Reset Dev concluído.", { type: "success" });
  }

  function syncDevUi() {
    const on = isDevEnv();
    devToggleBtn.classList.toggle("bg-emerald-600", on);
    devToggleBtn.classList.toggle("bg-slate-200", !on);
    devKnob.classList.toggle("translate-x-5", on);
    devKnob.classList.toggle("translate-x-1", !on);
    devStatus.textContent = on ? "Ativado" : "Desativado";

    clear(devActionsHost);
    if (on) {
      devActionsHost.appendChild(
        el("div", { class: "mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" }, [
          el(
            "button",
            {
              type: "button",
              class:
                "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 sm:w-auto",
              onclick: resetDev
            },
            [el("i", { dataset: { lucide: "rotate-ccw" }, class: "h-4 w-4" }), "Reset Dev"]
          ),
          el(
            "div",
            { class: "text-xs text-slate-500" },
            "Dica: use quando botões/estado não aparecem por cache/storage antigo."
          )
        ])
      );
      globalThis.lucide?.createIcons?.();
    }
  }

  devToggleBtn.addEventListener("click", async () => {
    const on = isDevEnv();
    if (on) {
      setDevEnv(false);
      syncDevUi();
      return;
    }

    const ok = await askDevPassword();
    if (!ok) {
      syncDevUi();
      return;
    }
    setDevEnv(true);
    syncDevUi();
  });
  syncDevUi();

  // ----- Modo Escuro -----
  const darkToggleBtn = el("button", {
    type: "button",
    class: "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
    title: "Modo Escuro",
    "aria-label": "Modo Escuro"
  });
  const darkKnob = el("span", { class: "inline-block h-5 w-5 transform rounded-full bg-white transition-transform" });
  darkToggleBtn.appendChild(darkKnob);

  const darkStatus = el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Desativado");

  function syncDarkUi() {
    const on = getTheme().darkMode;
    darkToggleBtn.classList.toggle("bg-emerald-600", on);
    darkToggleBtn.classList.toggle("bg-slate-200", !on);
    darkKnob.classList.toggle("translate-x-5", on);
    darkKnob.classList.toggle("translate-x-1", !on);
    darkStatus.textContent = on ? "Ativado" : "Desativado";
  }

  darkToggleBtn.addEventListener("click", () => {
    const on = getTheme().darkMode;
    setDarkMode(!on);
    applyTheme();
    syncDarkUi();
  });
  syncDarkUi();

  container.appendChild(
    el("div", { class: "space-y-4" }, [
      pageHeader({
        title: "Config"
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
      ]),
      card([
        el("div", { class: "text-sm font-semibold text-slate-900" }, "Tema"),
        el("div", { class: "mt-1 text-sm text-slate-500" }, "Personalize o ícone do app e o ícone usado no PDF de ORC (PNG/JPG)."),

        el("div", { class: "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" }, [
          el("div", { class: "space-y-2" }, [
            el("div", { class: "flex items-center justify-between gap-3" }, [
              el("div", { class: "text-sm font-semibold text-slate-900" }, "Ícone do app"),
              appPreview
            ]),
            appIconInput,
            el("div", { class: "flex flex-col gap-2 sm:flex-row" }, [clearAppBtn])
          ]),
          el("div", { class: "space-y-2" }, [
            el("div", { class: "flex items-center justify-between gap-3" }, [
              el("div", { class: "text-sm font-semibold text-slate-900" }, "Ícone do PDF (ORC)"),
              budgetPreview
            ]),
            budgetIconInput,
            el("div", { class: "flex flex-col gap-2 sm:flex-row" }, [clearBudgetBtn])
          ])
        ]),
        el("div", { class: "mt-4 border-t border-slate-200 pt-4" }, [
          el("div", { class: "flex items-start justify-between gap-3" }, [
            el("div", {}, [
              el("div", { class: "text-sm font-semibold text-slate-900" }, "Modo Escuro"),
              el("div", { class: "mt-1 text-sm text-slate-500" }, "Alterna entre tema claro e escuro.")
            ]),
            el("div", { class: "shrink-0 text-right" }, [darkStatus, el("div", { class: "mt-2 flex justify-end" }, [darkToggleBtn])])
          ])
        ])
      ]),
      card([
        el("div", { class: "text-sm font-semibold text-slate-900" }, "Informações de orçamento"),
        el(
          "div",
          { class: "mt-1 text-sm text-slate-500" },
          "Campos fixos que aparecem no topo do PDF do ORC (ex.: CNPJ, CPF, Endereço)."
        ),
        el("div", { class: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" }, [
          el("div", { class: "space-y-1" }, [
            el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Nome"),
            issuerName
          ]),
          el("div", { class: "space-y-1" }, [
            el("div", { class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, "Campos (0-3)"),
            fieldsCount
          ])
        ]),
        el("div", { class: "mt-3" }, [fieldsHost])
      ]),
      card([
        el("div", { class: "flex items-start justify-between gap-3" }, [
          el("div", {}, [
            el("div", { class: "text-sm font-semibold text-slate-900" }, "Ambiente Dev"),
            el(
              "div",
              { class: "mt-1 text-sm text-slate-500" },
              ""
            )
          ]),
          el("div", { class: "shrink-0 text-right" }, [devStatus, el("div", { class: "mt-2 flex justify-end" }, [devToggleBtn])])
        ]),
        devActionsHost
      ])
    ])
  );
}


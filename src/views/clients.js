import { createClient, deleteClient, listClients, updateClient } from "../db.js";
import { EVENTS, emit } from "../state.js";
import { card, clear, el, emptyState, input, pageHeader } from "../ui/components.js";
import { confirmDialog, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";

function clientForm({ initial = {}, onSave }) {
  const form = el("form", { class: "space-y-3" });
  form.appendChild(input({ label: "Nome *", name: "name", value: initial.name || "", placeholder: "Ex.: Maria Silva", required: true }));
  form.appendChild(input({ label: "Contato", name: "contact", value: initial.contact || "", placeholder: "Telefone / WhatsApp" }));
  form.appendChild(input({ label: "E-mail", name: "email", value: initial.email || "", placeholder: "email@exemplo.com", type: "email" }));
  form.appendChild(input({ label: "Localização", name: "location", value: initial.location || "", placeholder: "Cidade / Bairro / Endereço" }));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      location: String(fd.get("location") || "").trim()
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

export function renderClients(container) {
  const state = { q: "" };
  const listHost = el("div");

  const search = el("input", {
    type: "search",
    placeholder: "Buscar cliente...",
    class:
      "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
  });

  function openCreate() {
    const form = clientForm({
      initial: {},
      onSave: async (payload) => {
        createClient(payload);
        emit(EVENTS.DATA_CHANGED);
        showToast("Cliente criado.", { type: "success" });
        modal.close();
      }
    });

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
          onClick: () => form.requestSubmit()
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

    const modal = openModal({
      title: "Editar cliente",
      subtitle: "Atualize os dados do cliente.",
      content: form,
      actions: [
        { label: "Fechar" },
        {
          label: "Salvar alterações",
          className: "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800",
          onClick: () => form.requestSubmit()
        }
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
      return;
    }

    listHost.appendChild(
      card([
        el("div", { class: "overflow-hidden rounded-xl border border-slate-200" }, [
          el("table", { class: "w-full text-left text-sm" }, [
            el("thead", { class: "bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500" }, [
              el("tr", {}, [
                el("th", { class: "px-3 py-2" }, "Nome"),
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
                  el("td", { class: "px-3 py-2 hidden md:table-cell text-slate-700" }, c.contact || "—"),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, c.email || "—"),
                  el("td", { class: "px-3 py-2 hidden lg:table-cell text-slate-700" }, c.location || "—"),
                  el("td", { class: "px-3 py-2" }, [
                    el("div", { class: "flex items-center justify-end gap-2" }, [
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100",
                          onclick: () => openEdit(c)
                        },
                        [el("i", { dataset: { lucide: "pencil" }, class: "h-4 w-4" }), "Editar"]
                      ),
                      el(
                        "button",
                        {
                          type: "button",
                          class:
                            "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700",
                          onclick: () => onDelete(c)
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
  }

  const right = el("div", { class: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center" }, [
    el("div", { class: "w-full sm:w-72" }, [search]),
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
      pageHeader({ title: "Clientes", subtitle: "CRUD completo de clientes (nome obrigatório).", right }),
      listHost
    ])
  );

  search.addEventListener("input", () => {
    state.q = search.value;
    renderList();
  });

  renderList();
}

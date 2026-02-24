export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null) continue;
    if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset" && typeof v === "object") Object.assign(node.dataset, v);
    else node.setAttribute(k, String(v));
  }
  const arr = Array.isArray(children) ? children : [children];
  for (const c of arr) {
    if (c === undefined || c === null) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  node.innerHTML = "";
}

export function pageHeader({ title, subtitle, right } = {}) {
  const left = el("div", {}, [
    el("div", { class: "text-xl font-semibold text-slate-900" }, title || ""),
    subtitle ? el("div", { class: "mt-0.5 text-sm text-slate-500" }, subtitle) : null
  ]);

  // Sempre empilha: título em cima, ações/filtros abaixo.
  // Isso evita inputs "espremidos" ao lado do título em telas menores.
  return el("div", { class: "space-y-3" }, [
    el("div", { class: "w-full" }, left),
    right ? el("div", { class: "w-full" }, right) : null
  ]);
}

export function card(children, { className = "" } = {}) {
  return el("div", { class: `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}` }, children);
}

export function input({ label, name, value = "", type = "text", placeholder = "", required = false } = {}) {
  const id = `f_${name}_${Math.random().toString(36).slice(2, 7)}`;
  return el("div", { class: "space-y-1" }, [
    el("label", { for: id, class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, label || ""),
    el("input", {
      id,
      name,
      type,
      value,
      placeholder,
      required: required ? "true" : null,
      class:
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    })
  ]);
}

export function textarea({ label, name, value = "", placeholder = "", rows = 4 } = {}) {
  const id = `f_${name}_${Math.random().toString(36).slice(2, 7)}`;
  return el("div", { class: "space-y-1" }, [
    el("label", { for: id, class: "text-xs font-semibold uppercase tracking-wider text-slate-500" }, label || ""),
    el("textarea", {
      id,
      name,
      rows: String(rows),
      placeholder,
      value: String(value ?? ""),
      class:
        "w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
    })
  ]);
}

export function emptyState({ title = "Nada por aqui", description = "Ainda não há dados cadastrados.", action } = {}) {
  return el("div", { class: "grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-8" }, [
    el("div", { class: "max-w-md text-center" }, [
      el("div", { class: "text-base font-semibold text-slate-900" }, title),
      el("div", { class: "mt-1 text-sm text-slate-500" }, description),
      action ? el("div", { class: "mt-4 flex justify-center" }, action) : null
    ])
  ]);
}

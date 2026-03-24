import { loadJSON, saveJSON, getStorageKey } from "./storage.js";
import { nowISO, normalizeText, toNumber, uid, todayISO } from "./utils.js";

const SCHEMA_VERSION = 1;

function emptyDb() {
  return {
    version: SCHEMA_VERSION,
    updatedAt: nowISO(),
    clients: [],
    services: [],
    records: [], // agenda / serviços prestados (histórico)
    budgets: [] // orçamentos (com PDF)
  };
}

function coerceDb(raw) {
  const db = raw && typeof raw === "object" ? raw : emptyDb();
  return {
    version: SCHEMA_VERSION,
    updatedAt: typeof db.updatedAt === "string" ? db.updatedAt : nowISO(),
    clients: Array.isArray(db.clients) ? db.clients : [],
    services: Array.isArray(db.services) ? db.services : [],
    records: Array.isArray(db.records) ? db.records : [],
    budgets: Array.isArray(db.budgets) ? db.budgets : []
  };
}

let _db = coerceDb(loadJSON(emptyDb()));

const RECORD_STATUSES = new Set(["AGENDADO", "PEND. DE PAGAMENTO", "CONCLUIDO"]);

function migrateLegacyRecordStatus(r) {
  const cur = String(r?.status || "").toUpperCase();
  if (RECORD_STATUSES.has(cur)) return r;

  // Migração de status antigos → novos 3 status
  let next = "AGENDADO";
  if (cur === "FEITO") next = "CONCLUIDO";
  else if (cur === "APROVADO") next = "AGENDADO";
  else if (cur === "RECUSADO" || cur === "CANCELADO") next = "AGENDADO";

  const out = { ...r, status: next };
  if ((cur === "RECUSADO" || cur === "CANCELADO") && !String(out.statusReason || "").trim()) {
    out.statusReason = `Status antigo: ${cur}`;
  }
  return out;
}

function normalizeRecordStatus(status) {
  const s = String(status || "").trim().toUpperCase();
  // Default novo: AGENDADO (mantém compatibilidade com dados antigos).
  return RECORD_STATUSES.has(s) ? s : "AGENDADO";
}

function buildBudgetCode({ id, createdAt } = {}) {
  const dateISO = String(createdAt || "").slice(0, 10); // YYYY-MM-DD
  const yy = dateISO.slice(2, 4) || "00";
  const mm = dateISO.slice(5, 7) || "00";
  const dd = dateISO.slice(8, 10) || "00";
  const suffix = String(id || "")
    .replaceAll("-", "")
    .toUpperCase()
    .slice(0, 4) || "0000";
  return `ORC-${yy}${mm}${dd}-${suffix}`;
}

function normalizeTimeHM(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  // Aceita HH:MM
  if (!/^\d{2}:\d{2}$/.test(v)) return "";
  const [h, m] = v.split(":").map((x) => Number(x));
  if (!Number.isInteger(h) || !Number.isInteger(m)) return "";
  if (h < 0 || h > 23) return "";
  if (m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function persist() {
  _db.updatedAt = nowISO();
  saveJSON(_db);
}

function clone(value) {
  // Mantém a camada de UI sem risco de mutação acidental.
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function ensureBudgetCodes() {
  let changed = false;
  for (const b of _db.budgets) {
    if (!b || typeof b !== "object") continue;
    if (!b.code) {
      b.code = buildBudgetCode({ id: b.id, createdAt: b.createdAt });
      changed = true;
    }
  }
  if (changed) persist();
}

// Migração: garante `code` em orçamentos antigos (executa uma vez no load).
ensureBudgetCodes();

// Migração: normaliza status antigos para os 3 atuais.
{
  let changed = false;
  _db.records = _db.records.map((r) => {
    const next = migrateLegacyRecordStatus(r);
    if (next !== r) changed = true;
    return next;
  });
  if (changed) persist();
}

export function getMeta() {
  return {
    storageKey: getStorageKey(),
    version: _db.version,
    updatedAt: _db.updatedAt,
    counts: {
      clients: _db.clients.length,
      services: _db.services.length,
      records: _db.records.length,
      budgets: _db.budgets.length
    }
  };
}

// ---------- Queries ----------

export function listClients({ q } = {}) {
  const query = normalizeText(q);
  const out = _db.clients
    .filter((c) => (query ? normalizeText(c.name).includes(query) : true))
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  return clone(out);
}

export function listServices({ q } = {}) {
  const query = normalizeText(q);
  const out = _db.services
    .filter((s) => (query ? normalizeText(s.name).includes(query) : true))
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  return clone(out);
}

export function listRecords({ startISO, endISO, q } = {}) {
  const query = normalizeText(q);
  const a = String(startISO ?? "0000-01-01").slice(0, 10);
  const b = String(endISO ?? "9999-12-31").slice(0, 10);
  const out = _db.records
    .filter((r) => {
      const d = String(r.dateISO ?? "").slice(0, 10);
      const okRange = d >= a && d <= b;
      const okQuery = query
        ? normalizeText(r.clientName).includes(query) ||
          (Array.isArray(r.items) ? r.items.some((it) => normalizeText(it.name).includes(query)) : false)
        : true;
      return okRange && okQuery;
    })
    .slice()
    .sort((x, y) => {
      const xd = String(x.dateISO || "");
      const yd = String(y.dateISO || "");
      const xt = String(x.timeHM || "00:00");
      const yt = String(y.timeHM || "00:00");
      return `${yd}T${yt}`.localeCompare(`${xd}T${xt}`);
    });
  return clone(out);
}

export function listBudgets({ q } = {}) {
  const query = normalizeText(q);
  const out = _db.budgets
    .filter((b) => {
      if (!query) return true;
      return (
        normalizeText(b.clientName).includes(query) ||
        normalizeText(b.code).includes(query) ||
        normalizeText(b.id).includes(query)
      );
    })
    .slice()
    .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
  return clone(out);
}

export function getClientById(id) {
  return clone(_db.clients.find((c) => c.id === id) || null);
}

export function getServiceById(id) {
  return clone(_db.services.find((s) => s.id === id) || null);
}

export function getRecordById(id) {
  return clone(_db.records.find((r) => r.id === id) || null);
}

export function getBudgetById(id) {
  return clone(_db.budgets.find((b) => b.id === id) || null);
}

// ---------- Mutations: Clients ----------

export function createClient(input) {
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("Nome do cliente é obrigatório.");

  const now = nowISO();
  const periodValueRaw = toNumber(input?.periodValue, 0);
  const periodValue = periodValueRaw > 0 ? Math.max(1, Math.floor(periodValueRaw)) : 0;
  const periodUnit = periodValue > 0 ? String(input?.periodUnit || "months") : "";
  if (periodValue > 0 && periodUnit !== "days" && periodUnit !== "months") {
    throw new Error("Periodicidade: unidade inválida (dias/meses).");
  }

  const client = {
    id: uid(),
    name,
    contact: String(input?.contact ?? "").trim(),
    email: String(input?.email ?? "").trim(),
    location: String(input?.location ?? "").trim(),
    // Periodicidade recomendada (para alertas)
    periodValue,
    periodUnit,
    createdAt: now,
    updatedAt: now
  };

  _db.clients.push(client);
  persist();
  return clone(client);
}

export function updateClient(id, patch) {
  const idx = _db.clients.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Cliente não encontrado.");

  const next = { ..._db.clients[idx] };
  if (patch?.name !== undefined) {
    const name = String(patch.name ?? "").trim();
    if (!name) throw new Error("Nome do cliente é obrigatório.");
    next.name = name;
  }
  if (patch?.contact !== undefined) next.contact = String(patch.contact ?? "").trim();
  if (patch?.email !== undefined) next.email = String(patch.email ?? "").trim();
  if (patch?.location !== undefined) next.location = String(patch.location ?? "").trim();

  // Periodicidade recomendada
  if (patch?.periodValue !== undefined) {
    const pvRaw = toNumber(patch.periodValue, 0);
    next.periodValue = pvRaw > 0 ? Math.max(1, Math.floor(pvRaw)) : 0;
  }
  if (patch?.periodUnit !== undefined) {
    next.periodUnit = String(patch.periodUnit || "");
  }

  if (toNumber(next.periodValue, 0) > 0) {
    if (next.periodUnit !== "days" && next.periodUnit !== "months") {
      throw new Error("Periodicidade: unidade inválida (dias/meses).");
    }
  } else {
    // desabilita periodicidade
    next.periodUnit = "";
  }
  // Campo legado: não usamos mais o start no cadastro do cliente.
  // Mantemos compatibilidade na importação, mas removemos do registro ativo.
  if ("periodStartISO" in next) delete next.periodStartISO;

  next.updatedAt = nowISO();

  _db.clients[idx] = next;
  persist();
  return clone(next);
}

export function deleteClient(id) {
  const before = _db.clients.length;
  _db.clients = _db.clients.filter((c) => c.id !== id);
  if (_db.clients.length === before) throw new Error("Cliente não encontrado.");
  persist();
}

// ---------- Mutations: Services ----------

export function createService(input) {
  const name = String(input?.name ?? "").trim();
  if (!name) throw new Error("Nome do serviço é obrigatório.");
  const now = nowISO();
  const service = {
    id: uid(),
    name,
    detail: String(input?.detail ?? "").trim(),
    totalCost: toNumber(input?.totalCost, 0),
    createdAt: now,
    updatedAt: now
  };
  _db.services.push(service);
  persist();
  return clone(service);
}

export function updateService(id, patch) {
  const idx = _db.services.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Serviço não encontrado.");

  const next = { ..._db.services[idx] };
  if (patch?.name !== undefined) {
    const name = String(patch.name ?? "").trim();
    if (!name) throw new Error("Nome do serviço é obrigatório.");
    next.name = name;
  }
  if (patch?.detail !== undefined) next.detail = String(patch.detail ?? "").trim();
  if (patch?.totalCost !== undefined) next.totalCost = toNumber(patch.totalCost, 0);
  next.updatedAt = nowISO();

  _db.services[idx] = next;
  persist();
  return clone(next);
}

export function deleteService(id) {
  const before = _db.services.length;
  _db.services = _db.services.filter((s) => s.id !== id);
  if (_db.services.length === before) throw new Error("Serviço não encontrado.");
  persist();
}

// ---------- Mutations: Records (Agenda) ----------

function normalizeQty(qty) {
  const n = Math.floor(toNumber(qty, 1));
  return n >= 1 ? n : 1;
}

function buildItemsFromServiceIds(serviceIds) {
  const ids = Array.isArray(serviceIds) ? serviceIds : [];
  const byId = new Map(_db.services.map((s) => [s.id, s]));
  const items = [];
  for (const entry of ids) {
    const isObj = entry && typeof entry === "object";
    const sid = isObj ? String(entry.serviceId || "") : String(entry || "");
    const qty = isObj ? normalizeQty(entry.qty) : 1;
    const s = byId.get(sid);
    if (!s) continue;
    const unitCost = toNumber(s.totalCost, 0);
    items.push({
      serviceId: s.id,
      name: s.name,
      detail: s.detail,
      qty,
      unitCost,
      cost: unitCost * qty
    });
  }
  return items;
}

function computeTotal(items, discount = 0) {
  const sum = (Array.isArray(items) ? items : []).reduce((acc, it) => acc + toNumber(it.cost, 0), 0);
  return Math.max(0, sum - toNumber(discount, 0));
}

export function createRecord(input) {
  const dateISO = String(input?.dateISO ?? todayISO()).slice(0, 10);
  const timeHM = normalizeTimeHM(input?.timeHM);
  const clientId = String(input?.clientId ?? "").trim();
  const client = _db.clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Selecione um cliente válido.");

  const items = buildItemsFromServiceIds(input?.serviceIds);
  if (items.length === 0) throw new Error("Selecione pelo menos 1 serviço.");

  const status = normalizeRecordStatus(input?.status);
  const statusReason = String(input?.statusReason ?? "").trim(); // agora é "observação" (opcional)

  const now = nowISO();
  const record = {
    id: uid(),
    dateISO,
    timeHM,
    clientId: client.id,
    clientName: client.name, // snapshot (histórico não quebra se o cliente for editado/deletado)
    items,
    notes: String(input?.notes ?? "").trim(),
    total: computeTotal(items, 0),
    status,
    statusReason,
    createdAt: now,
    updatedAt: now
  };

  _db.records.push(record);
  persist();
  return clone(record);
}

export function updateRecord(id, patch) {
  const idx = _db.records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Registro não encontrado.");

  const cur = _db.records[idx];
  const next = { ...cur };

  if (patch?.dateISO !== undefined) next.dateISO = String(patch.dateISO ?? "").slice(0, 10) || todayISO();
  if (patch?.timeHM !== undefined) next.timeHM = normalizeTimeHM(patch.timeHM);

  if (patch?.clientId !== undefined) {
    const client = _db.clients.find((c) => c.id === String(patch.clientId));
    if (!client) throw new Error("Selecione um cliente válido.");
    next.clientId = client.id;
    next.clientName = client.name;
  }

  if (patch?.serviceIds !== undefined) {
    const items = buildItemsFromServiceIds(patch.serviceIds);
    if (items.length === 0) throw new Error("Selecione pelo menos 1 serviço.");
    next.items = items;
    next.total = computeTotal(items, 0);
  }

  if (patch?.notes !== undefined) next.notes = String(patch.notes ?? "").trim();

  if (patch?.status !== undefined) {
    const nextStatus = normalizeRecordStatus(patch.status);
    const isChanging = nextStatus !== String(cur.status || "AGENDADO");
    next.status = nextStatus;
  }

  if (patch?.statusReason !== undefined) next.statusReason = String(patch.statusReason ?? "").trim();

  next.updatedAt = nowISO();

  _db.records[idx] = next;
  persist();
  return clone(next);
}

export function deleteRecord(id) {
  const before = _db.records.length;
  _db.records = _db.records.filter((r) => r.id !== id);
  if (_db.records.length === before) throw new Error("Registro não encontrado.");
  persist();
}

// ---------- Mutations: Budgets ----------

export function createBudget(input) {
  const clientId = String(input?.clientId ?? "").trim();
  const client = _db.clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Selecione um cliente válido.");

  const items = buildItemsFromServiceIds(input?.serviceIds);
  if (items.length === 0) throw new Error("Selecione pelo menos 1 serviço.");

  const additionalFields = (() => {
    const raw = Array.isArray(input?.additionalFields) ? input.additionalFields : [];
    return raw.slice(0, 3).map((x, i) => ({
      title: String(x?.title ?? "").trim() || `Campo ${i + 1}`,
      value: String(x?.value ?? "").trim()
    }));
  })();

  const discount = toNumber(input?.discount, 0);
  const validityDays = Math.max(0, Math.floor(toNumber(input?.validityDays, 7)));
  const now = nowISO();
  const id = uid();

  const budget = {
    id,
    code: buildBudgetCode({ id, createdAt: now }),
    clientId: client.id,
    clientName: client.name, // snapshot
    items,
    notes: String(input?.notes ?? "").trim(),
    additionalFields,
    discount,
    total: computeTotal(items, discount),
    validityDays,
    createdAt: now,
    updatedAt: now
  };

  _db.budgets.push(budget);
  persist();
  return clone(budget);
}

export function updateBudget(id, patch) {
  const idx = _db.budgets.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error("Orçamento não encontrado.");

  const cur = _db.budgets[idx];
  const next = { ...cur };

  if (patch?.clientId !== undefined) {
    const client = _db.clients.find((c) => c.id === String(patch.clientId));
    if (!client) throw new Error("Selecione um cliente válido.");
    next.clientId = client.id;
    next.clientName = client.name;
  }
  if (patch?.serviceIds !== undefined) {
    const items = buildItemsFromServiceIds(patch.serviceIds);
    if (items.length === 0) throw new Error("Selecione pelo menos 1 serviço.");
    next.items = items;
  }
  if (patch?.notes !== undefined) next.notes = String(patch.notes ?? "").trim();
  if (patch?.additionalFields !== undefined) {
    const raw = Array.isArray(patch.additionalFields) ? patch.additionalFields : [];
    next.additionalFields = raw.slice(0, 3).map((x, i) => ({
      title: String(x?.title ?? "").trim() || `Campo ${i + 1}`,
      value: String(x?.value ?? "").trim()
    }));
  }
  if (patch?.discount !== undefined) next.discount = toNumber(patch.discount, 0);
  if (patch?.validityDays !== undefined) next.validityDays = Math.max(0, Math.floor(toNumber(patch.validityDays, 7)));

  next.total = computeTotal(next.items, next.discount);
  next.updatedAt = nowISO();

  // garante código (ex.: dados antigos / import)
  if (!next.code) next.code = buildBudgetCode({ id: next.id, createdAt: next.createdAt });

  _db.budgets[idx] = next;
  persist();
  return clone(next);
}

export function deleteBudget(id) {
  const before = _db.budgets.length;
  _db.budgets = _db.budgets.filter((b) => b.id !== id);
  if (_db.budgets.length === before) throw new Error("Orçamento não encontrado.");
  persist();
}

export function createRecordFromBudget(budgetId, { dateISO, timeHM } = {}) {
  const b = _db.budgets.find((x) => x.id === budgetId);
  if (!b) throw new Error("Orçamento não encontrado.");
  const now = nowISO();
  const record = {
    id: uid(),
    dateISO: String(dateISO ?? todayISO()).slice(0, 10),
    timeHM: normalizeTimeHM(timeHM),
    clientId: b.clientId,
    clientName: b.clientName,
    items: clone(b.items),
    notes: b.notes ? `Convertido de orçamento ${b.id}\n${b.notes}` : `Convertido de orçamento ${b.id}`,
    total: computeTotal(b.items, 0),
    status: "AGENDADO",
    statusReason: "",
    createdAt: now,
    updatedAt: now
  };
  _db.records.push(record);
  persist();
  return clone(record);
}

// ---------- Backup / Restore ----------

export function exportBackup() {
  return clone({
    exportedAt: nowISO(),
    app: "dttv-agenda-servicos",
    version: SCHEMA_VERSION,
    data: clone(_db)
  });
}

function mergeByName({ incoming, existing, uniqueKey }) {
  // Retorna { merged, createdCount, updatedCount, skippedCount }
  const exist = existing.slice();
  const index = new Map(exist.map((x) => [normalizeText(x[uniqueKey]), x]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const it of incoming) {
    const key = normalizeText(it?.[uniqueKey]);
    if (!key) {
      skipped++;
      continue;
    }
    const found = index.get(key);
    if (!found) {
      exist.push(it);
      index.set(key, it);
      created++;
      continue;
    }

    // Atualização "conservadora": só preenche vazios / zero.
    let changed = false;
    for (const [k, v] of Object.entries(it)) {
      if (k === "id" || k === "createdAt") continue;
      if (v === null || v === undefined) continue;

      const cur = found[k];
      const curIsEmpty =
        cur === null ||
        cur === undefined ||
        (typeof cur === "string" && cur.trim() === "") ||
        (typeof cur === "number" && cur === 0);

      if (curIsEmpty) {
        found[k] = v;
        changed = true;
      }
    }
    if (changed) {
      found.updatedAt = nowISO();
      updated++;
    } else {
      skipped++;
    }
  }

  return { merged: exist, createdCount: created, updatedCount: updated, skippedCount: skipped };
}

export function importBackup(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Backup inválido (JSON).");
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;

  const incoming = coerceDb(data);
  const summary = {
    clients: { created: 0, updated: 0, skipped: 0 },
    services: { created: 0, updated: 0, skipped: 0 },
    records: { created: 0, skipped: 0 },
    budgets: { created: 0, skipped: 0 }
  };

  // Clients (dedupe por nome)
  {
    const cleaned = incoming.clients
      .map((c) => ({
        id: String(c.id || uid()),
        name: String(c.name ?? "").trim(),
        contact: String(c.contact ?? "").trim(),
        email: String(c.email ?? "").trim(),
        location: String(c.location ?? "").trim(),
        periodValue: Math.max(0, Math.floor(toNumber(c.periodValue, 0))),
        periodUnit: String(c.periodUnit ?? "").trim(),
        createdAt: typeof c.createdAt === "string" ? c.createdAt : nowISO(),
        updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : nowISO()
      }))
      .filter((c) => c.name);

    const r = mergeByName({ incoming: cleaned, existing: _db.clients, uniqueKey: "name" });
    _db.clients = r.merged;
    summary.clients.created = r.createdCount;
    summary.clients.updated = r.updatedCount;
    summary.clients.skipped = r.skippedCount;
  }

  // Services (dedupe por nome)
  {
    const cleaned = incoming.services
      .map((s) => ({
        id: String(s.id || uid()),
        name: String(s.name ?? "").trim(),
        detail: String(s.detail ?? "").trim(),
        totalCost: toNumber(s.totalCost, 0),
        createdAt: typeof s.createdAt === "string" ? s.createdAt : nowISO(),
        updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : nowISO()
      }))
      .filter((s) => s.name);

    const r = mergeByName({ incoming: cleaned, existing: _db.services, uniqueKey: "name" });
    _db.services = r.merged;
    summary.services.created = r.createdCount;
    summary.services.updated = r.updatedCount;
    summary.services.skipped = r.skippedCount;
  }

  // Records (dedupe por id)
  {
    const existingIds = new Set(_db.records.map((r) => r.id));
    for (const r of incoming.records) {
      const id = String(r?.id ?? "");
      if (!id || existingIds.has(id)) {
        summary.records.skipped++;
        continue;
      }
      _db.records.push(r);
      existingIds.add(id);
      summary.records.created++;
    }
  }

  // Budgets (dedupe por id)
  {
    const existingIds = new Set(_db.budgets.map((b) => b.id));
    for (const b of incoming.budgets) {
      const id = String(b?.id ?? "");
      if (!id || existingIds.has(id)) {
        summary.budgets.skipped++;
        continue;
      }
      _db.budgets.push(b);
      existingIds.add(id);
      summary.budgets.created++;
    }
  }

  ensureBudgetCodes();
  persist();
  return clone(summary);
}

export function hardResetDb() {
  _db = emptyDb();
  persist();
  return getMeta();
}

import { addDaysISO, todayISO } from "./utils.js";

function randInt(min, max) {
  const a = Math.ceil(Number(min));
  const b = Math.floor(Number(max));
  return Math.floor(a + Math.random() * (b - a + 1));
}

function chance(p = 0.5) {
  return Math.random() < Number(p);
}

function pick(arr) {
  const a = Array.isArray(arr) ? arr : [];
  if (a.length === 0) return null;
  return a[Math.floor(Math.random() * a.length)];
}

function pickMany(arr, count) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  const out = [];
  const n = Math.max(0, Math.min(a.length, Number(count || 0)));
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * a.length);
    out.push(a[idx]);
    a.splice(idx, 1);
  }
  return out;
}

function digits(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += String(randInt(0, 9));
  return s;
}

function moneyBRLString(value) {
  const n = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
  // Mantém vírgula, aceito por toNumber()
  return n.toFixed(2).replace(".", ",");
}

const FIRST = ["Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Felipe", "Gabi", "Hugo", "Isabela", "João", "Karina", "Lucas", "Marina", "Nina", "Otávio", "Paula", "Rafa", "Sofia", "Thiago", "Vitor"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa", "Ferreira", "Rodrigues", "Almeida", "Gomes", "Martins"];
const CITIES = ["Centro", "Jardins", "Vila Nova", "Zona Sul", "Zona Norte", "Bairro Alto", "Cidade Nova", "Jd. Primavera"];
const STREETS = ["Rua das Flores", "Av. Brasil", "Rua São João", "Av. Paulista", "Rua do Comércio", "Rua 7 de Setembro"];

export function mockClientInitial() {
  const name = `${pick(FIRST) || "Cliente"} ${pick(LAST) || "Mock"}${chance(0.25) ? ` ${pick(LAST) || ""}` : ""}`.trim();
  const hasContact = chance(0.7);
  const hasEmail = chance(0.45);
  const hasLocation = chance(0.5);
  const hasPeriod = chance(0.35);

  const periodUnit = chance(0.2) ? "days" : "months";
  const periodValue = hasPeriod ? randInt(1, periodUnit === "days" ? 45 : 12) : 0;

  return {
    name,
    contact: hasContact ? `55${digits(2)}9${digits(8)}` : "",
    email: hasEmail ? `${normalizeSlug(name)}@exemplo.com` : "",
    location: hasLocation ? `${pick(STREETS) || "Rua Mock"}, ${randInt(10, 999)} - ${pick(CITIES) || "Centro"}` : "",
    periodValue,
    periodUnit
  };
}

export function mockServiceInitial() {
  const base = ["Higienização", "Lavagem", "Sanitização", "Detalhamento", "Polimento", "Limpeza Interna", "Limpeza Externa"];
  const extra = ["Premium", "Express", "Completa", "Simples", "Plus"];
  const name = `${pick(base) || "Serviço"}${chance(0.55) ? ` ${pick(extra) || ""}` : ""}`.trim();
  const hasDetail = chance(0.55);
  const hasCost = chance(0.85);
  const cost = hasCost ? randInt(80, 650) + (chance(0.25) ? 0.5 : 0) : 0;
  return {
    name,
    detail: hasDetail ? `Inclui ${chance(0.5) ? "aspiração" : "limpeza"} e finalização.` : "",
    totalCost: hasCost ? moneyBRLString(cost) : ""
  };
}

export function mockRecordInitial({ clients, services } = {}) {
  const c = pick(clients);
  const svcCount = Math.min(services?.length || 0, randInt(1, 3));
  const chosen = pickMany(services, svcCount);

  const daysBack = chance(0.65) ? 0 : randInt(1, 30);
  const dateISO = addDaysISO(todayISO(), -daysBack);
  const timeHM = `${String(randInt(8, 19)).padStart(2, "0")}:${String(pick([0, 15, 30, 45]) ?? 0).padStart(2, "0")}`;

  return {
    dateISO,
    timeHM,
    clientId: c?.id || "",
    status: chance(0.35) ? "FEITO" : "APROVADO",
    notes: chance(0.5) ? "" : "Mock gerado no Ambiente Dev.",
    items: chosen.map((s) => ({ serviceId: s?.id }))
  };
}

export function mockBudgetInitial({ clients, services } = {}) {
  const c = pick(clients);
  const svcCount = Math.min(services?.length || 0, randInt(1, 4));
  const chosen = pickMany(services, svcCount);

  const validityDays = randInt(3, 30);
  const hasDiscount = chance(0.35);
  const discount = hasDiscount ? moneyBRLString(randInt(5, 120)) : "";

  return {
    clientId: c?.id || "",
    validityDays,
    discount,
    notes: chance(0.45) ? "" : "Mock gerado no Ambiente Dev.",
    items: chosen.map((s) => ({ serviceId: s?.id }))
  };
}

function normalizeSlug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32) || "mock";
}


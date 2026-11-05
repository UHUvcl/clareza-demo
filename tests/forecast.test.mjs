import test from "node:test";
import assert from "node:assert/strict";
import { entitySchema, entrySchema } from "../lib/finance.ts";
import { monthlyForecast } from "../lib/forecast.ts";

const entity = (kind, id, name, extra = {}) =>
  entitySchema.parse({ kind, id, name, ...extra });
const entry = (id, description, amount, type, status = "confirmed") =>
  entrySchema.parse({
    id,
    description,
    amount,
    type,
    status,
    date: "2026-09-10",
    account: "account",
  });

test("previsão combina confirmados, pendentes e recorrências sem duplicar", () => {
  const data = {
    revision: 0,
    entities: [
      entity("account", "account", "Conta"),
      entity("recurring", "salary", "Salário", {
        amount: 500000,
        account: "account",
        date: "2026-01-05",
        type: "income",
      }),
      entity("recurring", "internet", "Internet", {
        amount: 12000,
        account: "account",
        date: "2026-01-20",
        type: "expense",
      }),
    ],
    entries: [
      entry("salary-manual", "Salário", 500000, "income"),
      entry("market", "Mercado", 80000, "expense"),
      entry("rent", "Aluguel", 150000, "expense", "pending"),
    ],
  };
  const forecast = monthlyForecast(data, "2026-09");
  assert.equal(forecast.income, 500000);
  assert.equal(forecast.expenses, 242000);
  assert.equal(forecast.result, 258000);
  assert.equal(forecast.toReceive, 0);
  assert.equal(forecast.toPay, 162000);
});

test("referências do perfil evitam mês vazio sem somar o mesmo salário duas vezes", () => {
  const data = {
    revision: 0,
    entities: [
      entity("account", "account", "Conta"),
      entity("profile", "profile", "Vitor", {
        amount: 600000,
        current: 350000,
      }),
    ],
    entries: [entry("freela", "Freela", 100000, "income")],
  };
  const forecast = monthlyForecast(data, "2026-09");
  assert.equal(forecast.income, 600000);
  assert.equal(forecast.expenses, 350000);
  assert.equal(forecast.result, 250000);
  assert.equal(forecast.usesIncomeReference, true);
  assert.equal(forecast.usesExpenseReference, true);
});

test("recorrência excluída depois de processada não volta para a previsão", () => {
  const data = {
    revision: 0,
    entities: [
      entity("account", "account", "Conta"),
      entity("recurring", "course", "Curso", {
        amount: 50000,
        account: "account",
        date: "2026-01-15",
        type: "expense",
        lastGeneratedMonth: "2026-09",
      }),
    ],
    entries: [],
  };
  assert.equal(monthlyForecast(data, "2026-09").expenses, 0);
});

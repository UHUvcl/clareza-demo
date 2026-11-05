import test from "node:test";
import assert from "node:assert/strict";
import { entitySchema, entrySchema } from "../lib/finance.ts";
import {
  recurringDateForMonth,
  recurringEntriesForMonth,
} from "../lib/recurring.ts";

const entity = (kind, id, name, extra = {}) =>
  entitySchema.parse({ kind, id, name, ...extra });
const account = entity("account", "a", "Conta principal", {
  type: "checking",
});

test("recorrência mensal vira pendência automática sem alterar o saldo", () => {
  const salary = entity("recurring", "salary", "Salário", {
    amount: 500000,
    account: "a",
    date: "2026-01-05",
    type: "income",
    period: "Mensal",
  });
  const result = recurringEntriesForMonth([account, salary], [], "2026-09");
  assert.equal(result.entries.length, 1);
  assert.deepEqual(
    {
      id: result.entries[0].id,
      date: result.entries[0].date,
      status: result.entries[0].status,
      type: result.entries[0].type,
      amount: result.entries[0].amount,
    },
    {
      id: "rec:salary:2026-09",
      date: "2026-09-05",
      status: "pending",
      type: "income",
      amount: 500000,
    },
  );
  assert.equal(result.templates[0].lastGeneratedMonth, "2026-09");
});

test("vencimentos nos dias 29 a 31 usam o último dia de meses curtos", () => {
  assert.equal(recurringDateForMonth("2026-01-31", "2026-02"), "2026-02-28");
  assert.equal(recurringDateForMonth("2024-01-31", "2024-02"), "2024-02-29");
  assert.equal(recurringDateForMonth("2026-01-31", "2026-04"), "2026-04-30");
  assert.equal(recurringDateForMonth("2026-01-31", "2026-03"), "2026-03-31");

  const therapy = entity("recurring", "therapy", "Terapia", {
    amount: 80000,
    account: "a",
    category: "Saúde",
    date: "2026-01-31",
    type: "expense",
    expenseClass: "fixed",
  });
  const result = recurringEntriesForMonth([account, therapy], [], "2026-02");
  assert.equal(result.entries[0].date, "2026-02-28");
  assert.equal(result.entries[0].amount, 80000);
  assert.equal(result.entries[0].category, "Saúde");
});

test("não duplica lançamento manual equivalente nem recria mês já processado", () => {
  const rent = entity("recurring", "rent", "Aluguel", {
    amount: 120000,
    account: "a",
    date: "2026-01-10",
    type: "expense",
  });
  const manual = entrySchema.parse({
    id: "manual-rent",
    description: "Aluguel",
    amount: 120000,
    account: "a",
    date: "2026-09-08",
    type: "expense",
  });
  const first = recurringEntriesForMonth(
    [account, rent],
    [manual],
    "2026-09",
  );
  assert.equal(first.entries.length, 0);
  assert.equal(first.templates[0].lastGeneratedMonth, "2026-09");
  const again = recurringEntriesForMonth(
    [account, first.templates[0]],
    [],
    "2026-09",
  );
  assert.equal(again.entries.length, 0);
  assert.equal(again.templates.length, 0);
});

test("ignora automações incompletas, pausadas e anuais fora do mês", () => {
  const incomplete = entity("recurring", "water", "Água", {
    amount: 0,
    type: "expense",
  });
  const paused = entity("recurring", "paused", "Curso", {
    amount: 5000,
    account: "a",
    date: "2026-01-12",
    type: "expense",
    status: "Inativo",
  });
  const annual = entity("recurring", "annual", "Seguro", {
    amount: 90000,
    account: "a",
    date: "2026-12-15",
    type: "expense",
    period: "Anual",
  });
  const result = recurringEntriesForMonth(
    [account, incomplete, paused, annual],
    [],
    "2026-09",
  );
  assert.equal(result.entries.length, 0);
  assert.equal(result.templates.length, 0);
});

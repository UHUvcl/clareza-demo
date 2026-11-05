import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyPlan } from "../lib/month-plan.ts";
import { entitySchema } from "../lib/finance.ts";

const entity = (kind, id, name, extra = {}) =>
  entitySchema.parse({ kind, id, name, ...extra });

test("plano mensal separa compromissos e sugere reserva sem contar valores desconhecidos", () => {
  const data = {
    revision: 0,
    entries: [],
    entities: [
      entity("profile", "p", "Pessoa", {
        amount: 500000,
        current: 200000,
        incomeMode: "variable",
      }),
      entity("recurring", "fixed", "Aluguel", {
        amount: 100000,
        type: "expense",
        expenseClass: "fixed",
      }),
      entity("recurring", "variable", "Energia", {
        amount: 50000,
        type: "expense",
        expenseClass: "variable",
      }),
      entity("recurring", "unknown", "Água", {
        amount: 0,
        type: "expense",
        expenseClass: "variable",
      }),
      entity("recurring", "installment", "Acordo", {
        amount: 20000,
        type: "expense",
        expenseClass: "debt",
      }),
      entity("budget", "b", "Alimentação", {
        amount: 80000,
        category: "Alimentação",
        date: "2026-09-01",
      }),
      entity("debt", "d", "Curso", {
        amount: 180000,
        current: 120000,
        count: 4,
      }),
    ],
  };
  const plan = buildMonthlyPlan(data, "2026-09");
  assert.equal(plan.fixedTotal, 100000);
  assert.equal(plan.variableBillsTotal, 50000);
  assert.equal(plan.budgetTotal, 80000);
  assert.equal(plan.debtBillsTotal, 20000);
  assert.equal(plan.debtMonthlyTotal, 30000);
  assert.equal(plan.unknownBills.length, 1);
  assert.equal(plan.committed, 280000);
  assert.equal(plan.remaining, 220000);
  assert.equal(plan.starterReserve, 25000);
  assert.equal(plan.reserveMonths, 12);
  assert.equal(plan.reserveTarget, 2400000);
});

test("conta recorrente pode ser mapeada antes de saber valor, conta ou vencimento", () => {
  const recurring = entitySchema.parse({
    id: "water",
    kind: "recurring",
    name: "Conta de água",
    amount: 0,
    type: "expense",
    expenseClass: "variable",
  });
  assert.equal(recurring.amount, 0);
  assert.equal(recurring.account, undefined);
  assert.equal(recurring.date, undefined);
});

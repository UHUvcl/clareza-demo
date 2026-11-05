import test from "node:test";
import assert from "node:assert/strict";
import { buildFinancialAlerts } from "../lib/alerts.ts";
import { entitySchema, entrySchema } from "../lib/finance.ts";

const account = entitySchema.parse({ id: "a", kind: "account", name: "Conta" });
const expense = (id, amount, date, extra = {}) =>
  entrySchema.parse({ id, description: id, amount, date, account: "a", type: "expense", ...extra });

test("alertas priorizam pendências vencidas e limites estourados", () => {
  const data = {
    revision: 0,
    entities: [
      account,
      entitySchema.parse({ id: "b", kind: "budget", name: "Comida", category: "Alimentação", amount: 10000, date: "2026-09-01" }),
    ],
    entries: [
      expense("conta vencida", 5000, "2026-09-10", { status: "pending" }),
      expense("mercado", 11000, "2026-09-12", { category: "Alimentação" }),
    ],
  };
  const alerts = buildFinancialAlerts(data, "2026-09-22");
  assert.equal(alerts[0].severity, "critical");
  assert.ok(alerts.some((item) => item.id.startsWith("budget:")));
});

test("recorrência já gerada não cria alerta duplicado", () => {
  const recurring = entitySchema.parse({ id: "r", kind: "recurring", name: "Internet", amount: 10000, account: "a", type: "expense", date: "2026-01-25" });
  const generated = expense("rec:r:2026-09", 10000, "2026-09-25", { status: "pending" });
  const alerts = buildFinancialAlerts({ revision: 0, entities: [account, recurring], entries: [generated] }, "2026-09-22");
  assert.equal(alerts.filter((item) => item.id.startsWith("recurring:")).length, 0);
  assert.equal(alerts.filter((item) => item.id.startsWith("pending-soon:")).length, 1);
});

test("lançamento equivalente também evita lembrete duplicado de recorrência", () => {
  const recurring = entitySchema.parse({ id: "r2", kind: "recurring", name: "Internet", amount: 11990, account: "a", type: "expense", date: "2026-01-25" });
  const manual = expense("internet-manual", 11990, "2026-09-20", { description: "Internet", status: "pending" });
  const alerts = buildFinancialAlerts({ revision: 0, entities: [account, recurring], entries: [manual] }, "2026-09-22");
  assert.equal(alerts.filter((item) => item.id.startsWith("recurring:")).length, 0);
});

test("mês processado não volta a cobrar recorrência excluída", () => {
  const recurring = entitySchema.parse({ id: "r3", kind: "recurring", name: "Curso", amount: 5000, account: "a", type: "expense", date: "2026-01-25", lastGeneratedMonth: "2026-09" });
  const alerts = buildFinancialAlerts({ revision: 0, entities: [account, recurring], entries: [] }, "2026-09-22");
  assert.equal(alerts.filter((item) => item.id.startsWith("recurring:")).length, 0);
});

test("conta recorrente ainda sem valor não cria alerta de cobrança", () => {
  const draft = entitySchema.parse({
    id: "draft",
    kind: "recurring",
    name: "Conta de água",
    amount: 0,
    type: "expense",
    date: "2026-01-25",
  });
  const alerts = buildFinancialAlerts(
    { revision: 0, entities: [account, draft], entries: [] },
    "2026-09-22",
  );
  assert.equal(alerts.filter((item) => item.id.startsWith("recurring:")).length, 0);
});

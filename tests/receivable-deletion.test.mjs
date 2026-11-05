import test from "node:test";
import assert from "node:assert/strict";
import * as finance from "../lib/finance.ts";
import {
  balance,
  entitySchema,
  entrySchema,
  receiveIncome,
  receivableProgress,
  restoreDeletedIncome,
} from "../lib/finance.ts";

const account = entitySchema.parse({
  id: "fictional-account",
  kind: "account",
  name: "Conta fictícia",
});
const original = () => entrySchema.parse({
  id: "fictional-job",
  account: account.id,
  description: "Serviço fictício",
  amount: 100000,
  expectedTotal: 100000,
  date: "2026-01-01",
  type: "income",
  status: "pending",
});

function removePayment(entries, paymentId) {
  const payment = entries.find((entry) => entry.id === paymentId);
  const parent = entries.find((entry) => entry.id === payment.receivable);
  const restored = restoreDeletedIncome(payment, parent);
  return [
    ...entries.filter((entry) => entry.id !== paymentId &&
      !restored.some((replacement) => replacement.id === entry.id)),
    ...restored,
  ];
}

test("excluir R$ 300 após quitar R$ 1.000 reabre só R$ 300 e preserva os R$ 700 recebidos", () => {
  const [remaining, first] = receiveIncome(original(), 30000, "2026-01-02", "fictional-first");
  const [settled] = receiveIncome(remaining, 70000, "2026-01-03");
  const before = [settled, first];
  const snapshot = structuredClone(before);
  const after = removePayment(before, first.id);
  const pending = after.find((entry) => entry.id === original().id);

  assert.equal(pending.status, "pending");
  assert.equal(pending.amount, 30000);
  assert.equal(balance({ entities: [account], entries: after, revision: 0 }, account.id), 70000);
  const progress = receivableProgress(after, pending);
  assert.equal(progress.total, 100000);
  assert.equal(progress.received, 70000);
  assert.equal(progress.remaining, 30000);
  assert.equal(progress.payments[0].date, "2026-01-03");
  assert.equal(progress.payments[0].account, account.id);
  assert.equal(after.some((entry) => entry.id === first.id), false);
  assert.equal(new Set(after.map((entry) => entry.id)).size, after.length);
  assert.deepEqual(before, snapshot);
});

test("exclusão antes da quitação recompõe a pendência sem criar receita", () => {
  const entries = receiveIncome(original(), 30000, "2026-01-02", "fictional-first");
  const after = removePayment(entries, "fictional-first");
  assert.equal(after.length, 1);
  assert.equal(after[0].status, "pending");
  assert.equal(after[0].amount, 100000);
  assert.equal(balance({ entities: [account], entries: after, revision: 0 }, account.id), 0);
});

test("reabertura conserva outras parcelas, centavos e permite receber e excluir novamente", () => {
  const job = { ...original(), amount: 100001, expectedTotal: 100001 };
  const [remaining, first] = receiveIncome(job, 30000, "2026-01-02", "fictional-first");
  const [lastRemaining, second] = receiveIncome(remaining, 20000, "2026-01-03", "fictional-second");
  const [settled] = receiveIncome(lastRemaining, 50001, "2026-01-04");
  let entries = removePayment([settled, first, second], first.id);
  let pending = entries.find((entry) => entry.id === job.id);
  assert.equal(receivableProgress(entries, pending).received, 70001);
  assert.equal(pending.amount, 30000);

  const [paidAgain] = receiveIncome(pending, 30000, "2026-01-05");
  entries = entries.map((entry) => entry.id === job.id ? paidAgain : entry);
  assert.equal(balance({ entities: [account], entries, revision: 0 }, account.id), 100001);
  entries = removePayment(entries, second.id);
  pending = entries.find((entry) => entry.id === job.id);
  assert.equal(pending.amount, 20000);
  assert.equal(receivableProgress(entries, pending).received, 80001);

  for (const payment of entries.filter((entry) => entry.status === "confirmed")) {
    entries = removePayment(entries, payment.id);
  }
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 100001);
  assert.equal(entries[0].status, "pending");
  assert.equal(balance({ entities: [account], entries, revision: 0 }, account.id), 0);
});

test("registro antigo sem total explícito, com data recuperada, conserva recebido e pendente", () => {
  const parent = { ...original(), status: "confirmed", amount: 70000, expectedTotal: 0, expectedDate: "2026-01-01" };
  const payment = { ...original(), id: "fictional-first", status: "confirmed",
    amount: 30000, expectedTotal: 0, receivable: parent.id };
  const entries = removePayment([parent, payment], payment.id);
  const progress = receivableProgress(entries, entries.find((entry) => entry.id === parent.id));
  assert.equal(progress.total, 100000);
  assert.equal(progress.received, 70000);
  assert.equal(progress.remaining, 30000);
});

test("data antiga perdida bloqueia a reversão sem inventar previsão ou alterar registros", () => {
  const parent = { ...original(), status: "confirmed", amount: 70000, date: "2026-02-10" };
  const payment = { ...original(), id: "first", status: "confirmed", amount: 30000, receivable: parent.id };
  const snapshot = structuredClone([parent, payment]);
  assert.throws(() => restoreDeletedIncome(payment, parent), /Data prevista original indisponível/);
  assert.throws(() => finance.planIncomeDeletion(parent, [parent, payment]), /Data prevista original indisponível/);
  assert.deepEqual([parent, payment], snapshot);
});

test("receita avulsa, despesa e transferência mantêm exclusão comum; pendência com parcelas não fica órfã", () => {
  for (const type of ["income", "expense", "transfer"]) {
    assert.deepEqual(finance.planIncomeDeletion({ ...original(), type, status: "confirmed", expectedTotal: 0 }, []), []);
  }
  const [parent, payment] = receiveIncome(original(), 30000, "2026-01-02", "first");
  assert.throws(() => finance.planIncomeDeletion(parent, [parent, payment]), /possui vínculos/);
  assert.throws(() => finance.planIncomeDeletion(payment, []), /principal ausente/);
});

test("data é preservada também no salvamento direto e não é apagada por cliente antigo", () => {
  const pending = { ...original(), date: "2026-03-10" };
  const saved = finance.preserveIncomeDate(pending);
  assert.equal(saved.expectedDate, pending.date);
  const confirmed = finance.preserveIncomeDate({ ...pending, status: "confirmed", date: "2026-02-10" }, saved);
  assert.equal(confirmed.expectedDate, "2026-03-10");
  assert.equal(confirmed.date, "2026-02-10");
  assert.equal(finance.preserveIncomeDate({ ...confirmed, expectedDate: "2026-02-10" }, confirmed).expectedDate, "2026-03-10");
  assert.equal(finance.preserveIncomeDate({ ...pending, status: "confirmed" }).expectedDate, undefined);
});

test("reversão rejeita vínculo incorreto, despesa ou pagamento não confirmado", () => {
  const [parent, payment] = receiveIncome(original(), 30000, "2026-01-02", "fictional-first");
  assert.throws(() => restoreDeletedIncome({ ...payment, receivable: "other" }, parent));
  assert.throws(() => restoreDeletedIncome({ ...payment, type: "expense" }, parent));
  assert.throws(() => restoreDeletedIncome({ ...payment, status: "pending" }, parent));
  assert.throws(() => restoreDeletedIncome(payment, { ...parent, type: "expense" }));
});

test("data prevista original sobrevive aos pagamentos e à reabertura em outro mês", () => {
  const job = { ...original(), date: "2026-03-10" };
  const [pending, first] = receiveIncome(job, 30000, "2026-01-02", "first");
  const [settled] = receiveIncome(pending, 70000, "2026-02-10");
  assert.equal(pending.expectedDate, "2026-03-10");
  assert.equal(first.expectedDate, "2026-03-10");
  assert.equal(settled.expectedDate, "2026-03-10");
  const [reopened, preserved] = restoreDeletedIncome(first, settled);
  assert.equal(reopened.date, "2026-03-10");
  assert.equal(preserved.date, "2026-02-10");
});

for (const finalFirst of [true, false]) {
  test(`exclusão em qualquer ordem mantém vínculos e total: última primeiro=${finalFirst}`, () => {
    const [pending, first] = receiveIncome(original(), 30000, "2026-01-02", "first");
    const [settled] = receiveIncome(pending, 70000, "2026-01-03");
    let entries = [settled, first];
    const remove = (payment) => {
      const replacements = finance.planIncomeDeletion(payment, entries);
      entries = [...entries.filter((entry) => entry.id !== payment.id &&
        !replacements.some((replacement) => replacement.id === entry.id)), ...replacements];
    };
    remove(finalFirst ? settled : first);
    const expectedPaid = finalFirst ? 30000 : 70000;
    assert.equal(balance({ entities: [account], entries, revision: 0 }, account.id), expectedPaid);
    const reopened = entries.find((entry) => entry.status === "pending");
    assert.equal(reopened.amount, 100000 - expectedPaid);
    assert.equal(reopened.date, original().date);
    for (const payment of entries.filter((entry) => entry.status === "confirmed")) {
      assert.equal(payment.receivable, reopened.id);
    }
    remove(entries.find((entry) => entry.status === "confirmed"));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].amount, 100000);
    assert.equal(entries[0].status, "pending");
  });
}

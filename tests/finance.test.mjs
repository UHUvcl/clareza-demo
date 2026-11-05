import test from "node:test";
import assert from "node:assert/strict";
import {
  split,
  toCents,
  addMonths,
  invoiceDate,
  entitySchema,
  entrySchema,
  balance,
  summary,
  monthlyNeed,
  validateLinks,
  fingerprint,
} from "../lib/finance.ts";
import { parseCsv, escapeCsv } from "../lib/csv.ts";
import { parseSmartEntry } from "../lib/smart-entry.ts";
const account = (id, type = "checking", current = 0) =>
  entitySchema.parse({
    id,
    kind: "account",
    name: id,
    type,
    current,
    closing: 5,
    due: 12,
  });
const entry = (id, type, amount, account, date = "2026-09-10", extra = {}) =>
  entrySchema.parse({
    id,
    type,
    amount,
    account,
    date,
    description: id,
    ...extra,
  });
test("centavos: reais brasileiros, zero, milhares e rejeição de texto", () => {
  assert.equal(toCents("1.234,56"), 123456);
  assert.equal(toCents("1.234"), 123400);
  assert.equal(toCents("18,00"), 1800);
  assert.equal(toCents("12.34"), 1234);
  assert.throws(() => toCents("abc"));
  assert.throws(() => toCents("-10"));
});
test("parcelas conservam o total em todos os casos", () => {
  for (let n = 1; n < 61; n++) {
    const parts = split(10001, n);
    assert.equal(
      parts.reduce((a, b) => a + b, 0),
      10001,
    );
    assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
  }
  assert.deepEqual(split(100, 3), [34, 33, 33]);
  assert.throws(() => split(2, 3));
});
test("datas não pulam fevereiro ou anos bissextos", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-12-31", 1), "2027-01-31");
});
test("fechamento e vencimento do cartão", () => {
  const a = account("card", "credit");
  assert.equal(invoiceDate("2026-09-04", a), "2026-09-12");
  assert.equal(invoiceDate("2026-09-05", a), "2026-10-12");
  assert.equal(
    invoiceDate("2026-09-20", { ...a, closing: 25, due: 5 }),
    "2026-10-05",
  );
});
test("transferência conserva patrimônio e não gera receita/despesa", () => {
  const d = {
    entities: [account("a", "checking", 100000), account("b")],
    entries: [
      entry("x", "transfer", 30000, "a", undefined, { destination: "b" }),
    ],
    revision: 0,
  };
  assert.equal(balance(d, "a", "2026-09-20"), 70000);
  assert.equal(balance(d, "b", "2026-09-20"), 30000);
  const s = summary(d, "2026-09");
  assert.equal(s.expense, 0);
  assert.equal(s.income, 0);
});
test("pagar cartão não duplica gasto e mantém patrimônio líquido", () => {
  const d = {
    entities: [account("a", "checking", 100000), account("c", "credit")],
    entries: [entry("buy", "expense", 20000, "c")],
    revision: 0,
  };
  assert.equal(summary(d, "2026-09").expense, 20000);
  d.entries.push(
    entry("pay", "transfer", 20000, "a", undefined, { destination: "c" }),
  );
  assert.equal(summary(d, "2026-09").expense, 20000);
  assert.equal(balance(d, "c"), 0);
  assert.equal(balance(d, "a", "2026-09-20"), 80000);
});
test("futuro ocupa cartão mas não saldo em conta; pendências não liquidam", () => {
  const d = {
    entities: [account("a", "checking", 100000), account("c", "credit")],
    entries: [
      entry("future", "expense", 10000, "a", "2099-01-01"),
      entry("card", "expense", 5000, "c", "2099-01-01"),
      entry("pending", "expense", 2000, "a", "2026-09-10", {
        status: "pending",
      }),
    ],
    revision: 0,
  };
  assert.equal(balance(d, "a"), 100000);
  assert.equal(balance(d, "c"), -5000);
  assert.equal(summary(d, "2026-09").expense, 0);
});
test("reservas reduzem livre e não criam despesa", () => {
  const d = {
    entities: [
      account("a", "checking", 100000),
      entitySchema.parse({
        id: "r",
        kind: "reserve",
        name: "Reserva",
        current: 30000,
      }),
    ],
    entries: [],
    revision: 0,
  };
  assert.equal(summary(d, "2026-09").free, 70000);
  assert.equal(summary(d, "2026-09").expense, 0);
  assert.equal(balance(d, "a"), 100000);
});
test("meta sem prazo ou prazo vencido não divide por zero", () => {
  const e = entitySchema.parse({
    id: "g",
    kind: "goal",
    name: "Meta",
    amount: 100000,
    current: 10000,
    date: "2026-12-01",
  });
  assert.equal(monthlyNeed(e, "2026-09-01"), 30000);
  assert.equal(monthlyNeed(e, "2027-01-01"), 90000);
});
test("links inválidos rejeitados e duplicatas normalizadas", () => {
  assert.throws(() =>
    validateLinks([entry("x", "expense", 1, "missing")], [account("a")]),
  );
  assert.throws(() =>
    validateLinks(
      [entry("x", "transfer", 1, "a", undefined, { destination: "a" })],
      [account("a")],
    ),
  );
  const t = entry("one", "expense", 123, "a");
  assert.equal(fingerprint(t), fingerprint({ ...t, id: "two" }));
});
test("CSV preserva delimitador, aspas, quebra e evita fórmulas na exportação", () => {
  assert.deepEqual(
    parseCsv('Data;Descrição;Valor\r\n2026-09-01;"Café; almoço";"12,50"'),
    [
      ["Data", "Descrição", "Valor"],
      ["2026-09-01", "Café; almoço", "12,50"],
    ],
  );
  assert.equal(escapeCsv("=SUM(A1)"), `"'=SUM(A1)"`);
  assert.throws(() => parseCsv('a,b\n"ab,c'));
});
const { receiveIncome, receivableProgress, simulatePurchase } = await import(
  "../lib/finance.ts"
);
test("freela previsto não altera saldo; pagamento parcial conserva total", () => {
  const pending = entry("freela", "income", 100000, "a", "2026-09-10", {
    status: "pending",
    incomeSource: "freelance",
    expectedTotal: 100000,
  });
  const d = { entities: [account("a")], entries: [pending], revision: 0 };
  assert.equal(summary(d, "2026-09").income, 0);
  assert.equal(balance(d, "a"), 0);
  const result = receiveIncome(pending, 30000, "2026-09-10", "receipt");
  assert.equal(
    result.reduce((s, t) => s + t.amount, 0),
    100000,
  );
  d.entries = result;
  assert.equal(summary(d, "2026-09").income, 30000);
  assert.equal(balance(d, "a"), 30000);
  assert.equal(result.find((t) => t.status === "pending").amount, 70000);
  assert.ok(result.every((t) => t.expectedTotal === 100000));
  assert.equal(result.find((t) => t.status === "confirmed").receivable, "freela");
  assert.throws(() => receiveIncome(pending, 100001));
  assert.throws(() => receiveIncome(pending, 0));
});
test("vários pagamentos mantêm total, histórico e saldo restante do trabalho", () => {
  const original = entry("job", "income", 100000, "a", "2026-09-10", {
    status: "pending",
    expectedTotal: 100000,
  });
  let entries = receiveIncome(original, 30000, "2026-09-10", "receipt-1");
  const firstRemaining = entries.find((t) => t.status === "pending");
  const second = receiveIncome(firstRemaining, 20000, "2026-09-11", "receipt-2");
  entries = [
    ...entries.filter((t) => t.id !== firstRemaining.id),
    ...second,
  ];
  const current = entries.find((t) => t.status === "pending");
  const progress = receivableProgress(entries, current);
  assert.equal(progress.total, 100000);
  assert.equal(progress.received, 50000);
  assert.equal(progress.remaining, 50000);
  assert.equal(progress.percent, 50);
  assert.deepEqual(
    progress.payments.map((t) => t.id).sort(),
    ["receipt-1", "receipt-2"],
  );
  const final = receiveIncome(current, 50000, "2026-09-12");
  entries = [...entries.filter((t) => t.id !== current.id), ...final];
  assert.equal(
    entries.filter((t) => t.status === "confirmed").reduce((s, t) => s + t.amount, 0),
    100000,
  );
  assert.ok(entries.every((t) => t.expectedTotal === 100000));
});
test("trabalho antigo infere o valor total pelos pagamentos já vinculados", () => {
  const pending = entry("legacy", "income", 70000, "a", "2026-09-10", {
    status: "pending",
  });
  const receipt = entry("legacy-receipt", "income", 30000, "a", "2026-09-09", {
    status: "confirmed",
    receivable: "legacy",
  });
  const progress = receivableProgress([pending, receipt], pending);
  assert.deepEqual(
    { total: progress.total, received: progress.received, remaining: progress.remaining },
    { total: 100000, received: 30000, remaining: 70000 },
  );
});
test("recebimento total atualiza o mesmo registro sem duplicar receita", () => {
  const pending = entry("p", "income", 12345, "a", "2026-09-10", {
    status: "pending",
  });
  const rows = receiveIncome(pending, 12345, "2026-09-11");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "p");
  assert.equal(rows[0].status, "confirmed");
  assert.equal(rows[0].amount, 12345);
});
test("cenário não altera dados e conserva centavos financiados", () => {
  const d = {
    entities: [account("a", "checking", 500000)],
    entries: [],
    revision: 0,
  };
  const before = JSON.stringify(d);
  const result = simulatePurchase(d, "2026-09", 100001, 20000, 3);
  assert.equal(
    result.installments.reduce((v, n) => v + n, 0),
    80001,
  );
  assert.equal(result.remainingCash, 480000);
  assert.equal(result.conservativeFree, 399999);
  assert.equal(JSON.stringify(d), before);
  assert.throws(() => simulatePurchase(d, "2026-09", 100, 101, 2));
});
test("registro assistido interpreta gasto falado e mantém confirmação manual", () => {
  const result = parseSmartEntry({
    text: "Gastei 48 reais no almoço ontem pela conta Principal",
    source: "voice",
    accounts: [{ ...account("a"), name: "Conta Principal" }],
    categories: ["Alimentação", "Outros"],
    now: "2026-09-21",
  });
  assert.equal(result.type, "expense");
  assert.equal(result.amount, 4800);
  assert.equal(result.date, "2026-09-20");
  assert.equal(result.category, "Alimentação");
  assert.equal(result.account, "a");
  assert.deepEqual(result.missing, []);
});
test("registro assistido lê total de comprovante e reconhece freela pendente", () => {
  const photo = parseSmartEntry({
    text: "MERCADO BOM PREÇO\nCNPJ 12.345.678/0001-99\nSUBTOTAL R$ 89,90\nTOTAL A PAGAR R$ 82,40",
    source: "image",
    now: "2026-09-21",
  });
  assert.equal(photo.amount, 8240);
  assert.equal(photo.category, "Alimentação");
  assert.match(photo.name, /MERCADO BOM PREÇO/i);
  const income = parseSmartEntry({
    text: "Vou receber R$ 850,00 do cliente Ana pelo freela em 25/09",
    source: "text",
    now: "2026-09-21",
  });
  assert.equal(income.type, "income");
  assert.equal(income.amount, 85000);
  assert.equal(income.status, "pending");
  assert.equal(income.date, "2026-09-25");
  assert.equal(income.incomeSource, "freelance");
});

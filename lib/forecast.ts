import type { Data, Entity, Entry } from "./finance.ts";

export type MonthlyForecast = {
  income: number;
  expenses: number;
  result: number;
  received: number;
  paid: number;
  toReceive: number;
  toPay: number;
  committedPercent: number;
  usesIncomeReference: boolean;
  usesExpenseReference: boolean;
};

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("pt-BR");

const recurringApplies = (item: Entity, month: string) => {
  if (
    item.kind !== "recurring" ||
    item.status === "Inativo" ||
    item.lastGeneratedMonth >= month ||
    !item.amount ||
    !item.account ||
    !item.date
  )
    return false;
  const expectedDate = `${month}-${item.date.slice(8, 10)}`;
  return (
    expectedDate >= item.date &&
    (item.period !== "Anual" || item.date.slice(5, 7) === month.slice(5, 7))
  );
};

const matchesRecurring = (entry: Entry, item: Entity, month: string) =>
  entry.id === `rec:${item.id}:${month}` ||
  (entry.date.startsWith(month) &&
    entry.amount === item.amount &&
    entry.account === item.account &&
    entry.type === (item.type === "income" ? "income" : "expense") &&
    normalize(entry.description) === normalize(item.name));

export function monthlyForecast(data: Data, month: string): MonthlyForecast {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Mês inválido");
  const rows = data.entries.filter((entry) => entry.date.startsWith(month));
  const received = rows
    .filter((entry) => entry.type === "income" && entry.status === "confirmed")
    .reduce((total, entry) => total + entry.amount, 0);
  const paid = rows
    .filter((entry) => entry.type === "expense" && entry.status === "confirmed")
    .reduce((total, entry) => total + entry.amount, 0);
  const registeredIncome = rows
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + entry.amount, 0);
  const registeredExpenses = rows
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + entry.amount, 0);

  const missingRecurring = data.entities
    .filter((item) => recurringApplies(item, month))
    .filter(
      (item) => !rows.some((entry) => matchesRecurring(entry, item, month)),
    );
  const recurringIncome = missingRecurring
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + item.amount, 0);
  const recurringExpenses = missingRecurring
    .filter((item) => item.type !== "income")
    .reduce((total, item) => total + item.amount, 0);

  const profile = data.entities.find((item) => item.kind === "profile");
  const registeredIncomeForecast = registeredIncome + recurringIncome;
  const registeredExpenseForecast = registeredExpenses + recurringExpenses;
  const income = Math.max(profile?.amount || 0, registeredIncomeForecast);
  const expenses = Math.max(profile?.current || 0, registeredExpenseForecast);

  return {
    income,
    expenses,
    result: income - expenses,
    received,
    paid,
    toReceive: Math.max(0, income - received),
    toPay: Math.max(0, expenses - paid),
    committedPercent: income ? Math.round((expenses / income) * 100) : 0,
    usesIncomeReference: (profile?.amount || 0) > registeredIncomeForecast,
    usesExpenseReference: (profile?.current || 0) > registeredExpenseForecast,
  };
}

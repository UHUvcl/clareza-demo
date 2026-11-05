import { summary, type Data, type Entity } from "./finance.ts";

export type MonthlyPlan = {
  profile?: Entity;
  fixed: Entity[];
  variableBills: Entity[];
  debtBills: Entity[];
  unknownBills: Entity[];
  budgets: Entity[];
  debts: Entity[];
  reserves: Entity[];
  confirmedIncome: number;
  pendingIncome: number;
  incomeReference: number;
  fixedTotal: number;
  variableBillsTotal: number;
  budgetTotal: number;
  debtBillsTotal: number;
  debtMonthlyTotal: number;
  committed: number;
  remaining: number;
  reserveCurrent: number;
  reserveTarget: number;
  reserveMonths: number;
  starterReserve: number;
};

function appliesToMonth(item: Entity, month: string) {
  if (item.status === "Inativo") return false;
  if (item.date && item.date.slice(0, 7) > month) return false;
  return (
    item.period !== "Anual" ||
    !item.date ||
    item.date.slice(5, 7) === month.slice(5, 7)
  );
}

export function buildMonthlyPlan(data: Data, month: string): MonthlyPlan {
  const monthSummary = summary(data, month);
  const profile = data.entities.find((item) => item.kind === "profile");
  const recurring = data.entities.filter(
    (item) =>
      item.kind === "recurring" &&
      item.type !== "income" &&
      appliesToMonth(item, month),
  );
  const fixed = recurring.filter(
    (item) => item.expenseClass === "fixed" && item.amount > 0,
  );
  const variableBills = recurring.filter(
    (item) => item.expenseClass === "variable" && item.amount > 0,
  );
  const debtBills = recurring.filter(
    (item) => item.expenseClass === "debt" && item.amount > 0,
  );
  const unknownBills = recurring.filter((item) => item.amount === 0);
  const budgets = data.entities.filter(
    (item) => item.kind === "budget" && item.date?.startsWith(month),
  );
  const debts = data.entities.filter(
    (item) =>
      item.kind === "debt" &&
      item.current > 0 &&
      !["Quitada", "Cancelada", "Inativo"].includes(item.status),
  );
  const reserves = data.entities.filter(
    (item) => item.kind === "reserve" && item.status !== "Cancelado",
  );
  const pendingIncome = monthSummary.rows
    .filter((item) => item.type === "income" && item.status === "pending")
    .reduce((total, item) => total + item.amount, 0);
  const confirmedIncome = monthSummary.income;
  const incomeReference = profile?.amount || confirmedIncome;
  const fixedTotal = fixed.reduce((total, item) => total + item.amount, 0);
  const variableBillsTotal = variableBills.reduce(
    (total, item) => total + item.amount,
    0,
  );
  const budgetTotal = budgets.reduce((total, item) => total + item.amount, 0);
  const debtBillsTotal = debtBills.reduce(
    (total, item) => total + item.amount,
    0,
  );
  const debtMonthlyTotal = debts.reduce(
    (total, item) => total + Math.ceil(item.current / Math.max(1, item.count)),
    0,
  );
  const committed =
    fixedTotal +
    variableBillsTotal +
    budgetTotal +
    debtBillsTotal +
    debtMonthlyTotal;
  const remaining = incomeReference - committed;
  const reserveCurrent = reserves.reduce(
    (total, item) => total + item.current,
    0,
  );
  const reserveMonths =
    profile?.incomeMode === "variable"
      ? 12
      : profile?.incomeMode === "mixed"
        ? 9
        : 6;
  const essentialBase = Math.max(
    profile?.current || 0,
    fixedTotal + variableBillsTotal + debtBillsTotal + debtMonthlyTotal,
  );
  const reserveTarget = essentialBase * reserveMonths;
  const starterReserve = Math.min(
    Math.max(0, remaining),
    Math.ceil(incomeReference * 0.05),
  );
  return {
    profile,
    fixed,
    variableBills,
    debtBills,
    unknownBills,
    budgets,
    debts,
    reserves,
    confirmedIncome,
    pendingIncome,
    incomeReference,
    fixedTotal,
    variableBillsTotal,
    budgetTotal,
    debtBillsTotal,
    debtMonthlyTotal,
    committed,
    remaining,
    reserveCurrent,
    reserveTarget,
    reserveMonths,
    starterReserve,
  };
}

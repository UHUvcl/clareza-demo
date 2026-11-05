import { balance, money, today, type Data } from "./finance.ts";
import { recurringDateForMonth } from "./recurring.ts";

export type FinancialAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  target: string;
  date?: string;
};

const DAY = 86_400_000;
const atNoon = (value: string) => new Date(`${value}T12:00:00`).getTime();
const daysFrom = (date: string, now: string) =>
  Math.round((atNoon(date) - atNoon(now)) / DAY);
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

export function buildFinancialAlerts(
  data: Data,
  now = today(),
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const month = now.slice(0, 7);

  for (const entry of data.entries.filter((item) => item.status === "pending")) {
    const distance = daysFrom(entry.date, now);
    if (distance < 0) {
      alerts.push({
        id: `pending-overdue:${entry.id}`,
        severity: entry.type === "expense" ? "critical" : "warning",
        title:
          entry.type === "income"
            ? `${entry.description} ainda não foi recebido`
            : `${entry.description} está pendente`,
        detail: `${money(entry.amount)} · previsto para ${dateLabel(entry.date)}`,
        target: entry.type === "income" ? "Entradas e freelas" : "Movimentações",
        date: entry.date,
      });
    } else if (distance <= 7) {
      alerts.push({
        id: `pending-soon:${entry.id}`,
        severity: entry.type === "expense" ? "warning" : "info",
        title:
          distance === 0
            ? `${entry.description} vence hoje`
            : `${entry.description} vence em ${distance} dia${distance === 1 ? "" : "s"}`,
        detail: `${money(entry.amount)} · ${entry.type === "income" ? "entrada prevista" : "pagamento previsto"}`,
        target: entry.type === "income" ? "Entradas e freelas" : "Calendário",
        date: entry.date,
      });
    }
  }

  for (const budget of data.entities.filter(
    (item) => item.kind === "budget" && item.date?.startsWith(month),
  )) {
    const spent = data.entries
      .filter(
        (entry) =>
          entry.type === "expense" &&
          entry.status === "confirmed" &&
          entry.date.startsWith(month) &&
          entry.category === budget.category,
      )
      .reduce((sum, entry) => sum + entry.amount, 0);
    const percent = budget.amount ? Math.round((spent / budget.amount) * 100) : 0;
    if (percent >= 80) {
      alerts.push({
        id: `budget:${budget.id}:${month}`,
        severity: percent >= 100 ? "critical" : "warning",
        title:
          percent >= 100
            ? `Limite de ${budget.category} foi ultrapassado`
            : `${budget.category} chegou a ${percent}% do limite`,
        detail: `${money(spent)} de ${money(budget.amount)} neste mês`,
        target: "Planejar",
      });
    }
  }

  for (const recurring of data.entities.filter(
    (item) => item.kind === "recurring" && item.status !== "Inativo",
  )) {
    if (
      !recurring.amount ||
      !recurring.account ||
      !recurring.date ||
      recurring.date.slice(0, 7) > month
    )
      continue;
    if (recurring.period === "Anual" && recurring.date.slice(5, 7) !== month.slice(5, 7))
      continue;
    const dueDate = recurringDateForMonth(recurring.date, month);
    const distance = daysFrom(dueDate, now);
    const generated = data.entries.some(
      (entry) =>
        entry.id === `rec:${recurring.id}:${month}` ||
        (entry.date.startsWith(month) &&
          entry.amount === recurring.amount &&
          entry.account === recurring.account &&
          entry.type ===
            (recurring.type === "income" ? "income" : "expense") &&
          entry.description.trim().toLocaleLowerCase("pt-BR") ===
            recurring.name.trim().toLocaleLowerCase("pt-BR")),
    );
    if (
      recurring.lastGeneratedMonth < month &&
      !generated &&
      distance >= 0 &&
      distance <= 7
    ) {
      alerts.push({
        id: `recurring:${recurring.id}:${month}`,
        severity: distance === 0 ? "warning" : "info",
        title:
          distance === 0
            ? `${recurring.name} vence hoje`
            : `${recurring.name} vence em ${distance} dia${distance === 1 ? "" : "s"}`,
        detail: `${money(recurring.amount)} · automação ainda não preparada`,
        target: "Recorrências",
        date: dueDate,
      });
    }
  }

  for (const card of data.entities.filter(
    (item) => item.kind === "account" && item.type === "credit",
  )) {
    const amount = Math.max(0, -balance(data, card.id, now));
    const dueDate = `${month}-${String(card.due).padStart(2, "0")}`;
    const distance = daysFrom(dueDate, now);
    if (amount > 0 && distance >= 0 && distance <= 7) {
      alerts.push({
        id: `card:${card.id}:${month}`,
        severity: distance <= 2 ? "warning" : "info",
        title:
          distance === 0
            ? `A fatura de ${card.name} vence hoje`
            : `A fatura de ${card.name} vence em ${distance} dia${distance === 1 ? "" : "s"}`,
        detail: `${money(amount)} registrado no cartão`,
        target: "Contas e cartões",
        date: dueDate,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      (a.date || "9999").localeCompare(b.date || "9999") ||
      a.title.localeCompare(b.title),
  );
}

import {
  dateSchema,
  entitySchema,
  entrySchema,
  type Entity,
  type Entry,
} from "./finance.ts";

export type RecurringMaterialization = {
  entries: Entry[];
  templates: Entity[];
};

const normalized = (value: string) =>
  value.trim().toLocaleLowerCase("pt-BR");

export function recurringDateForMonth(startDate: string, month: string) {
  const parsedStart = dateSchema.parse(startDate);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Mês inválido");
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const preferredDay = Number(parsedStart.slice(8, 10));
  return `${month}-${String(Math.min(preferredDay, lastDay)).padStart(2, "0")}`;
}

export function recurringEntriesForMonth(
  rawEntities: Entity[],
  existing: Entry[],
  month: string,
): RecurringMaterialization {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Mês inválido");
  const entities = rawEntities.map((item) => entitySchema.parse(item));
  const accounts = new Set(
    entities
      .filter((item) => item.kind === "account" && item.type !== "credit")
      .map((item) => item.id),
  );
  const entries: Entry[] = [];
  const templates: Entity[] = [];

  for (const item of entities.filter(
    (entity) => entity.kind === "recurring" && entity.status !== "Inativo",
  )) {
    if (item.lastGeneratedMonth >= month) continue;
    if (!item.amount || !item.date || !item.account || !accounts.has(item.account))
      continue;
    const date = recurringDateForMonth(item.date, month);
    if (date < item.date) continue;
    if (
      item.period === "Anual" &&
      item.date.slice(5, 7) !== month.slice(5, 7)
    )
      continue;

    const automaticId = `rec:${item.id}:${month}`;
    const equivalent = [...existing, ...entries].some(
      (entry) =>
        entry.id === automaticId ||
        (entry.date.startsWith(month) &&
          entry.amount === item.amount &&
          entry.account === item.account &&
          entry.type === (item.type === "income" ? "income" : "expense") &&
          normalized(entry.description) === normalized(item.name)),
    );
    if (!equivalent)
      entries.push(
        entrySchema.parse({
          id: automaticId,
          description: item.name,
          amount: item.amount,
          date,
          account: item.account,
          type: item.type === "income" ? "income" : "expense",
          incomeSource: item.type === "income" ? "salary" : "other",
          category: item.category,
          status: "pending",
          origin: "recorrência automática",
        }),
      );
    templates.push({ ...item, lastGeneratedMonth: month });
  }

  return { entries, templates };
}

import { blank, demoData, entitySchema, entrySchema, planIncomeDeletion, preserveIncomeDate, validateLinks, today, addMonths, type Data, type Entity, type Entry } from './finance.ts';
import { recurringEntriesForMonth } from './recurring.ts';

export type DemoChange = {
  action?: 'save' | 'delete' | 'erase';
  entities?: Entity[];
  entries?: Entry[];
  id?: string;
  target?: 'entity' | 'entry';
};

function prepareRecurring(data: Data): Data {
  const generated = recurringEntriesForMonth(data.entities, data.entries, today().slice(0, 7));
  return {
    ...data,
    entities: data.entities.map(item => generated.templates.find(next => next.id === item.id) || item),
    entries: [...data.entries, ...generated.entries],
  };
}

/** Examples are invented in source; no disk, storage or network reads. */
export function createDemoData(): Data {
  const data = demoData();
  const month = today().slice(0, 7);
  for (let i = 1; i <= 3; i++) {
    const date = addMonths(`${month}-05`, -i);
    data.entries.push(
      entrySchema.parse({ id: `sample-income-${i}`, type: 'income', account: 'a1', amount: 520000 + i * 10000, date, description: 'Renda fictícia mensal', category: 'Trabalho' }),
      entrySchema.parse({ id: `sample-expense-${i}`, type: 'expense', account: 'a1', amount: 430000 + i * 8000, date, description: 'Despesas fictícias mensais', category: 'Moradia' }),
    );
  }
  // A settled job makes both deletion orders immediately demonstrable.
  const expectedDate = `${month}-28`;
  const paymentDate = today();
  data.entries.push(
    entrySchema.parse({ id: 'sample-job', type: 'income', account: 'a1', description: 'Projeto fictício · parcela final', amount: 70000, expectedTotal: 100000, expectedDate, date: paymentDate, incomeSource: 'freelance', payer: 'Cliente Exemplo' }),
    entrySchema.parse({ id: 'sample-partial', type: 'income', account: 'a1', description: 'Projeto fictício · primeira parcela', amount: 30000, expectedTotal: 100000, expectedDate, date: paymentDate, receivable: 'sample-job', group: 'sample-job', incomeSource: 'freelance', payer: 'Cliente Exemplo' }),
  );
  return prepareRecurring({ ...data, entries: data.entries.map(entry => preserveIncomeDate(entry)) });
}

/** All-or-nothing local transition. React receives a new state only after validation. */
export function applyDemoChange(data: Data, change: DemoChange): Data {
  if (change.action === 'erase') return structuredClone(blank);
  let entities = data.entities;
  let entries = data.entries;
  if (change.action === 'delete') {
    if (change.target === 'entry') {
      const old = entries.find(entry => entry.id === change.id);
      if (!old) return data;
      const restored = planIncomeDeletion(old, entries);
      entries = [...entries.filter(entry => entry.id !== old.id && !restored.some(next => next.id === entry.id)), ...restored];
      if (old.debt) entities = entities.map(entity => entity.id === old.debt ? { ...entity, current: entity.current + old.amount } : entity);
    } else if (change.target === 'entity') {
      if (entries.some(entry => [entry.account, entry.destination, entry.debt, entry.project].includes(change.id || 'missing')) ||
          entities.some(entity => entity.id !== change.id && [entity.account, entity.project, entity.defaultAccount].includes(change.id)))
        throw Error('Este registro possui vínculos. Remova os vínculos antes de excluir.');
      entities = entities.filter(entity => entity.id !== change.id);
    } else throw Error('Registro inválido');
  } else {
    const updates = (change.entities || []).map(entity => entitySchema.parse(entity));
    const transactions = (change.entries || []).map(entry => entrySchema.parse(preserveIncomeDate(entry, entries.find(old => old.id === entry.id))));
    entities = [...entities.filter(entity => !updates.some(next => next.id === entity.id)), ...updates];
    validateLinks(transactions, entities);
    for (const entry of transactions) {
      if (entry.type === 'income' && entry.status === 'confirmed' && entry.date > today()) throw Error('Uma entrada futura deve ficar pendente.');
      const old = entries.find(previous => previous.id === entry.id);
      if (old && (old.receivable || old.debt) && JSON.stringify(entrySchema.parse(preserveIncomeDate(old))) !== JSON.stringify(entry))
        throw Error('Pagamento vinculado: exclua e registre novamente.');
    }
    entries = [...entries.filter(entry => !transactions.some(next => next.id === entry.id)), ...transactions];
  }
  validateLinks(entries, entities);
  return prepareRecurring({ entities, entries, revision: data.revision + 1 });
}

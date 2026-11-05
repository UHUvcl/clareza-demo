import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, applyDemoChange } from '../lib/demo-store.ts';
import { balance, summary, entrySchema, entitySchema, receiveIncome, today } from '../lib/finance.ts';

test('cenário inicial é independente, preenchido, válido e inclui quatro meses', () => {
  const first = createDemoData(); const second = createDemoData();
  assert.ok(first.entries.length >= 20);
  assert.ok(new Set(first.entries.map(entry => entry.date.slice(0, 7))).size >= 4);
  first.entries.forEach(entry => entrySchema.parse(entry));
  first.entities.forEach(entity => entitySchema.parse(entity));
  first.entities[0].name = 'Alteração fictícia';
  assert.notEqual(first.entities[0].name, second.entities[0].name);
});

for (const paymentId of ['sample-job', 'sample-partial']) {
  test(`estado usado pela interface reverte ${paymentId} sem perder vínculos`, () => {
    const initial = createDemoData(); const before = structuredClone(initial);
    const paidBefore = balance(initial, 'a1');
    const amount = initial.entries.find(entry => entry.id === paymentId).amount;
    const next = applyDemoChange(initial, { action: 'delete', target: 'entry', id: paymentId });
    assert.deepEqual(initial, before);
    assert.equal(balance(next, 'a1'), paidBefore - amount);
    const pending = next.entries.find(entry => entry.payer === 'Cliente Exemplo' && entry.status === 'pending');
    assert.equal(pending.amount, amount);
    assert.equal(pending.date, pending.expectedDate);
    const surviving = next.entries.find(entry => entry.payer === 'Cliente Exemplo' && entry.status === 'confirmed');
    assert.equal(surviving.receivable, pending.id);
    assert.deepEqual(applyDemoChange(next, { action: 'delete', target: 'entry', id: paymentId }), next);
  });
}

test('transferência não gera renda ou despesa; pagamento do cartão não duplica gasto', () => {
  const initial = createDemoData(); const month = today().slice(0,7);
  const before = summary(initial, month);
  const transfer = entrySchema.parse({id:'fiction-transfer', type:'transfer', amount:10000, date:today(), account:'a1', destination:'c1', description:'Pagamento fictício'});
  const after = applyDemoChange(initial, {entries:[transfer]});
  assert.equal(summary(after,month).income,before.income);
  assert.equal(summary(after,month).expense,before.expense);
  assert.equal(balance(after,'a1'),balance(initial,'a1')-10000);
  assert.equal(balance(after,'c1'),balance(initial,'c1')+10000);
});

test('falha não altera estado, impede contas inexistentes e pendência com pagamentos', () => {
  const initial=createDemoData(); const snapshot=structuredClone(initial);
  assert.throws(()=>applyDemoChange(initial,{entries:[entrySchema.parse({id:'invalid',type:'expense',amount:100,date:today(),account:'missing',description:'Fictício'})]}));
  assert.throws(()=>applyDemoChange(initial,{action:'delete',target:'entity',id:'a1'}));
  assert.throws(()=>applyDemoChange(initial,{action:'delete',target:'entry',id:'t11'}));
  assert.deepEqual(initial,snapshot);
});

test('recebimento parcial e total mantém previsão e não conta renda pendente no saldo', () => {
  let data=createDemoData(); const original=data.entries.find(entry=>entry.id==='t11');
  const before=balance(data,'a1');
  data=applyDemoChange(data,{entries:receiveIncome(original,30000,today(),'new-partial')});
  assert.equal(balance(data,'a1'),before+30000);
  const pending=data.entries.find(entry=>entry.id===original.id);
  data=applyDemoChange(data,{entries:receiveIncome(pending,pending.amount,today())});
  assert.equal(balance(data,'a1'),before+original.amount);
  assert.equal(data.entries.find(entry=>entry.id===original.id).expectedDate,original.date);
});

test('recorrências locais não duplicam e limpar não altera cenário de outras sessões', () => {
  let data=createDemoData(); const other=createDemoData();
  const count=data.entries.length;
  data=applyDemoChange(data,{entities:[]});
  data=applyDemoChange(data,{entities:[]});
  assert.equal(data.entries.length,count);
  const cleared=applyDemoChange(data,{action:'erase'});
  assert.equal(cleared.entries.length,0);
  assert.equal(other.entries.length,count);
});

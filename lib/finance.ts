import {z} from 'zod';
export const categories=['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Compras','Assinaturas','Pets','Viagens','Trabalho','Investimentos','Dívidas','Outros'];
export const kinds=['account','budget','reserve','purchase','goal','debt','recurring','project','category','profile','scenario'] as const;
const cents=z.number().int().min(0).max(100_000_000_000);
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Data inválida');
export const entitySchema=z.object({id:z.string().min(1).max(100),kind:z.enum(kinds),name:z.string().trim().min(1).max(120),amount:cents.default(0),current:cents.default(0),date:dateSchema.optional(),account:z.string().max(100).optional(),category:z.string().max(80).default('Outros'),notes:z.string().max(3000).default(''),type:z.string().max(50).default(''),closing:z.number().int().min(1).max(28).default(5),due:z.number().int().min(1).max(28).default(12),rate:z.number().min(0).max(100).default(0),count:z.number().int().min(1).max(600).default(1),priority:z.enum(['Baixa','Média','Alta']).default('Média'),status:z.string().max(30).default('Ativo'),url:z.string().max(1000).default(''),project:z.string().max(100).default(''),period:z.string().max(20).default('Mensal'),expenseClass:z.enum(['fixed','variable','debt']).default('fixed'),lastGeneratedMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).or(z.literal('')).default(''),incomeMode:z.enum(['fixed','variable','mixed']).default('mixed'),defaultAccount:z.string().max(100).default(''),focus:z.string().max(100).default('Organizar meu dinheiro')});
export type Entity=z.infer<typeof entitySchema>;
export const entrySchema=z.object({id:z.string().min(1).max(120),type:z.enum(['expense','income','transfer']),amount:cents.refine(v=>v>0,'Informe um valor maior que zero'),expectedTotal:cents.default(0),expectedDate:dateSchema.optional(),date:dateSchema,description:z.string().trim().min(1).max(200),account:z.string().min(1).max(100),destination:z.string().max(100).default(''),category:z.string().max(80).default('Outros'),status:z.enum(['confirmed','pending']).default('confirmed'),notes:z.string().max(3000).default(''),tags:z.string().max(300).default(''),project:z.string().max(100).default(''),group:z.string().max(100).default(''),part:z.number().int().min(1).max(600).default(1),totalParts:z.number().int().min(1).max(600).default(1),origin:z.string().max(30).default('manual'),debt:z.string().max(100).default(''),incomeSource:z.enum(['salary','freelance','sales','other']).default('other'),payer:z.string().max(150).default(''),receivable:z.string().max(120).default('')});
export type Entry=z.infer<typeof entrySchema>;
export type Data={entities:Entity[],entries:Entry[],revision:number,balances?:Record<string,number>};
export const blank:Data={entities:[],entries:[],revision:0};
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function money(v:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)}
export function toCents(s:string){const n=s.trim().replace(/R\$/g,'').replace(/\s/g,'');if(!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(n)&&!/^\d+(?:\.\d{1,2})?$/.test(n))throw Error('Valor inválido. Use 1.234,56.');const v=Number(n.includes(',')?n.replace(/\./g,'').replace(',','.'):/^\d{1,3}(?:\.\d{3})+$/.test(n)?n.replace(/\./g,''):n);if(!Number.isFinite(v))throw Error('Valor inválido');return Math.round(v*100)}
export function addMonths(date:string,n:number){const [y,m,d]=date.split('-').map(Number);const end=new Date(y,m+n,0).getDate();return `${new Date(y,m-1+n,1).getFullYear()}-${String(new Date(y,m-1+n,1).getMonth()+1).padStart(2,'0')}-${String(Math.min(d,end)).padStart(2,'0')}`}
export function split(total:number,n:number){if(!Number.isSafeInteger(total)||!Number.isInteger(n)||n<1||n>600||total<n)throw Error('Parcelas inválidas');return Array.from({length:n},(_,i)=>Math.floor(total/n)+(i<total%n?1:0))}
export function invoiceDate(date:string,account:Entity){const day=Number(date.slice(8));let m=day>=account.closing?1:0;if(account.due<=account.closing)m++;return addMonths(date.slice(0,8)+String(account.due).padStart(2,'0'),m)}
export function balance(data:Data,id:string,asOf=today()){if(data.balances&&id in data.balances)return data.balances[id];const a=data.entities.find(x=>x.id===id);let v=a?(a.type==='credit'?-a.current:a.current):0;for(const t of data.entries){if(t.status!=='confirmed'||(a?.type!=='credit'&&t.date>asOf))continue;if(t.account===id)v+=t.type==='income'?t.amount:-t.amount;if(t.type==='transfer'&&t.destination===id)v+=t.amount;}return v}
export function summary(data:Data,month:string){const rows=data.entries.filter(t=>t.date.startsWith(month));const income=rows.filter(t=>t.type==='income'&&t.status==='confirmed').reduce((s,t)=>s+t.amount,0);const expense=rows.filter(t=>t.type==='expense'&&t.status==='confirmed').reduce((s,t)=>s+t.amount,0);const cash=data.entities.filter(e=>e.kind==='account'&&e.type!=='credit').reduce((s,a)=>s+balance(data,a.id),0);const cards=data.entities.filter(e=>e.kind==='account'&&e.type==='credit').reduce((s,a)=>s+Math.max(0,-balance(data,a.id)),0);const reserved=data.entities.filter(e=>['reserve','goal','purchase'].includes(e.kind)&&e.status!=='Cancelado'&&e.status!=='Comprado').reduce((s,e)=>s+e.current,0);const pending=rows.filter(t=>t.type==='expense'&&t.status==='pending').reduce((s,t)=>s+t.amount,0);const debts=data.entities.filter(e=>e.kind==='debt').reduce((s,e)=>s+e.current,0);return {income,expense,cash,cards,reserved,pending,debts,free:cash-reserved-cards,rows};}
export function monthlyNeed(e:Entity,now=today()){const months=e.date?Math.max(1,(Number(e.date.slice(0,4))-Number(now.slice(0,4)))*12+Number(e.date.slice(5,7))-Number(now.slice(5,7))):1;return Math.ceil(Math.max(0,e.amount-e.current)/months)}
export function validateLinks(entries:Entry[],entities:Entity[]){for(const t of entries){if(t.project&&!entities.some(e=>e.id===t.project&&e.kind==='project'))throw Error('Projeto inválido');if(t.debt&&!entities.some(e=>e.id===t.debt&&e.kind==='debt'))throw Error('Dívida inválida');const a=entities.find(x=>x.id===t.account&&x.kind==='account');if(!a)throw Error('Selecione uma conta existente');if(t.type==='transfer'){if(t.account===t.destination)throw Error('Origem e destino devem ser diferentes');if(!entities.some(x=>x.id===t.destination&&x.kind==='account'))throw Error('Conta de destino inválida');if(a.type==='credit')throw Error('Transferência deve sair de uma conta com dinheiro');}if(a.type==='credit'&&t.type==='income')throw Error('Para pagar cartão, use transferência');}}
export function fingerprint(t:Entry){return [t.date,t.amount,t.description.trim().toLowerCase(),t.account,t.type].join('|')}
export function demoData():Data{const month=today().slice(0,7);const e=(kind:Entity['kind'],id:string,name:string,extra:Partial<Entity>)=>entitySchema.parse({kind,id,name,...extra});const entities=[e('profile','profile1','Marina',{amount:580000,current:320000,incomeMode:'mixed',focus:'Organizar meu dinheiro'}),e('account','a1','Conta principal',{current:245000,type:'checking'}),e('account','a2','Dinheiro',{current:18000,type:'cash'}),e('account','c1','Cartão do dia a dia',{type:'credit',amount:800000,closing:5,due:12}),e('account','c2','Cartão de compras',{type:'credit',amount:500000,closing:10,due:18}),e('reserve','r1','Reserva de emergência',{amount:1500000,current:200000}),e('goal','g1','Viagem de férias',{amount:600000,current:145000,date:addMonths(today(),8)}),e('purchase','p1','Notebook novo',{amount:650000,current:80000,date:addMonths(today(),5),status:'Planejando',priority:'Alta'}),e('budget','b1','Alimentação',{category:'Alimentação',amount:90000,date:month+'-01'}),e('budget','b2','Transporte',{category:'Transporte',amount:40000,date:month+'-01'}),e('budget','b3','Lazer',{category:'Lazer',amount:35000,date:month+'-01'}),e('debt','d1','Curso de especialização',{amount:240000,current:180000,count:6,date:month+'-28'}),e('recurring','rec1','Internet',{amount:11990,account:'a1',category:'Moradia',date:month+'-25',type:'expense',period:'Mensal',expenseClass:'fixed'}),e('recurring','rec2','Música',{amount:2190,account:'a1',category:'Assinaturas',date:month+'-24',type:'expense',period:'Mensal',expenseClass:'fixed'}),e('recurring','rec3','Energia',{amount:18790,account:'a1',category:'Moradia',date:month+'-27',type:'expense',period:'Mensal',expenseClass:'variable'}),e('project','pr1','Férias no litoral',{amount:600000,date:addMonths(today(),8)})];const t=(id:string,description:string,amount:number,category:string,day:string,extra:Partial<Entry>={})=>entrySchema.parse({id,description,amount,category,date:month+'-'+day,account:'a1',type:'expense',...extra});const day=Number(today().slice(8));const past=(n:number)=>String(Math.min(day,n)).padStart(2,'0');const entries=[t('t1','Salário',580000,'Trabalho',past(5),{type:'income',incomeSource:'salary'}),t('t2','Aluguel',155000,'Moradia',past(6)),t('t3','Supermercado',28640,'Alimentação',past(9)),t('t4','Almoço',4290,'Alimentação',past(14)),t('t5','Combustível',18000,'Transporte',past(15)),t('t6','Cinema',6800,'Lazer',past(17)),t('t7','Trabalho extra',85000,'Trabalho',past(18),{type:'income',incomeSource:'freelance'}),t('t8','Feira da semana',9450,'Alimentação',past(20)),t('t9','Energia',18790,'Moradia','27',{status:'pending'}),t('t10','Internet',11990,'Moradia','25',{status:'pending'}),t('t11','Identidade visual',100000,'Trabalho','28',{type:'income',status:'pending',expectedTotal:250000,incomeSource:'freelance',payer:'Studio Aurora'}),t('t12','Identidade visual',150000,'Trabalho',past(12),{type:'income',status:'confirmed',expectedTotal:250000,incomeSource:'freelance',payer:'Studio Aurora',receivable:'t11',group:'t11',notes:'Recebimento parcial'})];for(let i=0;i<6;i++)entries.push(t('parcel'+i,`Câmera · ${i+1}/6`,25000,'Compras','12',{date:addMonths(month+'-12',i),account:'c1',group:'camera',part:i+1,totalParts:6}));return {entities,entries,revision:0}}

export function receiveIncome(pending:Entry,amount:number,date=today(),newId=crypto.randomUUID()):Entry[]{
 if(pending.type!=='income'||pending.status!=='pending')throw Error('Esta entrada não está pendente');
 if(!Number.isSafeInteger(amount)||amount<=0||amount>pending.amount)throw Error('Informe um valor entre um centavo e o saldo a receber');
 dateSchema.parse(date);if(date>today())throw Error('O recebimento não pode estar no futuro');
 const expectedTotal=pending.expectedTotal||pending.amount;
 const expectedDate=pending.expectedDate||pending.date;
 if(amount===pending.amount)return [{...pending,expectedDate,expectedTotal,status:'confirmed',date}];
 return [{...pending,expectedDate,expectedTotal,amount:pending.amount-amount},{...pending,id:newId,receivable:pending.id,expectedDate,expectedTotal,amount,status:'confirmed',date,group:pending.group||pending.id,notes:[pending.notes,'Recebimento parcial'].filter(Boolean).join(' · ')}];
}
export function restoreDeletedIncome(payment: Entry, parent: Entry): Entry[] {
  if (
    payment.type !== 'income' || payment.status !== 'confirmed' ||
    parent.type !== 'income' || payment.receivable !== parent.id ||
    payment.id === parent.id
  ) throw Error('Recebimento vinculado inválido');

  if (parent.status === 'pending') {
    return [entrySchema.parse({ ...parent, expectedDate: parent.expectedDate || parent.date,
      amount: parent.amount + payment.amount })];
  }

  // A quitação ocupa o registro principal. Preserve esse dinheiro em um
  // recebimento separado antes de reabrir apenas a parcela que foi excluída.
  const pending = entrySchema.parse({
    ...parent,
    status: 'pending',
    amount: payment.amount,
    date: originalIncomeDate(parent),
  });
  const finalPayment = entrySchema.parse({
    ...parent,
    id: crypto.randomUUID(),
    receivable: parent.id,
    group: parent.group || parent.id,
  });
  return [pending, finalPayment];
}

// Só uma pendência ainda aberta contém uma data prevista inferível com segurança.
// Em registros antigos quitados, `date` já é a data do pagamento.
function originalIncomeDate(entry: Entry): string {
  if (entry.expectedDate) return entry.expectedDate;
  if (entry.status === 'pending') return entry.date;
  throw Error('Data prevista original indisponível. Informe a data original conhecida no registro principal antes de excluir; não use a data do pagamento como previsão.');
}

export function preserveIncomeDate(entry: Entry, previous?: Entry): Entry {
  if (entry.type !== 'income') return entry;
  const expectedDate = previous?.expectedDate ||
    (previous?.type === 'income' && previous.status === 'pending' ? previous.date : undefined) ||
    entry.expectedDate || (entry.status === 'pending' ? entry.date : undefined);
  return expectedDate ? { ...entry, expectedDate } : entry;
}

// Retorna os registros a gravar no mesmo lote que exclui `payment`.
// API e demonstração usam o mesmo plano; nenhum objeto recebido é alterado.
export function planIncomeDeletion(payment: Entry, related: Entry[]): Entry[] {
  if (payment.receivable) {
    const parent = related.find((entry) => entry.id === payment.receivable);
    if (!parent) throw Error('Recebimento vinculado inválido: registro principal ausente');
    return restoreDeletedIncome(payment, parent);
  }
  const children = related.filter((entry) => entry.receivable === payment.id);
  if (payment.type !== 'income') {
    if (children.length) throw Error('Vínculo inválido de recebimento');
    return [];
  }
  if (payment.status === 'pending') {
    if (children.length) throw Error('Este registro possui vínculos. Exclua os pagamentos antes da pendência.');
    return [];
  }
  // Receitas avulsas, sem previsão nem parcelas, mantêm a exclusão comum.
  if (!payment.expectedDate && !payment.expectedTotal && !children.length) return [];
  const date = originalIncomeDate(payment);
  const pending = entrySchema.parse({
    ...payment, id: crypto.randomUUID(), status: 'pending', date,
    expectedDate: date,
    group: payment.group === payment.id ? '' : payment.group,
  });
  return [pending, ...children.map((entry) => {
    if (entry.type !== 'income' || entry.status !== 'confirmed')
      throw Error('Recebimento vinculado inválido');
    return entrySchema.parse({ ...entry, receivable: pending.id,
      group: entry.group === payment.id ? pending.id : entry.group });
  })];
}

export function receivableProgress(entries:Entry[],pending:Entry){
 const payments=entries.filter(t=>t.receivable===pending.id&&t.type==='income'&&t.status==='confirmed').sort((a,b)=>b.date.localeCompare(a.date));
 const received=payments.reduce((sum,t)=>sum+t.amount,0);
 const total=Math.max(pending.expectedTotal,pending.amount+received);
 return {total,received,remaining:pending.amount,payments,percent:total?Math.min(100,Math.round(received/total*100)):0};
}
export function simulatePurchase(data:Data,month:string,price:number,down:number,parts:number){
 if(!Number.isSafeInteger(price)||!Number.isSafeInteger(down)||price<=0||down<0||down>price||!Number.isInteger(parts)||parts<1||parts>60)throw Error('Confira preço, entrada e parcelas');
 const s=summary(data,month);const effectiveDown=parts===1?0:down;const financed=price-effectiveDown;const installments=financed?split(financed,parts):[];
 return {price,down:effectiveDown,parts,installments,remainingCash:s.cash-(parts===1?price:down),conservativeFree:s.free-price,currentMonthlyInstallments:s.rows.filter(t=>t.type==='expense'&&t.totalParts>1).reduce((v,t)=>v+t.amount,0),pendingIncome:s.rows.filter(t=>t.type==='income'&&t.status==='pending').reduce((v,t)=>v+t.amount,0)};
}

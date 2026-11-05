import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { parseSmartEntry, amountForInput, type SmartEntryDraft } from '@/lib/smart-entry';
import { money, type Entity } from '@/lib/finance';

export function SmartEntryCapture({ accounts, categories, onApply }: { accounts: Entity[]; categories: string[]; onApply: (fields: Partial<Record<string, string>>) => void }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<SmartEntryDraft | null>(null);
  return <section className="smart-capture" aria-label="Registro assistido">
    <div className="smart-capture-heading"><Sparkles size={18} /><strong>Texto rápido · interpretação local</strong></div>
    <label>Experimente com um exemplo fictício
      <textarea aria-label="Texto do lançamento fictício" value={text} onChange={event => { setText(event.target.value); setDraft(null); }} placeholder="Gastei 48 reais no almoço pela conta Principal" />
    </label>
    <button type="button" className="secondary" disabled={!text.trim()} onClick={() => setDraft(parseSmartEntry({ text, source: 'text', accounts, categories }))}>Interpretar texto</button>
    {draft && <div className="notice"><p>{draft.name || 'Confira a descrição'} · {money(draft.amount || 0)} · {draft.date}</p>
      <button type="button" className="secondary" onClick={() => { onApply({ name: draft.name, amount: draft.amount ? amountForInput(draft.amount) : undefined, date: draft.date, type: draft.type, account: draft.account, category: draft.category, status: draft.status, incomeSource: draft.incomeSource, payer: draft.payer, origin: 'text-assist' }); setDraft(null); }}>Preencher e revisar formulário</button>
    </div>}
    <small>Sem envio de texto. Voz e leitura de imagens não fazem parte desta demonstração.</small>
  </section>;
}

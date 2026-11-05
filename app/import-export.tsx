import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { entrySchema, fingerprint, money, today, type Data, type Entry, type Entity } from '@/lib/finance';
import { escapeCsv, parseCsv } from '@/lib/csv';

function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ImportExport({ data, onSave }: { data: Data; demo?: boolean; month?: string; onSave: (change: { entries?: Entry[]; entities?: Entity[] }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const account = data.entities.find(entity => entity.kind === 'account' && entity.type !== 'credit');
  const sample = parseCsv(`Data;Descrição;Valor\n${today()};Papelaria fictícia;2450\n${today()};Café fictício;850`).slice(1).map(([date, description, amount]) => entrySchema.parse({ id: `sample-import-${description}`, date, description, amount: Number(amount), account: account?.id || 'missing', type: 'expense', category: 'Outros', origin: 'exemplo fictício' }));
  const known = new Set(data.entries.map(fingerprint));
  const preview = sample.filter(entry => !known.has(fingerprint(entry)) && !data.entries.some(existing => existing.id === entry.id));
  return <>
    <div className="export-buttons">
      <button className="secondary" onClick={() => download(JSON.stringify({ demo: true, version: 1, entities: data.entities, entries: data.entries }, null, 2), 'application/json', 'clareza-demo.json')}><Download size={15}/>JSON fictício</button>
      <button className="secondary" onClick={() => download('\uFEFF' + [['Data', 'Descrição', 'Valor', 'Tipo'], ...data.entries.map(entry => [entry.date, entry.description, (entry.amount / 100).toFixed(2), entry.type])].map(row => row.map(escapeCsv).join(';')).join('\r\n'), 'text/csv;charset=utf-8', 'clareza-demo.csv')}><Download size={15}/>CSV fictício</button>
    </div>
    <button className="secondary full" disabled={!account} onClick={() => { setError(''); setOpen(true); }}><Upload size={15}/>Importar exemplo fictício</button>
    <p className="footnote">Importação simulada com uma amostra embutida, prévia e prevenção de duplicatas. Não há seleção de arquivos pessoais.</p>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="finance-dialog"><DialogHeader><DialogTitle>Importar exemplo fictício</DialogTitle><DialogDescription>Confira os registros antes de adicioná-los à memória desta aba.</DialogDescription></DialogHeader>
      {preview.map(entry => <p key={entry.id}>{entry.description} · {money(entry.amount)}</p>)}
      <p>{sample.length - preview.length} possíveis duplicatas ignoradas.</p>
      <button className="primary" disabled={busy || !preview.length} onClick={async () => { setBusy(true); try { await onSave({ entries: preview }); setOpen(false); } catch (error) { setError(error instanceof Error ? error.message : 'Confira os dados'); } finally { setBusy(false); } }}>Confirmar importação fictícia</button>
      {error && <p role="alert">{error}</p>}
    </DialogContent></Dialog>
  </>;
}

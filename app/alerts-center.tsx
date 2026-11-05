import { useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { buildFinancialAlerts } from '@/lib/alerts';
import type { Data } from '@/lib/finance';
export function AlertBell({ data, navigate }: { data: Data; demo?: boolean; navigate: (page: string) => void }) {
  const [open, setOpen] = useState(false);
  const alerts = buildFinancialAlerts(data);
  return <><button className="iconbutton alert-button" aria-label="Alertas da demonstração" onClick={() => setOpen(true)}><Bell size={19}/>{alerts.length > 0 && <span>{alerts.length}</span>}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="finance-dialog alerts-dialog"><DialogHeader><DialogTitle>Seus alertas fictícios</DialogTitle><DialogDescription>Calculados localmente a partir do cenário de demonstração.</DialogDescription></DialogHeader>
      {alerts.map(alert => <button key={alert.id} className="alert-item" onClick={() => { setOpen(false); navigate(alert.target); }}><span><b>{alert.title}</b><small>{alert.detail}</small></span><ChevronRight size={18}/></button>)}
      {!alerts.length && <p>Nada urgente neste cenário.</p>}
    </DialogContent></Dialog></>;
}

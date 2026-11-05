"use client";
import { useState } from "react";
import {
  ArrowDownRight,
  Plus,
  Check,
  Target,
  Wallet,
  BriefcaseBusiness,
  Sparkles,
  Clock3,
  Users,
  ShieldCheck,
  LockKeyhole,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Choice } from "./clareza";
import {
  entitySchema,
  summary,
  simulatePurchase,
  receiveIncome,
  receivableProgress,
  money as formatMoney,
  toCents,
  today,
  addMonths,
  monthlyNeed,
  type Data,
  type Entry,
  type Entity,
} from "@/lib/finance";
type Save = (change: {
  entries?: Entry[];
  entities?: Entity[];
}) => Promise<void>;
const raw = (v: number) => (v / 100).toFixed(2).replace(".", ",");
const shortDate = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("pt-BR");
export function IncomeHub({
  data,
  month,
  open,
  onSave,
  hidden = false,
}: {
  hidden?: boolean;
  data: Data;
  month: string;
  open: (kind: string, item?: Entry) => void;
  onSave: Save;
}) {
  const money = (v: number) => (hidden ? "••••••" : formatMoney(v));
  const [view, setView] = useState<"pending" | "received" | "clients">(
    "pending",
  );
  const [receiving, setReceiving] = useState<Entry | null>(null),
    [paymentMode, setPaymentMode] = useState<"full" | "partial">("full"),
    [value, setValue] = useState(""),
    [date, setDate] = useState(today()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const allIncome = data.entries.filter((t) => t.type === "income");
  const rows = allIncome.filter((t) => t.date.startsWith(month));
  const receivedRows = rows
    .filter((t) => t.status === "confirmed")
    .sort((a, b) => b.date.localeCompare(a.date));
  const due = allIncome
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date));
  const received = receivedRows.reduce((s, t) => s + t.amount, 0);
  const pending = rows
    .filter((t) => t.status === "pending")
    .reduce((s, t) => s + t.amount, 0);
  const overdue = due.filter((t) => t.date < today());
  const clients = Array.from(
    allIncome
      .reduce((map, t) => {
        const name = t.payer.trim() || "Sem cliente informado";
        const current = map.get(name) || {
          name,
          received: 0,
          pending: 0,
          jobs: 0,
          last: "",
        };
        if (!t.receivable) current.jobs += 1;
        current.last = current.last > t.date ? current.last : t.date;
        if (t.status === "confirmed") current.received += t.amount;
        else current.pending += t.amount;
        map.set(name, current);
        return map;
      }, new Map<string, { name: string; received: number; pending: number; jobs: number; last: string }>())
      .values(),
  ).sort((a, b) => b.pending - a.pending || b.received - a.received);
  const startReceiving = (entry: Entry) => {
    const progress = receivableProgress(data.entries, entry);
    setReceiving({ ...entry, expectedTotal: progress.total });
    setPaymentMode("full");
    setValue(raw(entry.amount));
    setDate(today());
    setError("");
  };
  const activeProgress = receiving
    ? receivableProgress(data.entries, receiving)
    : null;
  const typedPayment = (() => {
    if (paymentMode === "full") return receiving?.amount || 0;
    try {
      return value ? toCents(value) : 0;
    } catch {
      return 0;
    }
  })();
  const remainingAfterPayment = Math.max(
    0,
    (receiving?.amount || 0) - typedPayment,
  );
  return (
    <>
      <div className="quick-start panel freelancer-start">
        <div>
          <p className="eyebrow">RENDA FIXA E VARIÁVEL</p>
          <h3>Salários, clientes e freelas</h3>
          <p>
            Veja o que entrou, o que está atrasado e o que ainda precisa ser
            cobrado.
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => open("income")}>
            <ArrowDownRight size={18} /> Recebi agora
          </button>
          <button className="secondary" onClick={() => open("receivable")}>
            <Clock3 size={18} /> Novo trabalho a receber
          </button>
        </div>
      </div>
      <div className="freelancer-stats">
        <button
          className="panel balance interactive-panel"
          onClick={() => setView("received")}
        >
          <span>Recebido no mês</span>
          <h2>{money(received)}</h2>
          <small>Ver entradas confirmadas</small>
        </button>
        <button
          className="panel interactive-panel"
          onClick={() => setView("pending")}
        >
          <span>A receber no mês</span>
          <h2>{money(pending)}</h2>
          <small>Ver valores previstos</small>
        </button>
        <button
          className={
            (overdue.length ? "panel freelancer-alert" : "panel") +
            " interactive-panel"
          }
          onClick={() => setView("pending")}
        >
          <span>Em atraso</span>
          <h2>{money(overdue.reduce((s, t) => s + t.amount, 0))}</h2>
          <small>{overdue.length} recebimento(s) para conferir</small>
        </button>
        <button
          className="panel interactive-panel"
          onClick={() => setView("clients")}
        >
          <span>Clientes e pagadores</span>
          <h2>
            {clients.filter((c) => c.name !== "Sem cliente informado").length}
          </h2>
          <small>Ver histórico por pessoa</small>
        </button>
      </div>
      <div
        className="income-tabs"
        role="tablist"
        aria-label="Visão das entradas"
      >
        <button
          role="tab"
          aria-selected={view === "pending"}
          className={view === "pending" ? "active" : ""}
          onClick={() => setView("pending")}
        >
          A receber <span>{due.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "received"}
          className={view === "received" ? "active" : ""}
          onClick={() => setView("received")}
        >
          Recebido no mês <span>{receivedRows.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={view === "clients"}
          className={view === "clients" ? "active" : ""}
          onClick={() => setView("clients")}
        >
          Por cliente <span>{clients.length}</span>
        </button>
      </div>
      {view === "pending" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Valores a receber</h3>
              <p>
                Clique em um trabalho para editar ou confirme um pagamento total
                ou parcial.
              </p>
            </div>
            {overdue.length > 0 && (
              <span className="badge overdue-badge">
                {overdue.length} em atraso
              </span>
            )}
          </div>
          {!due.length && (
            <p className="empty-small">
              Nenhum valor a receber. Use “Novo trabalho a receber” para
              registrar um trabalho combinado antes do pagamento.
            </p>
          )}
          {due.map((t) => {
            const progress = receivableProgress(data.entries, t);
            return (
              <div
                className={
                  "income-row " + (t.date < today() ? "is-overdue" : "")
                }
                key={t.id}
              >
                <span className="tile-icon">
                  <BriefcaseBusiness size={20} />
                </span>
                <button
                  className="income-info"
                  onClick={() => open("receivable", t)}
                >
                  <b>{t.description}</b>
                  <small>
                    {t.payer || "Pagador não informado"} · previsto para{" "}
                    {shortDate(t.date)}
                    {t.date < today() ? " · Em atraso" : ""}
                  </small>
                  <span className="receivable-progress">
                    <Progress
                      aria-label={`Percentual já recebido de ${t.description}`}
                      value={progress.percent}
                    />
                    <small>
                      Já recebido {money(progress.received)} de{" "}
                      {money(progress.total)}
                    </small>
                  </span>
                </button>
                <span className="income-remaining">
                  <small>Falta receber</small>
                  <strong>{money(progress.remaining)}</strong>
                </span>
                <button
                  className="secondary receive-button"
                  onClick={() => startReceiving(t)}
                >
                  Registrar recebimento
                </button>
              </div>
            );
          })}
        </section>
      )}
      {view === "received" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Recebido no mês</h3>
              <p>Entradas confirmadas que já fazem parte do saldo.</p>
            </div>
            <strong>{money(received)}</strong>
          </div>
          {receivedRows.map((t) => (
            <button
              className="entry"
              key={t.id}
              onClick={() => open("entry", t)}
            >
              <span className="entry-icon income">
                <ArrowDownRight />
              </span>
              <span className="entry-copy">
                <strong>{t.description}</strong>
                <small>
                  {t.receivable ||
                  allIncome.some((payment) => payment.receivable === t.id)
                    ? "Pagamento do trabalho · "
                    : ""}
                  {
                    {
                      salary: "Salário",
                      freelance: "Freela / serviço",
                      sales: "Venda / comissão",
                      other: "Outra entrada",
                    }[t.incomeSource]
                  }
                  {t.payer ? " · " + t.payer : ""}
                </small>
              </span>
              <span className="entry-amount">
                <strong>{money(t.amount)}</strong>
                <small>{shortDate(t.date)}</small>
              </span>
            </button>
          ))}
          {!receivedRows.length && (
            <p className="empty-small">Nenhuma entrada recebida neste mês.</p>
          )}
        </section>
      )}
      {view === "clients" && (
        <section className="client-grid">
          {clients.map((client) => (
            <button
              className="panel client-card"
              key={client.name}
              onClick={() => {
                const item = [...allIncome]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .find(
                  (t) =>
                    (t.payer.trim() || "Sem cliente informado") === client.name,
                  );
                if (item) open("entry", item);
              }}
            >
              <span className="tile-icon">
                <Users size={20} />
              </span>
              <span>
                <b>{client.name}</b>
                <small>
                  {client.jobs} registro(s) · último em {shortDate(client.last)}
                </small>
              </span>
              <div>
                <p>A receber</p>
                <strong className={client.pending ? "future-text" : ""}>
                  {money(client.pending)}
                </strong>
              </div>
              <div>
                <p>Já recebido</p>
                <strong>{money(client.received)}</strong>
              </div>
            </button>
          ))}
          {!clients.length && (
            <section className="panel">
              <p className="empty-small">
                Informe o cliente ou pagador nas próximas entradas para
                acompanhar cada relacionamento.
              </p>
            </section>
          )}
        </section>
      )}
      <Dialog
        open={!!receiving}
        onOpenChange={(v) => !v && !busy && setReceiving(null)}
      >
        <DialogContent className="finance-dialog">
          <DialogHeader>
            <DialogTitle>Registrar pagamento do trabalho</DialogTitle>
            <DialogDescription>
              {receiving?.description}
              {receiving?.payer ? ` · ${receiving.payer}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form
            className="editor"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const amount =
                  paymentMode === "full"
                    ? receiving!.amount
                    : toCents(value);
                await onSave({
                  entries: receiveIncome(receiving!, amount, date),
                });
                setReceiving(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="payment-summary" aria-label="Resumo do trabalho">
              <span>
                <small>Valor total do trabalho</small>
                <strong>{money(activeProgress?.total || 0)}</strong>
              </span>
              <span>
                <small>Já recebido</small>
                <strong>{money(activeProgress?.received || 0)}</strong>
              </span>
              <span>
                <small>Falta receber</small>
                <strong>{money(activeProgress?.remaining || 0)}</strong>
              </span>
            </div>
            <div
              className="payment-options"
              role="radiogroup"
              aria-label="Tipo de recebimento"
            >
              <button
                type="button"
                role="radio"
                aria-checked={paymentMode === "full"}
                className={paymentMode === "full" ? "active" : ""}
                onClick={() => {
                  setPaymentMode("full");
                  setValue(raw(receiving?.amount || 0));
                  setError("");
                }}
              >
                <Check size={19} />
                <span>
                  <b>Recebi tudo</b>
                  <small>Quitar o saldo deste trabalho</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={paymentMode === "partial"}
                className={paymentMode === "partial" ? "active" : ""}
                onClick={() => {
                  setPaymentMode("partial");
                  setValue("");
                  setError("");
                }}
              >
                <Clock3 size={19} />
                <span>
                  <b>Recebi só uma parte</b>
                  <small>Manter o restante a receber</small>
                </span>
              </button>
            </div>
            {paymentMode === "partial" ? (
              <label className="field">
                Quanto recebeu nesta parte?
                <div className="money-input">
                  <span>R$</span>
                  <input
                    aria-label="Quanto recebeu nesta parte?"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              </label>
            ) : (
              <div className="current-payment">
                <span>Valor deste recebimento</span>
                <strong>{money(receiving?.amount || 0)}</strong>
              </div>
            )}
            <label className="field">
              Data do recebimento
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            {paymentMode === "partial" && typedPayment > 0 && (
              <p className="payment-after">
                {typedPayment < (receiving?.amount || 0)
                  ? `Depois deste pagamento, ainda faltará ${money(remainingAfterPayment)}.`
                  : typedPayment === (receiving?.amount || 0)
                    ? "Este pagamento vai quitar o trabalho."
                    : "O valor informado é maior que o saldo a receber."}
              </p>
            )}
            {!!activeProgress?.payments.length && (
              <div className="payment-history">
                <b>Pagamentos anteriores</b>
                {activeProgress.payments.map((payment) => (
                  <span key={payment.id}>
                    <small>{shortDate(payment.date)}</small>
                    <strong>{money(payment.amount)}</strong>
                  </span>
                ))}
              </div>
            )}
            <p className="footnote">
              O saldo da conta aumenta apenas pelo valor recebido agora. O
              Clareza mantém o valor total e o histórico deste trabalho.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              <Check size={17} /> Confirmar recebimento
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function PersonalProfile({
  data,
  busy,
  onSave,
  open,
}: {
  data: Data;
  busy: boolean;
  onSave: Save;
  open: (kind: string) => void;
}) {
  const saved = data.entities.find((e) => e.kind === "profile");
  const [name, setName] = useState(saved?.name || ""),
    [mode, setMode] = useState(saved?.incomeMode || "mixed"),
    [account, setAccount] = useState(saved?.defaultAccount || "none"),
    [income, setIncome] = useState(raw(saved?.amount || 0)),
    [essential, setEssential] = useState(raw(saved?.current || 0)),
    [focus, setFocus] = useState(saved?.focus || "Organizar meu dinheiro"),
    [error, setError] = useState("");
  return (
    <section className="panel personal-profile">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMECE POR AQUI</p>
          <h3>Seu perfil financeiro</h3>
        </div>
        <Wallet size={23} />
      </div>
      <p>
        Conte como seu dinheiro entra e o que você quer organizar. Estes valores
        orientam simulações; não criam movimentações.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave({
              entities: [
                entitySchema.parse({
                  ...saved,
                  id: saved?.id || crypto.randomUUID(),
                  kind: "profile",
                  name: name.trim(),
                  incomeMode: mode,
                  defaultAccount: account === "none" ? "" : account,
                  amount: toCents(income),
                  current: toCents(essential),
                  focus,
                }),
              ],
            });
          } catch (err) {
            setError(
              (err as any).issues?.[0]?.message || (err as Error).message,
            );
          }
        }}
      >
        <label className="field">
          Como prefere ser chamado?
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <div className="field">
          <span>Como sua renda funciona?</span>
          <Choice
            label="Perfil de renda"
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              ["fixed", "Tenho salário fixo"],
              ["variable", "Sou autônomo / minha renda varia"],
              ["mixed", "Tenho renda fixa e variável"],
            ]}
          />
        </div>
        <div className="field">
          <span>Conta principal para novos registros</span>
          <Choice
            label="Conta principal"
            value={account}
            onChange={setAccount}
            options={[
              ["none", "Escolher a conta em cada registro"],
              ...data.entities
                .filter((a) => a.kind === "account" && a.type !== "credit")
                .map((a) => [a.id, a.name] as [string, string]),
            ]}
          />
        </div>
        <div className="form-grid">
          <label className="field">
            {mode === "fixed"
              ? "Salário líquido de referência (R$)"
              : "Renda mensal conservadora (R$)"}
            <input
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </label>
          <label className="field">
            Gastos essenciais por mês (R$)
            <input
              inputMode="decimal"
              value={essential}
              onChange={(e) => setEssential(e.target.value)}
            />
          </label>
        </div>
        <p className="footnote">
          Para renda variável, use uma referência com a qual você se sente
          confortável. Freelas ainda não recebidos não são somados ao seu saldo.
        </p>
        <div className="field">
          <span>Minha prioridade agora</span>
          <Choice
            label="Prioridade financeira"
            value={focus}
            onChange={setFocus}
            options={[
              "Organizar meu dinheiro",
              "Controlar gastos",
              "Sair das dívidas",
              "Planejar compras",
              "Criar uma reserva",
              "Organizar meus freelas",
            ]}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary">
          <Check size={16} /> Salvar meu perfil
        </button>
      </form>
      <div className="setup-links">
        <h3>Cadastre suas informações</h3>
        <div className="actions">
          {[
            ["account", "Conta ou cartão"],
            ["income", "Salário ou freela"],
            ["recurring", "Conta recorrente"],
            ["goal", "Objetivo"],
            ["reserve", "Reserva"],
          ].map(([kind, label]) => (
            <button className="secondary" key={kind} onClick={() => open(kind)}>
              <Plus size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrivacyCenter({ demo: _demo = true }: { demo?: boolean }) {
  return <section className="panel privacy-center">
    <div className="section-heading"><h3>Uma demonstração independente</h3><ShieldCheck size={24} /></div>
    <p>Contas, pessoas, clientes e valores iniciais são fictícios. Use apenas exemplos inventados nos formulários.</p>
    <p>As alterações existem somente na memória desta aba. Recarregar ou reiniciar a demonstração restaura o cenário inicial.</p>
    <p>Não há login, banco de dados, sincronização, conexão bancária, envio de arquivos ou serviço de inteligência artificial.</p>
    <p>Áudio, câmera, OCR e notificações externas foram retirados. O registro por texto funciona com regras locais.</p>
  </section>;
}
export function PlanningTools({
  data,
  month,
  onSave,
  hidden = false,
}: {
  hidden?: boolean;
  data: Data;
  month: string;
  onSave: Save;
}) {
  const money = (v: number) => (hidden ? "••••••" : formatMoney(v));
  const [price, setPrice] = useState(""),
    [down, setDown] = useState("0,00"),
    [parts, setParts] = useState("1"),
    [name, setName] = useState("Minha simulação"),
    [result, setResult] = useState<ReturnType<typeof simulatePurchase> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = data.entities.find((e) => e.kind === "profile");
  return (
    <div className="settings-grid">
      <section className="panel">
        <p className="eyebrow">POSSO COMPRAR?</p>
        <h3>Veja o impacto antes de decidir</h3>
        <p>Esta simulação não altera suas contas, despesas ou reservas.</p>
        <form
          className="editor spaced"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setResult(
                simulatePurchase(
                  data,
                  month,
                  toCents(price),
                  toCents(down),
                  Number(parts),
                ),
              );
              setError("");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label className="field">
            Nome da simulação
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Preço total (R$)
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setResult(null);
              }}
              required
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Entrada (R$)
              <input
                inputMode="decimal"
                value={down}
                onChange={(e) => {
                  setDown(e.target.value);
                  setResult(null);
                }}
                required
              />
            </label>
            <label className="field">
              Parcelas (1 = à vista)
              <input
                type="number"
                min="1"
                max="60"
                value={parts}
                onChange={(e) => {
                  setParts(e.target.value);
                  setResult(null);
                }}
                required
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary">Calcular consequências</button>
        </form>
        {result && (
          <div className="simulation-result">
            <div className="report-row">
              <span>
                Saldo após {result.parts === 1 ? "a compra" : "a entrada"}
              </span>
              <b>{money(result.remainingCash)}</b>
            </div>
            <div className="report-row">
              <span>Parcela estimada</span>
              <b>
                {result.parts === 1
                  ? "À vista"
                  : money(Math.max(...result.installments, 0))}
              </b>
            </div>
            <div className="report-row">
              <span>Parcelas registradas neste mês</span>
              <b>{money(result.currentMonthlyInstallments)}</b>
            </div>
            <div className="report-row">
              <span>Livre após comprometer o preço total</span>
              <b>{money(result.conservativeFree)}</b>
            </div>
            <p className="footnote">
              A simulação usa o saldo atual e preserva as reservas. Valores a
              receber ({money(result.pendingIncome)} no mês) não são dinheiro
              disponível. Não inclui juros ou tarifas não informados.
            </p>
            {profile && (
              <p className="footnote">
                Referência do seu perfil: {money(profile.amount)} de renda e{" "}
                {money(profile.current)} de essenciais por mês. São hipóteses,
                não entradas garantidas.
              </p>
            )}
            <h3 className="spaced">Impacto nas próximas parcelas</h3>
            {result.installments.slice(0, 6).map((v, i) => (
              <div className="row" key={i}>
                <span>
                  {new Date(
                    addMonths(month + "-01", i) + "T12:00:00",
                  ).toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <b>{money(v)}</b>
              </div>
            ))}
            {result.parts > 6 && (
              <p className="footnote">
                Continua por {result.parts} parcelas. O primeiro mês é apenas
                uma hipótese; o vencimento real depende do cartão.
              </p>
            )}
            <button
              className="secondary full spaced"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave({
                    entities: [
                      entitySchema.parse({
                        id: crypto.randomUUID(),
                        kind: "scenario",
                        name,
                        amount: result.price,
                        current: result.down,
                        count: result.parts,
                        date: month + "-01",
                      }),
                    ],
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Salvar cenário separado
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h3>Seus cenários salvos</h3>
        <p>Abra uma hipótese para recalcular com os dados atuais.</p>
        {data.entities
          .filter((e) => e.kind === "scenario")
          .map((e) => (
            <button
              className="entry"
              key={e.id}
              onClick={() => {
                setName(e.name);
                setPrice(raw(e.amount));
                setDown(raw(e.current));
                setParts(String(e.count));
                setResult(
                  simulatePurchase(data, month, e.amount, e.current, e.count),
                );
              }}
            >
              <span className="tile-icon">
                <Target />
              </span>
              <span className="entry-copy">
                <strong>{e.name}</strong>
                <small>
                  {e.count} parcela(s) · entrada {money(e.current)}
                </small>
              </span>
              <b>{money(e.amount)}</b>
            </button>
          ))}
        {!data.entities.some((e) => e.kind === "scenario") && (
          <p className="empty-small">Nenhuma simulação salva ainda.</p>
        )}
        <h3 className="spaced">Objetivos que precisam de espaço</h3>
        {data.entities
          .filter((e) => e.kind === "goal")
          .map((e) => (
            <div className="report-row" key={e.id}>
              <span>{e.name}</span>
              <b>{money(monthlyNeed(e))}/mês</b>
            </div>
          ))}
      </section>
    </div>
  );
}
export function FinancialGuide({
  data,
  month,
  navigate,
  hidden = false,
}: {
  hidden?: boolean;
  data: Data;
  month: string;
  navigate: (v: string) => void;
}) {
  const money = (v: number) => (hidden ? "••••••" : formatMoney(v));
  const [question, setQuestion] = useState("free");
  const s = summary(data, month),
    prev = summary(data, addMonths(month + "-01", -1).slice(0, 7)),
    pending = data.entries.filter(
      (e) => e.type === "income" && e.status === "pending",
    ),
    goals = data.entities.filter((e) => e.kind === "goal");
  const responses: Record<
    string,
    { title: string; text: string; target: string }
  > = {
    free: {
      title: "Quanto tenho livre?",
      text: `Você tem ${money(s.cash)} nas contas. Reservas, objetivos e compras separam ${money(s.reserved)} e os cartões comprometem ${money(s.cards)}, incluindo parcelas futuras. Restam ${money(s.free)} nessa base. Contas pendentes (${money(s.pending)} no mês) e dívidas (${money(s.debts)}) ainda precisam ser consideradas.`,
      target: "Relatórios",
    },
    income: {
      title: "Quanto falta receber?",
      text: `Há ${pending.length} entradas pendentes no intervalo carregado, somando ${money(pending.reduce((v, t) => v + t.amount, 0))}. No mês selecionado, você confirmou ${money(s.income)} de entradas. Recebimentos parciais podem ser registrados em Entradas e freelas.`,
      target: "Entradas e freelas",
    },
    expense: {
      title: "Como estão meus gastos?",
      text: `As despesas confirmadas do mês somam ${money(s.expense)}. No mês anterior selecionável foram ${money(prev.expense)}. A diferença é ${money(s.expense - prev.expense)}. A comparação depende do que foi registrado e pode incluir um mês ainda incompleto.`,
      target: "Movimentações",
    },
    goals: {
      title: "Quanto guardar para meus objetivos?",
      text: goals.length
        ? goals
            .map(
              (g) =>
                `${g.name}: faltam ${money(Math.max(0, g.amount - g.current))}${g.date ? ", referência de " + money(monthlyNeed(g)) + "/mês até o prazo" : ", sem prazo definido"}.`,
            )
            .join(" ")
        : "Você ainda não cadastrou objetivos. Defina um valor e um prazo para calcular quanto reservar por mês.",
      target: "Objetivos",
    },
  };
  const answer = responses[question];
  return (
    <div className="settings-grid">
      <section className="panel">
        <span className="tile-icon">
          <Sparkles />
        </span>
        <h3 className="spaced">Respostas com base nos seus registros</h3>
        <p>
          Escolha uma pergunta. Os valores vêm dos cálculos do aplicativo; esta
          versão não usa IA generativa.
        </p>
        <div className="guide-questions">
          {Object.entries(responses).map(([key, r]) => (
            <button
              className={question === key ? "primary" : "secondary"}
              key={key}
              onClick={() => setQuestion(key)}
            >
              {r.title}
            </button>
          ))}
        </div>
        <section className="guide-answer" aria-live="polite">
          <h3>{answer.title}</h3>
          <p>{answer.text}</p>
          <button
            className="textbutton"
            onClick={() => navigate(answer.target)}
          >
            Ver detalhes
          </button>
        </section>
      </section>
      <section className="panel">
        <h3>Pontos para acompanhar</h3>
        {data.entities
          .filter((e) => e.kind === "budget" && e.date?.startsWith(month))
          .map((b) => {
            const spent = s.rows
              .filter(
                (t) =>
                  t.type === "expense" &&
                  t.status === "confirmed" &&
                  t.category === b.category,
              )
              .reduce((v, t) => v + t.amount, 0);
            return (
              <div className="report-row" key={b.id}>
                <span>
                  {b.category}
                  <small className="block">
                    {money(spent)} de {money(b.amount)}
                  </small>
                </span>
                <b>{b.amount ? Math.round((spent / b.amount) * 100) : 0}%</b>
              </div>
            );
          })}
        <p className="footnote">
          Entradas previstas, períodos incompletos e dados que você ainda não
          informou podem mudar esta leitura.
        </p>
        <button
          className="secondary spaced"
          onClick={() => navigate("Planejar")}
        >
          Abrir planejamento e simulações
        </button>
      </section>
    </div>
  );
}

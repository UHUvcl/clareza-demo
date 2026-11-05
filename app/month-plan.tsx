"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  Circle,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { buildMonthlyPlan } from "@/lib/month-plan";
import { money as formatMoney, type Data, type Entity } from "@/lib/finance";

const monthLabel = (month: string) =>
  new Date(`${month}-02T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

function PlanRows({
  title,
  description,
  items,
  total,
  empty,
  action,
  onEdit,
  hidden,
}: {
  title: string;
  description: string;
  items: Entity[];
  total: number;
  empty: string;
  action: ReactNode;
  onEdit: (item: Entity) => void;
  hidden: boolean;
}) {
  const money = (value: number) => (hidden ? "••••••" : formatMoney(value));
  return (
    <section className="panel plan-group">
      <div className="plan-group-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong>{money(total)}</strong>
      </div>
      <div className="plan-list">
        {items.map((item) => {
          const displayedAmount =
            item.kind === "debt"
              ? Math.ceil(item.current / Math.max(1, item.count))
              : item.amount;
          const detail =
            item.kind === "debt"
              ? `Parcela estimada · ${item.count} restante(s)`
              : item.kind === "budget"
                ? `${item.category} · limite mensal`
                : `${item.category}${item.date ? ` · dia ${item.date.slice(8)}` : " · sem vencimento"}`;
          return (
            <button
              className="plan-line"
              key={item.id}
              onClick={() => onEdit(item)}
              aria-label={`Editar ${item.name}`}
            >
              <span>
                <b>{item.name}</b>
                <small>{detail}</small>
              </span>
              <span className={displayedAmount ? "" : "needs-value"}>
                {displayedAmount ? money(displayedAmount) : "Valor a definir"}
                <Pencil size={14} />
              </span>
            </button>
          );
        })}
        {!items.length && <p className="plan-empty">{empty}</p>}
      </div>
      {action}
    </section>
  );
}

export function MonthlyPlan({
  data,
  month,
  hidden,
  open,
  navigate,
}: {
  data: Data;
  month: string;
  hidden: boolean;
  open: (kind: string, item?: Entity) => void;
  navigate: (page: string) => void;
}) {
  const plan = buildMonthlyPlan(data, month);
  const money = (value: number) => (hidden ? "••••••" : formatMoney(value));
  const allFixed = [
    ...plan.fixed,
    ...plan.unknownBills.filter((item) => item.expenseClass === "fixed"),
  ];
  const allVariable = [
    ...plan.variableBills,
    ...plan.unknownBills.filter((item) => item.expenseClass === "variable"),
  ];
  const allDebtBills = [
    ...plan.debtBills,
    ...plan.unknownBills.filter((item) => item.expenseClass === "debt"),
  ];
  const hasBills = allFixed.length + allVariable.length + allDebtBills.length > 0;
  const steps = [
    ["1", "Renda", plan.incomeReference > 0],
    ["2", "Contas", hasBills],
    ["3", "Limites", plan.budgets.length > 0],
    ["4", "Destino da sobra", plan.reserves.length > 0],
  ] as const;
  const commitmentPercent = plan.incomeReference
    ? Math.round((plan.committed / plan.incomeReference) * 100)
    : 0;
  const resultTitle = !plan.incomeReference
    ? "Defina sua renda de referência"
    : plan.remaining < 0
      ? `Faltam ${money(Math.abs(plan.remaining))} para o plano fechar`
      : plan.unknownBills.length
        ? `${money(plan.remaining)} ainda livres, com valores pendentes`
        : `${money(plan.remaining)} livres para decidir`;
  const resultText = !plan.incomeReference
    ? "Informe um salário líquido ou uma renda mensal conservadora. O Clareza usa esse valor para montar o plano antes do dinheiro entrar."
    : plan.remaining < 0
      ? "Revise primeiro os limites variáveis e as contas ainda estimadas. O objetivo é planejar despesas abaixo da renda."
      : plan.unknownBills.length
        ? `${plan.unknownBills.length} conta(s) ainda não entram no total porque estão sem valor. Complete quando souber, mesmo que seja uma estimativa.`
        : "Esse valor ainda não foi comprometido. Você pode direcionar uma parte para a reserva, antecipar dívidas ou usar em um objetivo.";

  return (
    <div className="month-plan">
      <section className="plan-hero">
        <div className="plan-hero-copy">
          <p className="eyebrow">PLANO DE {monthLabel(month).toUpperCase()}</p>
          <h2>Organize a renda antes de gastar</h2>
          <p>
            Cadastre o que se repete, defina limites para o que varia e veja
            quanto pode ir para sua segurança financeira.
          </p>
        </div>
        <button className="secondary" onClick={() => navigate("Configurações")}>
          <SlidersHorizontal size={17} /> Revisar renda
        </button>
      </section>

      <div className="plan-steps" aria-label="Etapas do planejamento mensal">
        {steps.map(([number, label, done]) => (
          <div className={done ? "done" : ""} key={number}>
            <span>{done ? <Check size={16} /> : number}</span>
            <b>{label}</b>
          </div>
        ))}
      </div>

      <section className="panel plan-result">
        <div className="plan-result-main">
          <span className={plan.remaining < 0 ? "result-icon danger-tone" : "result-icon"}>
            {plan.remaining < 0 ? <AlertCircle /> : <Landmark />}
          </span>
          <div>
            <p>Resultado planejado</p>
            <h2>{resultTitle}</h2>
            <p>{resultText}</p>
          </div>
        </div>
        <div className="plan-progress" aria-label={`${commitmentPercent}% da renda comprometida`}>
          <span style={{ width: `${Math.min(100, Math.max(0, commitmentPercent))}%` }} />
        </div>
        <div className="plan-result-numbers">
          <div>
            <span>Renda de referência</span>
            <strong>{money(plan.incomeReference)}</strong>
            <small>
              {plan.profile?.amount
                ? "Definida no seu perfil"
                : "Entradas já recebidas no mês"}
            </small>
          </div>
          <div>
            <span>Total comprometido</span>
            <strong>{money(plan.committed)}</strong>
            <small>{commitmentPercent}% da renda de referência</small>
          </div>
          <div>
            <span>A receber no mês</span>
            <strong>{money(plan.pendingIncome)}</strong>
            <small>Previsão; ainda não está no saldo</small>
          </div>
        </div>
      </section>

      <div className="plan-buckets">
        <div>
          <span className="bucket-icon"><ReceiptText size={18} /></span>
          <span><b>Fixos</b><small>{allFixed.length} conta(s)</small></span>
          <strong>{money(plan.fixedTotal)}</strong>
        </div>
        <div>
          <span className="bucket-icon"><WalletCards size={18} /></span>
          <span><b>Variáveis</b><small>contas + limites</small></span>
          <strong>{money(plan.variableBillsTotal + plan.budgetTotal)}</strong>
        </div>
        <div>
          <span className="bucket-icon"><CreditCard size={18} /></span>
          <span><b>Dívidas</b><small>parcelas estimadas</small></span>
          <strong>{money(plan.debtBillsTotal + plan.debtMonthlyTotal)}</strong>
        </div>
        <div>
          <span className="bucket-icon"><PiggyBank size={18} /></span>
          <span><b>Reserva atual</b><small>{plan.reserves.length} cofrinho(s)</small></span>
          <strong>{money(plan.reserveCurrent)}</strong>
        </div>
      </div>

      {plan.unknownBills.length > 0 && (
        <div className="notice plan-warning">
          <AlertCircle size={18} />
          <span>
            <b>{plan.unknownBills.length} conta(s) com valor a definir.</b> Elas
            ficam visíveis no plano, mas só entram no total depois que você
            informar uma estimativa.
          </span>
        </div>
      )}

      <div className="plan-groups">
        <PlanRows
          title="1. Custos fixos"
          description="Aluguel, internet, assinaturas e outras contas que se repetem."
          items={allFixed}
          total={plan.fixedTotal}
          empty="Cadastre aqui as contas que chegam todo mês."
          onEdit={(item) => open("recurring", item)}
          hidden={hidden}
          action={
            <button className="textbutton" onClick={() => open("recurring")}>
              <Plus size={16} /> Adicionar custo fixo
            </button>
          }
        />
        <PlanRows
          title="2. Gastos variáveis"
          description="Contas que oscilam e limites para alimentação, transporte e lazer."
          items={[...allVariable, ...plan.budgets]}
          total={plan.variableBillsTotal + plan.budgetTotal}
          empty="Defina pelo menos um limite para controlar o que varia."
          onEdit={(item) => open(item.kind, item)}
          hidden={hidden}
          action={
            <div className="plan-actions">
              <button className="textbutton" onClick={() => open("budget")}>
                <Plus size={16} /> Novo limite
              </button>
              <button className="textbutton" onClick={() => open("recurring")}>
                Conta variável mensal
              </button>
            </div>
          }
        />
        <PlanRows
          title="3. Parcelas e dívidas"
          description="A estimativa mensal divide o saldo pelas parcelas restantes."
          items={[...allDebtBills, ...plan.debts]}
          total={plan.debtBillsTotal + plan.debtMonthlyTotal}
          empty="Se houver uma dívida, mapeie saldo e parcelas restantes."
          onEdit={(item) => open(item.kind, item)}
          hidden={hidden}
          action={
            <button className="textbutton" onClick={() => open("debt")}>
              <Plus size={16} /> Mapear dívida
            </button>
          }
        />
      </div>

      <section className="panel reserve-guide">
        <div className="reserve-guide-icon"><PiggyBank size={25} /></div>
        <div>
          <p className="eyebrow">4. DESTINO DO RESTANTE</p>
          <h3>
            {plan.remaining > 0
              ? `Comece separando ${money(plan.starterReserve)}`
              : "Equilibre o plano antes de separar a reserva"}
          </h3>
          <p>
            {plan.remaining > 0
              ? "A sugestão inicial usa 5% da renda e nunca ultrapassa o valor livre. Depois, ajuste de acordo com dívidas, estabilidade da renda e objetivos."
              : "Quando o total comprometido ficar abaixo da renda, o valor livre aparecerá aqui com uma sugestão de reserva."}
          </p>
          {plan.reserveTarget > 0 && (
            <div className="reserve-target">
              <span>
                Reserva atual <b>{money(plan.reserveCurrent)}</b>
              </span>
              <span>
                Referência de {plan.reserveMonths} meses <b>{money(plan.reserveTarget)}</b>
              </span>
            </div>
          )}
          <small>
            A referência de emergência usa de 6 a 12 meses de gastos essenciais,
            conforme a estabilidade da renda. Ela é um ponto de partida, não uma regra.
          </small>
        </div>
        <button
          className="primary"
          onClick={() =>
            plan.reserves.length ? open("reserve", plan.reserves[0]) : open("reserve")
          }
        >
          {plan.reserves.length ? "Revisar reserva" : "Criar meu cofrinho"}
          <ArrowRight size={17} />
        </button>
      </section>

      <details className="panel plan-method">
        <summary>Como o Clareza calcula este plano?</summary>
        <div>
          <p><Circle size={9} /> Usa a renda mensal de referência salva no seu perfil.</p>
          <p><Circle size={9} /> Soma contas recorrentes, limites variáveis e parcelas estimadas.</p>
          <p><Circle size={9} /> Mostra o restante sem contar valores que ainda estão apenas “a receber”.</p>
          <p><Circle size={9} /> Nunca movimenta dinheiro sozinho; você decide o destino da sobra.</p>
        </div>
      </details>
    </div>
  );
}

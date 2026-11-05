"use client";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Eye,
  EyeOff,
  Target,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import {
  summary,
  addMonths,
  today,
  type Data,
  type Entry,
  type Entity,
} from "@/lib/finance";
import { monthlyForecast } from "@/lib/forecast";

type Props = {
  data: Data;
  month: string;
  hidden: boolean;
  toggleHidden: () => void;
  hiddenCards: string[];
  money: (n: number) => string;
  open: (kind: string, item?: Entry | Entity) => void;
  navigate: (page: string) => void;
  plan: (tab: string) => void;
  entries: (rows: Entry[]) => ReactNode;
};
export function HomeDashboard({
  data,
  month,
  hidden,
  toggleHidden,
  hiddenCards,
  money,
  open,
  navigate,
  plan,
  entries,
}: Props) {
  const s = summary(data, month);
  const forecast = monthlyForecast(data, month);
  const forecastMonth = new Date(`${month}-02T12:00:00`).toLocaleDateString(
    "pt-BR",
    { month: "long" },
  );
  const pending = s.rows
    .filter((t) => t.type === "income" && t.status === "pending")
    .reduce((n, t) => n + t.amount, 0);
  const upcoming = data.entries
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
  const budgets = data.entities.filter(
    (e) => e.kind === "budget" && e.date?.startsWith(month),
  );
  const goals = data.entities.filter((e) => e.kind === "goal").slice(0, 3);
  // The API loads three preceding months. Do not imply unavailable history is zero.
  const history = Array.from({ length: 4 }, (_, i) => {
    const m = addMonths(month + "-01", i - 3).slice(0, 7);
    const rows = data.entries.filter(
      (t) => t.date.startsWith(m) && t.status === "confirmed",
    );
    return {
      name: new Date(m + "-02T12:00:00").toLocaleDateString("pt-BR", {
        month: "short",
      }),
      Entradas: rows
        .filter((t) => t.type === "income")
        .reduce((n, t) => n + t.amount, 0),
      Saídas: rows
        .filter((t) => t.type === "expense")
        .reduce((n, t) => n + t.amount, 0),
    };
  });
  return (
    <div className="home-grid">
      <div className="stack">
        {!hiddenCards.includes("Saldo") && (
          <section className="balance-card" aria-label="Saldo nas contas">
            <div className="balance-label">
              <span>Saldo nas contas hoje</span>
              <button
                onClick={toggleHidden}
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {hidden ? <Eye size={15} /> : <EyeOff size={15} />}{" "}
                {hidden ? "Mostrar" : "Ocultar"}
              </button>
            </div>
            <button
              className="balance-main"
              onClick={() => navigate("Contas e cartões")}
            >
              <span className="balance-amount">{money(s.cash)}</span>
              <span className="balance-sub">
                <span>
                  <ArrowDownRight size={16} />
                  {money(s.income)} entradas no mês
                </span>
                <span>
                  <ArrowUpRight size={16} />
                  {money(s.expense)} saídas no mês
                </span>
              </span>
              <small className="card-link-hint">
                Ver contas e cartões <ArrowRight size={13} />
              </small>
            </button>
          </section>
        )}
        <section aria-label="Registrar movimentação">
          <h3 className="quick-title">O que você quer registrar?</h3>
          <div className="quick-actions">
            <button className="quick-btn" onClick={() => open("income")}>
              <span className="quick-btn-icon green">
                <ArrowDownRight size={22} />
              </span>
              Recebi<small>Salário, freela ou outra entrada</small>
            </button>
            <button className="quick-btn" onClick={() => open("entry")}>
              <span className="quick-btn-icon expense-tone">
                <ArrowUpRight size={22} />
              </span>
              Gastei<small>Compra ou conta do dia</small>
            </button>
            <button className="quick-btn" onClick={() => open("receivable")}>
              <span className="quick-btn-icon orange">
                <TrendingUp size={22} />
              </span>
              Vou receber<small>Um valor que ainda vai entrar</small>
            </button>
          </div>
        </section>
        <section className="panel forecast-summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">VISÃO DO MÊS</p>
              <h3>Previsão de {forecastMonth}</h3>
            </div>
            <span className="badge">Estimativa</span>
          </div>
          <p className="forecast-intro">
            Uma noção do que deve entrar, do que pode sair e do que tende a
            sobrar no mês.
          </p>
          <div className="forecast-cards">
            <button onClick={() => navigate("Entradas e freelas")}>
              <span>Renda prevista</span>
              <strong className="positive">{money(forecast.income)}</strong>
              <small>
                {money(forecast.toReceive)} ainda deve entrar
                <ArrowRight size={13} />
              </small>
            </button>
            <button onClick={() => navigate("Movimentações")}>
              <span>Gastos previstos</span>
              <strong className="expense-text">
                {money(forecast.expenses)}
              </strong>
              <small>
                {money(forecast.toPay)} ainda deve sair
                <ArrowRight size={13} />
              </small>
            </button>
            <button onClick={() => plan("Plano do mês")}>
              <span>Resultado previsto</span>
              <strong
                className={forecast.result >= 0 ? "positive" : "expense-text"}
              >
                {money(forecast.result)}
              </strong>
              <small>
                Abrir plano do mês <ArrowRight size={13} />
              </small>
            </button>
          </div>
          <div className="forecast-commitment">
            <span>
              <b>{forecast.committedPercent}%</b> da renda prevista está
              comprometida
            </span>
            <Progress
              value={Math.min(100, forecast.committedPercent)}
              aria-label="Percentual da renda comprometida"
            />
          </div>
          <p className="footnote">
            Combina registros, valores pendentes, recorrências e referências do
            seu perfil sem contar o mesmo item duas vezes.
          </p>
        </section>
        <div className="home-stats">
          {!hiddenCards.includes("Receitas") && (
            <button
              className="stat-card"
              onClick={() => navigate("Entradas e freelas")}
            >
              <p>Entradas no mês</p>
              <strong className="positive">{money(s.income)}</strong>
              <small>
                Já recebidas <ArrowRight size={12} />
              </small>
            </button>
          )}
          {!hiddenCards.includes("Despesas") && (
            <button
              className="stat-card"
              onClick={() => navigate("Movimentações")}
            >
              <p>Saídas no mês</p>
              <strong className="expense-text">{money(s.expense)}</strong>
              <small>
                Despesas confirmadas <ArrowRight size={12} />
              </small>
            </button>
          )}
          <button
            className="stat-card"
            onClick={() => navigate("Entradas e freelas")}
          >
            <p>A receber no mês</p>
            <strong className="future-text">{money(pending)}</strong>
            <small>
              Ver entradas e freelas <ArrowRight size={12} />
            </small>
          </button>
        </div>
        <section className="panel">
          <div className="section-heading">
            <h3>Últimas movimentações</h3>
            <button
              className="textbutton"
              onClick={() => navigate("Movimentações")}
            >
              Ver todas <ArrowRight size={15} />
            </button>
          </div>
          {entries(
            [...s.rows]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5),
          )}
        </section>
        {!hiddenCards.includes("Disponível") && (
          <section className="panel allocation-summary">
            <div>
              <h3>Dinheiro com destino</h3>
              <p>Depois das reservas e do total devedor dos cartões</p>
            </div>
            <strong>{money(s.free)}</strong>
            <p className="footnote">
              Este valor ainda não desconta dívidas e contas pendentes. Você
              separou {money(s.reserved)} para reservas, compras e objetivos.
            </p>
            <button className="textbutton" onClick={() => plan("Reservas")}>
              Organizar minhas reservas <ArrowRight size={15} />
            </button>
          </section>
        )}
      </div>
      <div className="stack">
        <section className="panel">
          <div className="section-heading">
            <h3>Próximos compromissos</h3>
            <CalendarDays size={18} />
          </div>
          {upcoming.length ? (
            upcoming.map((t) => (
              <button
                className="commitment"
                key={t.id}
                onClick={() =>
                  t.type === "income"
                    ? navigate("Entradas e freelas")
                    : open("entry", t)
                }
              >
                <span className="date-tile">
                  {t.date.slice(8)}
                  <small>
                    {new Date(t.date + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                      { month: "short" },
                    )}
                  </small>
                </span>
                <span className="commitment-copy">
                  <b>{t.description}</b>
                  <small>
                    {t.date < today() ? "Em atraso · " : ""}
                    {t.type === "income"
                      ? "A receber"
                      : t.type === "transfer"
                        ? "Transferência pendente"
                        : "A pagar"}
                  </small>
                </span>
                <strong
                  className={
                    t.type === "income" ? "future-text" : "expense-text"
                  }
                >
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {money(t.amount)}
                </strong>
              </button>
            ))
          ) : (
            <p className="empty-small">
              Nenhum compromisso pendente registrado.
            </p>
          )}
          <button className="textbutton" onClick={() => navigate("Calendário")}>
            Ver agenda <ArrowRight size={15} />
          </button>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h3>Orçamento</h3>
            <button
              className="textbutton"
              onClick={() => plan("Plano do mês")}
            >
              Planejar <ArrowRight size={15} />
            </button>
          </div>
          {budgets.length ? (
            budgets.slice(0, 5).map((e) => {
              const spent = s.rows
                .filter(
                  (t) =>
                    t.type === "expense" &&
                    t.status === "confirmed" &&
                    t.category === e.category,
                )
                .reduce((n, t) => n + t.amount, 0);
              const pc = e.amount ? (spent / e.amount) * 100 : 0;
              return (
                <button
                  className={
                    "budget-item " + (spent > e.amount ? "over-budget" : "")
                  }
                  key={e.id}
                  onClick={() => open("budget", e)}
                >
                  <span className="row">
                    <b>{e.category}</b>
                    <small>
                      {money(spent)} / {money(e.amount)}
                    </small>
                  </span>
                  <Progress
                    value={Math.min(100, pc)}
                    aria-label={"Orçamento de " + e.category}
                  />
                  <small>
                    {spent > e.amount
                      ? "Excedeu em " + money(spent - e.amount)
                      : Math.round(pc) + "% utilizado"}
                  </small>
                </button>
              );
            })
          ) : (
            <>
              <p className="empty-small">
                Escolha quanto quer gastar em cada categoria.
              </p>
              <button className="secondary full" onClick={() => open("budget")}>
                Criar meu primeiro limite
              </button>
            </>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h3>Últimos 4 meses</h3>
            <button
              className="textbutton"
              onClick={() => navigate("Relatórios")}
            >
              Ver relatório <ArrowRight size={15} />
            </button>
          </div>
          <div className="chart home-chart">
            <BarChart
              data={history}
              responsive
              style={{ width: "100%", height: "100%" }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => money(Number(value))}
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  borderRadius: 10,
                }}
              />
              <Bar
                isAnimationActive={false}
                dataKey="Entradas"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                isAnimationActive={false}
                dataKey="Saídas"
                fill="var(--future-color)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </div>
          <div className="chart-legend">
            <span>
              <i className="income-dot" />
              Entradas
            </span>
            <span>
              <i className="expense-dot" />
              Saídas
            </span>
          </div>
          <p className="footnote">
            Somente movimentações confirmadas registradas no app.
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h3>Objetivos</h3>
            <Target size={18} />
          </div>
          {goals.length ? (
            goals.map((e) => (
              <button
                className="budget-item"
                key={e.id}
                onClick={() => navigate("Objetivos")}
              >
                <span className="row">
                  <b>{e.name}</b>
                  <small>
                    {e.amount ? Math.round((e.current / e.amount) * 100) : 0}%
                  </small>
                </span>
                <Progress
                  aria-label={e.name}
                  value={Math.min(
                    100,
                    e.amount ? (e.current / e.amount) * 100 : 0,
                  )}
                />
                <small>
                  {money(e.current)} de {money(e.amount)}
                </small>
              </button>
            ))
          ) : (
            <p className="empty-small">
              Uma viagem, uma reserva, um plano seu.
            </p>
          )}
          <button className="textbutton" onClick={() => open("goal")}>
            Adicionar objetivo <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}

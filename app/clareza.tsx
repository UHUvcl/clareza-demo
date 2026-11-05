"use client";
import {
  Fragment,
  useState,
  useEffect,
  useRef,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Leaf,
  Home,
  ArrowLeftRight,
  CalendarDays,
  Target,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sun,
  Moon,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  ShoppingBag,
  PiggyBank,
  CreditCard,
  Repeat,
  SlidersHorizontal,
  Download,
  Upload,
  Trash2,
  Pencil,
  Check,
  Layers,
  ChartNoAxesCombined,
  Ellipsis,
  ArrowRight,
  Eye,
  EyeOff,
  LogOut,
  Monitor,
  RefreshCw,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  categories,
  entitySchema,
  entrySchema,
  planIncomeDeletion,
  preserveIncomeDate,
  blank,
  demoData,
  summary,
  balance,
  money,
  toCents,
  today,
  addMonths,
  split,
  invoiceDate,
  monthlyNeed,
  validateLinks,
  fingerprint,
  type Data,
  type Entity,
  type Entry,
} from "@/lib/finance";
import { monthlyForecast } from "@/lib/forecast";
import { recurringDateForMonth } from "@/lib/recurring";
import {
  IncomeHub,
  PersonalProfile,
  PlanningTools,
  FinancialGuide,
  PrivacyCenter,
} from "./improvements";
import { HomeDashboard } from "./home-dashboard";
import { ImportExport } from "./import-export";
import { SmartEntryCapture } from "./smart-entry-capture";
import { AlertBell } from "./alerts-center";
import { applyDemoChange, createDemoData, type DemoChange } from "@/lib/demo-store";
import { MonthlyPlan } from "./month-plan";
const mainNav = [
  ["Início", Home],
  ["Movimentações", ArrowLeftRight],
  ["Planejar", CalendarDays],
  ["Objetivos", Target],
] as const;
const extraNav = [
  ["Entradas e freelas", TrendingUp],
  ["Gestor", ChartNoAxesCombined],
  ["Contas e cartões", Wallet],
  ["Dívidas", CreditCard],
  ["Recorrências", Repeat],
  ["Calendário", CalendarDays],
  ["Relatórios", ChartNoAxesCombined],
  ["Configurações", SlidersHorizontal],
] as const;
const labels: Record<string, string> = {
  account: "Conta ou cartão",
  budget: "Orçamento",
  purchase: "Compra planejada",
  reserve: "Reserva",
  goal: "Objetivo",
  debt: "Dívida",
  recurring: "Recorrência",
  project: "Projeto",
  category: "Categoria",
};
const id = () => crypto.randomUUID();
const brDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
const monthName = (m: string) =>
  new Date(m + "-02T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
const raw = (n: number) => (n / 100).toFixed(2).replace(".", ",");
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | [string, string])[];
  label: string;
}) {
  return (
    <Select
      value={
        options.some((o) => (typeof o === "string" ? o : o[0]) === value)
          ? value
          : undefined
      }
      onValueChange={onChange}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem
            key={typeof o === "string" ? o : o[0]}
            value={typeof o === "string" ? o : o[0]}
          >
            {typeof o === "string" ? o : o[1]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const fieldId = useId();
  const native =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "textarea"].includes(children.type);
  return (
    <div className="field">
      {native ? <label htmlFor={fieldId}>{label}</label> : <span>{label}</span>}
      {native ? cloneElement(children as any, { id: fieldId }) : children}
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Layers size={25} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <Progress aria-label={label} value={Math.max(0, Math.min(100, value))} />
  );
}
type Change = DemoChange;

export default function Clareza() {
  const [data, setData] = useState<Data>(createDemoData),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("Início"),
    [tab, setTab] = useState("Plano do mês"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [offset, setOffset] = useState(0),
    [modal, setModal] = useState<{
      kind: string;
      item?: Entity | Entry;
    } | null>(null),
    [confirmation, setConfirmation] = useState<{
      title: string;
      description: string;
      run: () => Promise<void>;
    } | null>(null),
    [theme, setTheme] = useState("system"),
    [hidden, setHidden] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [hiddenCards, setHiddenCards] = useState<string[]>([]),
    [customizing, setCustomizing] = useState(false),
    [name] = useState("Marina · personagem fictícia");
  const demo = true;
  const loading = false;
  const saving = useRef(false);
  const [nextEntry, setNextEntry] = useState<string | null>(null);
  function resetDemo() {
    setData(createDemoData());
    setMonth(today().slice(0, 7));
    setError("");
    setModal(null);
    navigate("Início");
    toast.success("Demonstração reiniciada com dados fictícios.");
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    setOffset(0);
  }, [search, filter, month, page]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page, demo]);
  const profile = data.entities.find((e) => e.kind === "profile");
  const displayName = profile?.name || name;
  const s = summary(data, month),
    accounts = data.entities.filter((e) => e.kind === "account"),
    cashAccounts = accounts.filter((a) => a.type !== "credit"),
    allCategories = Array.from(
      new Set([
        ...categories,
        ...data.entities
          .filter((e) => e.kind === "category")
          .map((e) => e.name),
      ]),
    );
  const showMoney = (n: number) => (hidden ? "••••••" : money(n));
  const entityList = (kind: Entity["kind"]) =>
    data.entities.filter((e) => e.kind === kind);
  async function save(change: Change) {
    if (saving.current) throw Error("Aguarde a confirmação anterior.");
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      setData(applyDemoChange(data, change));
      toast.success("Demonstração atualizada nesta sessão.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Confira os campos");
      throw error;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function navigate(p: string) {
    setPage(p);
    setSearch("");
    setFilter("all");
  }
  function open(kind: string, item?: Entity | Entry) {
    const requiresCashAccount = [
      "income",
      "receivable",
      "fixed-income",
      "transfer",
    ].includes(kind);
    if (
      !item &&
      ["entry", "income", "receivable", "fixed-income", "transfer"].includes(
        kind,
      ) &&
      !accounts.some((a) => !requiresCashAccount || a.type !== "credit")
    ) {
      setNextEntry(kind);
      setModal({ kind: "account" });
      return;
    }
    setNextEntry(null);
    setModal({ kind, item });
  }
  function remove(item: Entity | Entry) {
    setConfirmation({
      title: "Excluir este registro?",
      description:
        "A exclusão atualiza os cálculos e não pode ser desfeita. Exporte uma cópia em Configurações se quiser preservá-lo.",
      run: async () => {
        await save({
          action: "delete",
          id: item.id,
          target: "kind" in item ? "entity" : "entry",
        });
        setModal(null);
      },
    });
  }
  function confirmSave(change: Change, title: string, description: string) {
    setConfirmation({
      title,
      description,
      run: async () => {
        await save(change);
      },
    });
  }
  const spending = allCategories
    .map((category) => ({
      category,
      value: s.rows
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === category &&
            t.status === "confirmed",
        )
        .reduce((a, t) => a + t.amount, 0),
    }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  function EntryList({
    rows,
    limit = 20,
    grouped = false,
  }: {
    rows: Entry[];
    limit?: number;
    grouped?: boolean;
  }) {
    return rows.length ? (
      <div className="entries">
        {rows.slice(0, limit).map((t, i) => (
          <Fragment key={t.id}>
            {grouped && (i === 0 || rows[i - 1].date !== t.date) && (
              <h3 className="entry-day">
                {brDate(t.date)}
                <small>
                  {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                  })}
                </small>
              </h3>
            )}
            <button className="entry" onClick={() => open("entry", t)}>
              <span className={"entry-icon " + t.type}>
                {t.type === "income" ? (
                  <ArrowDownRight size={19} />
                ) : t.type === "transfer" ? (
                  <ArrowLeftRight size={19} />
                ) : (
                  <ShoppingBag size={19} />
                )}
              </span>
              <span className="entry-copy">
                <strong>{t.description}</strong>
                <small>
                  {t.category} ·{" "}
                  {accounts.find((a) => a.id === t.account)?.name}{" "}
                  {t.status === "pending" ? "· A confirmar" : ""}
                </small>
              </span>
              <span className="entry-amount">
                <strong className={t.type === "income" ? "positive" : ""}>
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {showMoney(t.amount)}
                </strong>
                <small>{brDate(t.date)}</small>
              </span>
            </button>
          </Fragment>
        ))}
      </div>
    ) : (
      <Empty
        title="Tudo começa com um registro"
        detail="Adicione uma receita ou despesa para acompanhar seu dinheiro."
        action={
          <button className="textbutton" onClick={() => open("register")}>
            Escolher o que registrar <ArrowRight size={16} />
          </button>
        }
      />
    );
  }
  function ListHeading({ title, kind }: { title: string; kind: string }) {
    return (
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="secondary" onClick={() => open(kind)}>
          <Plus size={17} /> Adicionar
        </button>
      </div>
    );
  }
  function PlanCard({ e }: { e: Entity }) {
    const pc = e.amount ? Math.round((e.current / e.amount) * 100) : 0;
    return (
      <section className="panel plan-card">
        <div className="row">
          <span className="tile-icon">
            {e.kind === "goal" ? (
              <Target />
            ) : e.kind === "purchase" ? (
              <ShoppingBag />
            ) : e.kind === "reserve" ? (
              <PiggyBank />
            ) : e.kind === "debt" ? (
              <CreditCard />
            ) : (
              <Layers />
            )}
          </span>
          <button
            className="iconbutton"
            aria-label={"Editar " + e.name}
            onClick={() => open(e.kind, e)}
          >
            <Pencil size={17} />
          </button>
        </div>
        <button
          className="card-summary"
          onClick={() => open(e.kind, e)}
          aria-label={`Abrir ${e.name}`}
        >
          <span>
            <b>{e.name}</b>
            <small>
              {e.date
                ? brDate(e.date) + " de " + e.date.slice(0, 4)
                : "Sem prazo definido"}{" "}
              · {e.priority}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
        <div className="row values">
          <strong>{showMoney(e.current)}</strong>
          <small>de {showMoney(e.amount)}</small>
        </div>
        <Meter value={pc} label={e.name} />
        <div className="row">
          <small>
            {pc}%{" "}
            {e.kind === "debt" ? "do valor original em aberto" : "reservado"}
          </small>
          <small>{e.status}</small>
        </div>
        {["goal", "purchase", "reserve"].includes(e.kind) && (
          <>
            <p>
              Faltam <b>{showMoney(Math.max(0, e.amount - e.current))}</b>
              {e.date && <> · {showMoney(monthlyNeed(e))}/mês</>}
            </p>
            <button
              className="secondary full"
              onClick={() => open("contribution", e)}
            >
              Ajustar valor reservado
            </button>
          </>
        )}
        {e.kind === "debt" && (
          <>
            <p>
              {e.rate}% a.m. · {e.count} parcelas previstas
            </p>
            <button
              className="secondary full"
              onClick={() => open("debt-payment", e)}
            >
              Registrar pagamento
            </button>
          </>
        )}
        {e.kind === "project" && (
          <>
            <p>
              Despesas no intervalo carregado:{" "}
              {showMoney(
                data.entries
                  .filter((t) => t.project === e.id && t.type === "expense")
                  .reduce((s, t) => s + t.amount, 0),
              )}
            </p>
            <button
              className="textbutton"
              onClick={() => {
                navigate("Movimentações");
                setSearch(e.name);
              }}
            >
              Ver movimentações <ArrowRight size={16} />
            </button>
          </>
        )}
      </section>
    );
  }
  const navButtons = (items: readonly (readonly [string, any])[]) =>
    items.map(([n, Icon]) => (
      <SidebarMenuItem key={n}>
        <SidebarMenuButton isActive={page === n} onClick={() => navigate(n)}>
          <Icon />
          <span>{n}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  const modalTitle = (() => {
    if (!modal) return "";
    if (modal.kind === "register") return "Adicionar no Clareza";
    if (modal.kind === "more") return "Mais opções";
    if (modal.kind === "income")
      return modal.item ? "Editar entrada" : "Dinheiro que entrou";
    if (modal.kind === "receivable")
      return modal.item ? "Editar trabalho a receber" : "Novo trabalho a receber";
    if (modal.kind === "entry")
      return modal.item ? "Editar movimentação" : "Gasto ou pagamento";
    if (modal.kind === "transfer") return "Transferência entre contas";
    if (modal.kind === "fixed-income") return "Renda fixa mensal";
    if (modal.kind === "contribution") return "Ajustar reserva";
    if (modal.kind === "debt-payment") return "Pagamento de dívida";
    if (modal.kind === "card-payment") return "Pagamento de fatura";
    return `${modal.item ? "Editar " : "Adicionar "}${labels[modal.kind] || ""}`;
  })();
  const modalDescription = (() => {
    if (!modal) return "";
    if (modal.kind === "register") return "O que você quer informar agora?";
    if (modal.kind === "more")
      return "Acesse as outras áreas da sua organização financeira.";
    if (modal.kind === "income")
      return "Registre um valor que você já recebeu.";
    if (modal.kind === "receivable")
      return "Cadastre o valor total uma vez. Depois, confirme cada pagamento total ou parcial.";
    if (modal.kind === "entry")
      return modal.item
        ? "Confira e atualize as informações deste registro."
        : "Registre uma compra ou conta que já aconteceu.";
    if (modal.kind === "transfer")
      return "Informe de qual conta o dinheiro saiu e em qual conta entrou.";
    if (modal.kind === "fixed-income")
      return "Cadastre uma vez. O Clareza prepara os próximos meses para você.";
    return "Confira as informações e confirme para salvar.";
  })();
  return (
    <SidebarProvider>
      <Toaster richColors position="top-center" />
      <Sidebar>
        <SidebarHeader>
          <button className="brand" onClick={() => navigate("Início")}>
            <span className="brand-mark">
              <Leaf size={22} />
            </span>
            <span>Clareza</span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">PRINCIPAL</p>
          <SidebarMenu>{navButtons(mainNav)}</SidebarMenu>
          <p className="nav-label">MAIS</p>
          <SidebarMenu>{navButtons(extraNav)}</SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <span>
              Dados fictícios nesta aba.
              <small>Sem login, banco ou sincronização.</small>
            </span>
          </div>
          <button className="profile" onClick={() => navigate("Configurações")}>
            <span className="avatar">
              {demo ? "D" : name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {demo ? "Conta demonstração" : displayName}
              <small>{demo ? "Dados fictícios" : "Meu espaço pessoal"}</small>
            </span>
            <SlidersHorizontal size={16} />
          </button>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <span>
            MEU ESPAÇO <span className="topdivider">/</span> <b>{page}</b>
          </span>
          <div className="actions">
            <AlertBell data={data} demo={demo} navigate={navigate} />
            <button
              className="iconbutton"
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <button
              className="iconbutton"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="avatar small-avatar">
              {demo ? "D" : name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        {demo && (
          <div className="demo-bar">
            <span>
              <b>Modo demonstração</b> · Apenas dados fictícios. Alterações temporárias neste navegador.
            </span>
            <button
              onClick={() => {
                setConfirmation({ title: "Reiniciar demonstração?", description: "Suas alterações fictícias serão substituídas pelo cenário inicial.", run: async () => resetDemo() });
              }}
            >
              Reiniciar demonstração <RefreshCw size={14} />
            </button>
          </div>
        )}
        <div
          className={"pageheading " + (page === "Início" ? "home-heading" : "")}
        >
          <div>
            {page === "Início" && (
              <p className="eyebrow">MAIS TRANQUILIDADE, UM DIA DE CADA VEZ</p>
            )}
            <h1>
              {page === "Início"
                ? "Olá, " +
                  (demo ? "vamos explorar" : displayName.split(" ")[0]) +
                  "."
                : page}
            </h1>
            <p>
              {(
                {
                  Início: "Entenda onde você está. Escolha seu próximo passo.",
                  Movimentações: "Cada registro ajuda a enxergar melhor.",
                  Planejar: "Dê um destino ao dinheiro antes de gastar.",
                  Objetivos: "Transforme seus planos em próximos passos.",
                  "Contas e cartões":
                    "Organize o dinheiro e os compromissos, do seu jeito.",
                  Dívidas:
                    "Veja o que está em aberto e acompanhe cada pagamento.",
                  Recorrências: "Suas contas de sempre, sem esquecer nenhuma.",
                  Calendário: "O que já aconteceu e o que está chegando.",
                  Relatórios: "Encontre respostas nos seus próprios registros.",
                  Configurações:
                    "Suas preferências e seus dados, sob seu controle.",
                } as Record<string, string>
              )[page] || ""}
            </p>
          </div>
          <button className="primary" onClick={() => open("register")}>
            <Plus size={18} /> Registrar
          </button>
        </div>
        {loading && !demo ? (
          <div className="empty" role="status">
            Carregando seus dados…
          </div>
        ) : (
          <>
            {page !== "Configurações" && (
              <div className="period-row">
                <div className="period">
                  <button
                    className="iconbutton"
                    aria-label="Mês anterior"
                    onClick={() =>
                      setMonth(addMonths(month + "-01", -1).slice(0, 7))
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <input
                    aria-label="Período"
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                  />
                  <button
                    className="iconbutton"
                    aria-label="Próximo mês"
                    onClick={() =>
                      setMonth(addMonths(month + "-01", 1).slice(0, 7))
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                {page === "Início" && (
                  <button
                    className="textbutton"
                    onClick={() => setCustomizing(!customizing)}
                  >
                    <SlidersHorizontal size={16} /> Personalizar
                  </button>
                )}
              </div>
            )}
            {customizing && page === "Início" && (
              <div className="panel customize">
                <p>Escolha os resumos que deseja ver.</p>
                {["Saldo", "Receitas", "Despesas", "Disponível"].map((c) => (
                  <button
                    key={c}
                    className={
                      hiddenCards.includes(c) ? "secondary" : "primary"
                    }
                    onClick={() => {
                      const n = hiddenCards.includes(c)
                        ? hiddenCards.filter((x) => x !== c)
                        : [...hiddenCards, c];
                      setHiddenCards(n);
                    }}
                  >
                    {!hiddenCards.includes(c) && <Check size={14} />} {c}
                  </button>
                ))}
              </div>
            )}
            {page === "Início" && (
              <HomeDashboard
                data={data}
                month={month}
                hidden={hidden}
                toggleHidden={() => setHidden(!hidden)}
                hiddenCards={hiddenCards}
                money={showMoney}
                open={open}
                navigate={navigate}
                plan={(t) => {
                  navigate("Planejar");
                  setTab(t);
                }}
                entries={(rows) => <EntryList rows={rows} />}
              />
            )}
            {page === "Entradas e freelas" && (
              <IncomeHub
                hidden={hidden}
                data={data}
                month={month}
                open={open}
                onSave={save}
              />
            )}
            {page === "Gestor" && (
              <FinancialGuide
                hidden={hidden}
                data={data}
                month={month}
                navigate={navigate}
              />
            )}
            {page === "Movimentações" && (
              <section className="panel">
                <div className="filters">
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label="Buscar movimentações"
                      placeholder="Descrição, categoria, tag ou projeto…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <Choice
                    label="Tipo"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      "all",
                      "expense",
                      "income",
                      "transfer",
                      "pending",
                    ].map((x, i) => [
                      x,
                      [
                        "Todos os tipos",
                        "Despesas",
                        "Receitas",
                        "Transferências",
                        "Pendentes",
                      ][i],
                    ])}
                  />
                </div>
                <EntryList
                  grouped
                  rows={[...s.rows]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .filter(
                      (t) =>
                        (filter === "all" ||
                          (filter === "pending" && t.status === "pending") ||
                          t.type === filter) &&
                        `${t.description} ${t.category} ${t.tags} ${data.entities.find((e) => e.id === t.project)?.name || ""}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .slice(offset)}
                  limit={20}
                />
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 20))}
                  >
                    Anterior
                  </button>
                  <span>Página {offset / 20 + 1}</span>
                  <button
                    className="secondary"
                    disabled={
                      s.rows.filter(
                        (t) =>
                          (filter === "all" ||
                            (filter === "pending" && t.status === "pending") ||
                            t.type === filter) &&
                          `${t.description} ${t.category} ${t.tags} ${data.entities.find((e) => e.id === t.project)?.name || ""}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      ).length <=
                      offset + 20
                    }
                    onClick={() => setOffset(offset + 20)}
                  >
                    Próxima
                  </button>
                </div>
              </section>
            )}
            {page === "Planejar" && (
              <>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="plan-tabs">
                    {[
                      "Plano do mês",
                      "Compras",
                      "Reservas",
                      "Próximos meses",
                      "Simular",
                      ...(advanced ? ["Projetos"] : []),
                    ].map((t) => (
                      <TabsTrigger key={t} value={t}>
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {tab === "Simular" && (
                  <PlanningTools
                    hidden={hidden}
                    data={data}
                    month={month}
                    onSave={save}
                  />
                )}{" "}
                {tab === "Plano do mês" && (
                  <MonthlyPlan
                    data={data}
                    month={month}
                    hidden={hidden}
                    open={open}
                    navigate={navigate}
                  />
                )}
                {["Compras", "Reservas", "Projetos"].includes(tab) && (
                  <>
                    <ListHeading
                      title={tab === "Compras" ? "Compras planejadas" : tab}
                      kind={
                        {
                          Compras: "purchase",
                          Reservas: "reserve",
                          Projetos: "project",
                        }[tab]!
                      }
                    />
                    <div className="grid-cards">
                      {entityList(
                        (
                          {
                            Compras: "purchase",
                            Reservas: "reserve",
                            Projetos: "project",
                          } as const
                        )[tab as "Compras"],
                      ).map((e) => (
                        <PlanCard key={e.id} e={e} />
                      ))}
                    </div>
                    {!entityList(
                      (
                        {
                          Compras: "purchase",
                          Reservas: "reserve",
                          Projetos: "project",
                        } as const
                      )[tab as "Compras"],
                    ).length && (
                      <Empty
                        title="Espaço para seus próximos planos"
                        detail="Adicione um valor e, se quiser, um prazo para começar."
                      />
                    )}
                    {tab === "Reservas" && (
                      <p className="footnote">
                        Reservas, objetivos e compras são alocações separadas.
                        Não registre o mesmo dinheiro em mais de uma delas.
                      </p>
                    )}
                  </>
                )}
                {tab === "Próximos meses" && (
                  <>
                    <div className="notice">
                      Previsão com base nos lançamentos registrados. Receitas
                      ainda não informadas não entram no cálculo.
                    </div>
                    <div className="grid-cards">
                      {Array.from({ length: 4 }, (_, i) => {
                        const m = addMonths(month + "-01", i).slice(0, 7),
                          rows = data.entries.filter((t) =>
                            t.date.startsWith(m),
                          );
                        const incoming = rows
                            .filter((t) => t.type === "income")
                            .reduce((s, t) => s + t.amount, 0),
                          out = rows
                            .filter((t) => t.type === "expense")
                            .reduce((s, t) => s + t.amount, 0);
                        return (
                          <section className="panel forecast" key={m}>
                            <p className="eyebrow">
                              {i ? "PREVISÃO" : "MÊS SELECIONADO"}
                            </p>
                            <h3>{monthName(m)}</h3>
                            <div className="row">
                              <span>Entradas registradas</span>
                              <b>{showMoney(incoming)}</b>
                            </div>
                            <div className="row">
                              <span>Despesas e parcelas</span>
                              <b>{showMoney(out)}</b>
                            </div>
                            <div className="row total">
                              <span>Resultado previsto</span>
                              <b>{showMoney(incoming - out)}</b>
                            </div>
                            <small>
                              Os recorrentes entram automaticamente quando cada
                              mês começa. Compras futuras aparecem depois do
                              registro.
                            </small>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            {page === "Objetivos" && (
              <>
                <ListHeading title="O que você quer conquistar?" kind="goal" />
                <div className="grid-cards">
                  {entityList("goal").map((e) => (
                    <PlanCard key={e.id} e={e} />
                  ))}
                </div>
                {!entityList("goal").length && (
                  <Empty
                    title="Um plano torna o sonho mais perto"
                    detail="Defina seu objetivo, o valor e quando gostaria de chegar lá."
                  />
                )}
              </>
            )}
            {page === "Contas e cartões" && (
              <>
                <ListHeading
                  title="Seu dinheiro e seus cartões"
                  kind="account"
                />
                <div className="grid-cards">
                  {accounts.map((a) => {
                    const b = balance(data, a.id),
                      credit = a.type === "credit";
                    const billed = s.rows
                      .filter((t) => t.account === a.id && t.type === "expense")
                      .reduce((v, t) => v + t.amount, 0);
                    const paid = data.entries
                      .filter(
                        (t) =>
                          t.destination === a.id &&
                          t.group === "statement:" + a.id + ":" + month,
                      )
                      .reduce((v, t) => v + t.amount, 0);
                    return (
                      <section
                        className={
                          "panel account-card " + (credit ? "credit-card" : "")
                        }
                        key={a.id}
                      >
                        <div className="row">
                          <span className="tile-icon">
                            {credit ? <CreditCard /> : <Wallet />}
                          </span>
                          <button
                            className="iconbutton"
                            aria-label={"Editar " + a.name}
                            onClick={() => open("account", a)}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                        <button
                          className="card-summary"
                          onClick={() => open("account", a)}
                          aria-label={`Abrir ${a.name}`}
                        >
                          <span>
                            <b>{a.name}</b>
                            <small>Ver e editar detalhes</small>
                          </span>
                          <ChevronRight size={18} />
                        </button>
                        <p>
                          {credit
                            ? "Total devedor, incluindo parcelas futuras"
                            : "Saldo atual"}
                        </p>
                        <h2>{showMoney(credit ? Math.max(0, -b) : b)}</h2>
                        {credit ? (
                          <>
                            <Meter
                              value={
                                a.amount
                                  ? (Math.max(0, -b) / a.amount) * 100
                                  : 0
                              }
                              label="Limite utilizado"
                            />
                            <div className="row">
                              <small>Limite livre</small>
                              <b>{showMoney(a.amount - Math.max(0, -b))}</b>
                            </div>
                            <div className="row">
                              <small>Fecha dia {a.closing}</small>
                              <small>Vence dia {a.due}</small>
                            </div>
                            <div className="invoice">
                              <span>Fatura de {monthName(month)}</span>
                              <strong>
                                {showMoney(Math.max(0, billed - paid))}
                              </strong>
                            </div>
                            <button
                              className="secondary full"
                              onClick={() => open("card-payment", a)}
                            >
                              Registrar pagamento de fatura
                            </button>
                          </>
                        ) : (
                          <small>
                            {a.type === "cash"
                              ? "Dinheiro em espécie"
                              : "Conta manual"}{" "}
                            · Sem vínculo bancário
                          </small>
                        )}
                      </section>
                    );
                  })}
                </div>
                {!accounts.length && (
                  <Empty
                    title="Comece com uma conta"
                    detail="Pode ser sua carteira, dinheiro em espécie ou a conta que você usa no dia a dia."
                  />
                )}
              </>
            )}
            {page === "Dívidas" && (
              <>
                <div className="stats">
                  <section className="panel balance">
                    <span>Saldo de dívidas</span>
                    <h2>{showMoney(s.debts)}</h2>
                    <small>Cartões aparecem separadamente</small>
                  </section>
                  <section className="panel">
                    <span>Saldo devedor dos cartões</span>
                    <h2>{showMoney(s.cards)}</h2>
                  </section>
                  <section className="panel">
                    <span>Dívidas cadastradas</span>
                    <h2>{entityList("debt").length}</h2>
                  </section>
                </div>
                <ListHeading title="Um compromisso de cada vez" kind="debt" />
                <div className="grid-cards">
                  {entityList("debt").map((e) => (
                    <PlanCard key={e.id} e={e} />
                  ))}
                </div>
                {!entityList("debt").length && (
                  <Empty
                    title="Nenhuma dívida cadastrada"
                    detail="Você pode acompanhar apenas as dívidas que desejar."
                  />
                )}
              </>
            )}
            {page === "Recorrências" && (
              <>
                <ListHeading
                  title="Assinaturas e contas recorrentes"
                  kind="recurring"
                />
                <div className="notice">
                  Com valor, conta e vencimento preenchidos, cada recorrência
                  aparece automaticamente como pendente no mês certo. Seu saldo
                  só muda quando você confirma que recebeu ou pagou.
                </div>
                <div className="grid-cards">
                  {entityList("recurring").map((e) => {
                    const expectedDate = e.date
                      ? recurringDateForMonth(e.date, month)
                      : "";
                    const monthlyEntry = data.entries.find(
                      (entry) =>
                        entry.id === `rec:${e.id}:${month}` ||
                        (!!expectedDate &&
                          entry.date.startsWith(month) &&
                          entry.amount === e.amount &&
                          entry.account === e.account &&
                          entry.type ===
                            (e.type === "income" ? "income" : "expense") &&
                          entry.description.trim().toLocaleLowerCase("pt-BR") ===
                            e.name.trim().toLocaleLowerCase("pt-BR")),
                    );
                    const complete = !!(e.amount && e.date && e.account);
                    const active = e.status !== "Inativo";
                    const dueThisMonth =
                      active &&
                      complete &&
                      expectedDate >= e.date! &&
                      (e.period !== "Anual" ||
                        e.date!.slice(5, 7) === month.slice(5, 7));
                    return (
                      <section className="panel plan-card" key={e.id}>
                      <div className="row">
                        <span className="tile-icon">
                          <Repeat />
                        </span>
                        <button
                          className="iconbutton"
                          aria-label={"Editar " + e.name}
                          onClick={() => open("recurring", e)}
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <button
                        className="card-summary"
                        onClick={() => open("recurring", e)}
                        aria-label={`Abrir ${e.name}`}
                      >
                        <span>
                          <b>{e.name}</b>
                          <small>Ver e editar automação</small>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                      <h2>{e.amount ? showMoney(e.amount) : "Valor a definir"}</h2>
                      <p>
                        {e.period} · {e.category}
                      </p>
                      <small>
                        Início em{" "}
                        {e.date ? brDate(e.date) : "data não definida"}
                      </small>
                      <button
                        className="secondary full"
                        onClick={() => {
                          if (!complete) {
                            open("recurring", e);
                            return;
                          }
                          if (!active) return;
                          if (!monthlyEntry) {
                            toast.info("Preencha a recorrência com conta, valor e data para gerar uma pendência local.");
                            return;
                          }
                          if (monthlyEntry.status === "confirmed") {
                            toast.info(
                              e.type === "income"
                                ? "Entrada já confirmada neste mês."
                                : "Pagamento já confirmado neste mês.",
                            );
                            return;
                          }
                          if (monthlyEntry.type === "income")
                            navigate("Entradas e freelas");
                          else open("entry", monthlyEntry);
                        }}
                        disabled={
                          complete &&
                          (!active ||
                            !dueThisMonth ||
                            (demo && !monthlyEntry) ||
                            (!monthlyEntry && month !== today().slice(0, 7)))
                        }
                      >
                        {!complete
                          ? "Completar dados"
                          : !active
                            ? "Automação pausada"
                          : !dueThisMonth
                            ? "Fora deste mês"
                            : !monthlyEntry
                              ? demo
                                ? "Automação ativa"
                                : month === today().slice(0, 7)
                                ? "Preparar agora"
                                : "Automático no mês correto"
                              : monthlyEntry.status === "confirmed"
                                ? e.type === "income"
                                  ? "Recebido neste mês"
                                  : "Pago neste mês"
                                : e.type === "income"
                                  ? "Confirmar recebimento"
                                  : "Confirmar pagamento"}
                      </button>
                      </section>
                    );
                  })}
                </div>
                {!entityList("recurring").length && (
                  <Empty
                    title="Deixe suas contas à vista"
                    detail="Cadastre assinaturas, aluguel, salários ou outras recorrências."
                  />
                )}
              </>
            )}
            {page === "Calendário" && (
              <section className="panel">
                <div className="section-heading">
                  <h3>Agenda de {monthName(month)}</h3>
                  <span className="badge">{s.rows.length} movimentações</span>
                </div>
                {Array.from(new Set(s.rows.map((t) => t.date)))
                  .sort()
                  .map((d) => (
                    <section className="agenda-day" key={d}>
                      <h3>
                        {brDate(d)}{" "}
                        <small>
                          {new Date(d + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                            { weekday: "long" },
                          )}
                        </small>
                      </h3>
                      <EntryList
                        rows={s.rows.filter((t) => t.date === d)}
                        limit={1000}
                      />
                    </section>
                  ))}
                {!s.rows.length && (
                  <Empty
                    title="Sua agenda está livre"
                    detail="Movimentações e parcelas aparecem aqui nas datas registradas."
                  />
                )}
              </section>
            )}
            {page === "Relatórios" && (
              <div className="dashboard-grid">
                <section className="panel">
                  <h3>Resumo financeiro pessoal</h3>
                  {[
                    ["Receitas confirmadas", s.income],
                    ["Despesas e parcelas", -s.expense],
                    ["Resultado do mês", s.income - s.expense],
                    ["Saldo nas contas hoje", s.cash],
                    ["Reservas, objetivos e compras", -s.reserved],
                    ["Total devedor dos cartões", -s.cards],
                    ["Livre após reservas e cartões", s.free],
                  ].map(([l, v]) => (
                    <div className="report-row" key={String(l)}>
                      <span>{l}</span>
                      <strong>{showMoney(Number(v))}</strong>
                    </div>
                  ))}
                  <p className="footnote">
                    Dívidas não pagas: {showMoney(s.debts)}. O valor livre não
                    desconta essas dívidas nem pagamentos pendentes. Resultado
                    mensal e saldo atual são medidas diferentes.
                  </p>
                </section>
                <section className="panel">
                  <h3>Despesas por categoria</h3>
                  {spending.map((c) => (
                    <button
                      key={c.category}
                      className="report-row full"
                      onClick={() => {
                        navigate("Movimentações");
                        setSearch(c.category);
                      }}
                    >
                      <span>{c.category}</span>
                      <b>{showMoney(c.value)}</b>
                    </button>
                  ))}
                  {!spending.length && (
                    <p className="empty-small">
                      Sem despesas confirmadas neste mês.
                    </p>
                  )}
                </section>
              </div>
            )}
            {page === "Configurações" && (
              <div className="settings-grid">
                <PersonalProfile
                  key={String(demo)}
                  data={data}
                  busy={busy}
                  onSave={save}
                  open={open}
                />
                <PrivacyCenter demo={demo} />
                <section className="panel">
                  <h3>Seu jeito de organizar</h3>
                  <Field label="Aparência">
                    <Choice
                      label="Aparência"
                      value={theme}
                      onChange={setTheme}
                      options={[
                        ["system", "Preferência do sistema"],
                        ["light", "Claro"],
                        ["dark", "Escuro"],
                      ]}
                    />
                  </Field>
                  <Field label="Nível de detalhes">
                    <Choice
                      label="Nível de detalhes"
                      value={advanced ? "advanced" : "simple"}
                      onChange={(v) => {
                        setAdvanced(v === "advanced");
                      }}
                      options={[
                        ["simple", "Simples"],
                        ["advanced", "Avançado · inclui projetos e tags"],
                      ]}
                    />
                  </Field>
                  <div className="section-heading">
                    <h3>Categorias</h3>
                    <button
                      className="textbutton"
                      onClick={() => open("category")}
                    >
                      <Plus size={16} /> Criar
                    </button>
                  </div>
                  <div className="chips">
                    {allCategories.map((c) => (
                      <span key={c} className="badge">
                        {c}
                      </span>
                    ))}
                  </div>
                  <h3 className="spaced">Demonstração</h3>
                  <p>Dados fictícios, separados das suas informações.</p>
                  <button
                    className="secondary"
                    onClick={() => {
                      resetDemo();
                    }}
                  >
                    Recarregar cenário fictício
                  </button>
                </section>
                <section className="panel">
                  <h3>Importação e backup</h3>
                  <p className="spaced">
                    Os registros existem somente na memória desta aba. Recarregar a página restaura os exemplos fictícios. Não informe dados pessoais.
                  </p>
                  <ImportExport
                    data={data}
                    demo={demo}
                    month={month}
                    onSave={save}
                  />
                  <div className="privacy-note">
                    <ShieldCheck />
                    <span>
                      Sem conta, login ou conexão com serviços financeiros.
                      <small>Use apenas informações fictícias para experimentar.</small>
                    </span>
                  </div>
                  <button
                    className="danger"
                    onClick={() =>
                      setConfirmation({
                        title: demo
                          ? "Limpar demonstração?"
                          : "Excluir todos os dados financeiros?",
                        description:
                          "Limpa somente esta sessão fictícia. Use Reiniciar demonstração para recuperar os exemplos.",
                        run: async () => {
                          await save({ action: "erase" });
                          navigate("Início");
                        },
                      })
                    }
                  >
                    <Trash2 size={16} /> Limpar cenário fictício
                  </button>

                </section>
              </div>
            )}
          </>
        )}
        <footer className="app-footer">
          <ShieldCheck size={14} />{" "}
          {demo
            ? "Demonstração local · dados fictícios · recarregar reinicia a sessão"
            : "Dados fictícios e temporários nesta aba."}
        </footer>
      </main>
      <nav className="mobile-nav">
        {mainNav
          .filter(([n]) => n !== "Objetivos")
          .map(([n, Icon]) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => navigate(n)}
            >
              <Icon size={21} />
              <span>{n === "Movimentações" ? "Registros" : n}</span>
            </button>
          ))}
        <button
          className="mobile-add"
          aria-label="Escolher o que registrar"
          onClick={() => open("register")}
        >
          <Plus size={23} />
          <span>Registrar</span>
        </button>
        <button
          className={extraNav.some(([n]) => n === page) ? "active" : ""}
          onClick={() => open("more")}
        >
          <Ellipsis size={22} />
          <span>Mais</span>
        </button>
      </nav>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent className="finance-dialog">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>{modalDescription}</DialogDescription>
          </DialogHeader>
          {modal?.kind === "register" ? (
            <div className="register-menu">
              <p className="register-group-label">DINHEIRO DO DIA A DIA</p>
              <div className="register-primary-grid">
                <button onClick={() => open("income")}>
                  <span className="tile-icon">
                    <ArrowDownRight size={21} />
                  </span>
                  <span>
                    <b>Recebi dinheiro</b>
                    <small>Salário, freela, venda ou outra entrada</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => open("entry")}>
                  <span className="tile-icon expense-tone">
                    <ShoppingBag size={21} />
                  </span>
                  <span>
                    <b>Fiz um gasto</b>
                    <small>Compra, boleto ou conta que já aconteceu</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => open("receivable")}>
                  <span className="tile-icon orange">
                    <TrendingUp size={21} />
                  </span>
                  <span>
                    <b>Trabalho a receber</b>
                    <small>Cadastre o total e receba de uma vez ou em partes</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              </div>
              <p className="register-group-label">DEIXAR ORGANIZADO</p>
              <div className="register-secondary-grid">
                <button onClick={() => open("fixed-income")}>
                  <Repeat size={20} />
                  <span>
                    <b>Renda fixa mensal</b>
                    <small>Cadastre uma vez e repita automaticamente</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={() => open("recurring")}>
                  <CalendarDays size={20} />
                  <span>
                    <b>Conta fixa ou assinatura</b>
                    <small>Aluguel, internet, terapia e outros</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={() => open("transfer")}>
                  <ArrowLeftRight size={20} />
                  <span>
                    <b>Transferência entre contas</b>
                    <small>Movimente sem criar receita ou despesa</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          ) : modal?.kind === "more" ? (
            <div className="more-menu">
              {[mainNav[3], ...extraNav].map(([n, Icon]) => (
                <button
                  className="secondary"
                  key={n}
                  onClick={() => {
                    navigate(n);
                    setModal(null);
                  }}
                >
                  <Icon size={20} />
                  {n}
                </button>
              ))}
            </div>
          ) : (
            modal && (
              <>
                {nextEntry && (
                  <div className="notice">
                    Para registrar, cadastre primeiro uma conta ou carteira.
                    Depois continuamos sua movimentação.
                  </div>
                )}
                <Editor
                  key={modal.kind + (modal.item?.id || "new")}
                  kind={modal.kind}
                  item={modal.item}
                  data={data}
                  month={month}
                  advanced={advanced}
                  categories={allCategories}
                  busy={busy}
                  onSave={async (c) => {
                    await save(c);
                    if (
                      nextEntry &&
                      c.entities?.some(
                        (e) => e.kind === "account" && e.type !== "credit",
                      )
                    ) {
                      setModal({ kind: nextEntry });
                      setNextEntry(null);
                    } else setModal(null);
                  }}
                  onDelete={remove}
                />
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(v) => !v && !busy && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await confirmation?.run();
                  setConfirmation(null);
                } catch {}
              }}
            >
              {busy ? "Salvando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
function Editor({
  kind: requestedKind,
  item,
  data,
  month,
  advanced,
  categories,
  busy,
  onSave,
  onDelete,
}: {
  kind: string;
  item?: Entity | Entry;
  data: Data;
  month: string;
  advanced: boolean;
  categories: string[];
  busy: boolean;
  onSave: (c: Change) => Promise<void>;
  onDelete: (i: Entity | Entry) => void;
}) {
  const isIncome = ["income", "receivable"].includes(requestedKind);
  const isFixedIncome = requestedKind === "fixed-income";
  const isTransfer = requestedKind === "transfer";
  const kind =
    isIncome || isTransfer
      ? "entry"
      : isFixedIncome
        ? "recurring"
        : requestedKind;
  const entity = item && "kind" in item ? item : undefined,
    entry = item && "description" in item ? item : undefined;
  const accounts = data.entities.filter((e) => e.kind === "account"),
    cash = accounts.filter((a) => a.type !== "credit");
  const profile = data.entities.find((e) => e.kind === "profile");
  const [form, setForm] = useState<Record<string, string>>(() => ({
    name: entity?.name || entry?.description || "",
    amount: raw(
      kind === "debt-payment" && entity
        ? Math.ceil(entity.current / entity.count)
        : kind === "card-payment" && entity
          ? Math.max(
              0,
              data.entries
                .filter(
                  (t) =>
                    t.account === entity.id &&
                    t.type === "expense" &&
                    t.date.startsWith(month),
                )
                .reduce((v, t) => v + t.amount, 0) -
                data.entries
                  .filter(
                    (t) =>
                      t.destination === entity.id &&
                      t.group === "statement:" + entity.id + ":" + month,
                  )
                  .reduce((v, t) => v + t.amount, 0),
            )
          : entity?.amount || entry?.amount || 0,
    ),
    current: raw(entity?.current || 0),
    date: specialDate(kind, item, month),
    expectedDate: entry?.expectedDate || "",
    account:
      item?.account ||
      profile?.defaultAccount ||
      cash[0]?.id ||
      (kind === "recurring" ? "none" : accounts[0]?.id || ""),
    destination: entry?.destination || accounts[1]?.id || "",
    category:
      item?.category || (isIncome || isFixedIncome ? "Trabalho" : "Outros"),
    type:
      item?.type ||
      (isIncome || isFixedIncome
        ? "income"
        : isTransfer
          ? "transfer"
          : kind === "account"
            ? "checking"
            : "expense"),
    notes: item?.notes || "",
    count: String(entity?.count || 1),
    closing: String(entity?.closing || 5),
    due: String(entity?.due || 12),
    rate: String(entity?.rate || 0),
    priority: entity?.priority || "Média",
    status:
      entry?.status ||
      entity?.status ||
      (requestedKind === "receivable"
        ? "pending"
        : kind === "entry"
          ? "confirmed"
          : "Ativo"),
    period: entity?.period || "Mensal",
    expenseClass: entity?.expenseClass || "fixed",
    project: item?.project || "none",
    tags: entry?.tags || "",
    url: entity?.url || "",
    incomeSource:
      entry?.incomeSource ||
      (isFixedIncome || profile?.incomeMode === "fixed"
        ? "salary"
        : "freelance"),
    payer: entry?.payer || "",
    origin: entry?.origin || "manual",
    repeatIncome: "no",
  }));
  const [details, setDetails] = useState(!!item),
    [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const input = (k: string, type = "text", required = false) => (
    <input
      type={type}
      value={form[k] || ""}
      required={required}
      maxLength={type === "text" ? 200 : undefined}
      onChange={(e) => set(k, e.target.value)}
    />
  );
  const moneyInput = (k: string, required = true) => (
    <div className="money-input">
      <span>R$</span>
      <input
        aria-label={
          k === "amount"
            ? requestedKind === "receivable"
              ? entry
                ? "Saldo ainda a receber"
                : "Valor total do trabalho"
              : "Valor"
            : "Valor atual"
        }
        inputMode="decimal"
        value={form[k]}
        onFocus={(e) => {
          if (e.target.value === "0,00") set(k, "");
        }}
        onChange={(e) => set(k, e.target.value)}
        required={required}
      />
    </div>
  );
  const choice = (
    k: string,
    options: (string | [string, string])[],
    label: string,
  ) => (
    <Choice
      label={label}
      value={form[k]}
      onChange={(v) => set(k, v)}
      options={options}
    />
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (
        ["contribution", "debt-payment", "card-payment"].includes(kind) &&
        entity
      ) {
        const amount = toCents(form.amount);
        if (kind === "contribution") {
          const current = toCents(form.current);
          await onSave({ entities: [{ ...entity, current }] });
          return;
        }
        if (amount <= 0) throw Error("Informe um valor maior que zero");
        if (!cash.some((a) => a.id === form.account))
          throw Error("Selecione a conta de pagamento");
        if (
          kind === "card-payment" &&
          amount > Math.max(0, -balance(data, entity.id))
        )
          throw Error("O pagamento supera o saldo devedor do cartão");
        if (kind === "debt-payment" && amount > entity.current)
          throw Error("O pagamento não pode superar o saldo da dívida");
        const t = entrySchema.parse({
          id: id(),
          description:
            (kind === "debt-payment" ? "Pagamento · " : "Fatura · ") +
            entity.name,
          amount,
          date: form.date,
          account: form.account,
          type: kind === "debt-payment" ? "expense" : "transfer",
          destination: kind === "card-payment" ? entity.id : "",
          category: "Dívidas",
          group:
            kind === "card-payment"
              ? "statement:" + entity.id + ":" + month
              : "",
          debt: kind === "debt-payment" ? entity.id : "",
          notes: form.notes,
        });
        await onSave({
          entries: [t],
          entities:
            kind === "debt-payment"
              ? [{ ...entity, current: entity.current - amount }]
              : [],
        });
        return;
      }
      if (kind === "entry") {
        const amount = toCents(form.amount),
          n = entry ? 1 : Number(form.count);
        const account = accounts.find((a) => a.id === form.account);
        if (!account) throw Error("Crie ou selecione uma conta primeiro");
        if (n > 1 && form.type !== "expense")
          throw Error("Parcelamento disponível apenas para despesas");
        if (entry?.debt || entry?.receivable)
          throw Error(
            "Para corrigir este registro vinculado, exclua-o e confirme novamente na dívida ou entrada pendente.",
          );
        const amounts = split(amount, n);
        const group = entry?.group || (n > 1 ? id() : "");
        const first =
          account.type === "credit" && form.type === "expense" && !entry
            ? invoiceDate(form.date, account)
            : form.date;
        const rows = amounts.map((value, i) =>
          entrySchema.parse({
            ...entry,
            id: entry?.id || id(),
            description: form.name + (n > 1 ? ` · ${i + 1}/${n}` : ""),
            amount: value,
            date: addMonths(first, i),
            account: form.account,
            type: form.type,
            destination: form.type === "transfer" ? form.destination : "",
            category: form.category,
            status: form.status === "pending" ? "pending" : "confirmed",
            notes: form.notes,
            tags: form.tags,
            incomeSource: form.incomeSource,
            payer: form.payer,
            expectedDate: form.expectedDate || undefined,
            expectedTotal:
              entry?.expectedTotal ||
              (form.type === "income" && form.status === "pending"
                ? amount
                : 0),
            origin: form.origin,
            project: form.project === "none" ? "" : form.project,
            group,
            part: entry?.part || i + 1,
            totalParts: entry?.totalParts || n,
          }),
        );
        validateLinks(rows, data.entities);
        if (
          form.type === "income" &&
          form.status === "confirmed" &&
          form.date > today()
        )
          throw Error("Uma entrada futura deve ficar como A receber.");
        const entities: Entity[] = [];
        if (form.type === "income" && form.repeatIncome === "yes" && !entry) {
          entities.push(
            entitySchema.parse({
              id: id(),
              kind: "recurring",
              name: form.name,
              amount,
              account: form.account,
              date: addMonths(form.date, 1),
              category: "Trabalho",
              type: "income",
              period: "Mensal",
            }),
          );
        }
        await onSave({ entries: rows, entities });
        return;
      }
      const e = entitySchema.parse({
        ...entity,
        id: entity?.id || id(),
        kind,
        name: form.name,
        amount: toCents(form.amount || "0"),
        current: toCents(form.current || "0"),
        date: form.date || undefined,
        account: ["reserve", "recurring"].includes(kind)
          ? form.account && form.account !== "none"
            ? form.account
            : undefined
          : undefined,
        category: form.category,
        type: form.type,
        notes: form.notes,
        count: Number(form.count),
        closing: Number(form.closing),
        due: Number(form.due),
        rate: Number(form.rate),
        priority: form.priority,
        status: form.status,
        period: form.period,
        expenseClass: form.expenseClass,
        project: form.project === "none" ? "" : form.project,
        url: form.url,
      });
      if (kind === "debt" && e.current > e.amount)
        throw Error("O saldo deve ser menor ou igual ao valor original");
      await onSave({ entities: [e] });
    } catch (e) {
      setError(
        e instanceof Error
          ? (e as any).issues?.[0]?.message || e.message
          : "Confira os campos",
      );
    }
  }
  const needsMoney = !["category"].includes(kind);
  const special = ["contribution", "debt-payment", "card-payment"].includes(
    kind,
  );
  return (
    <form onSubmit={submit} className="editor">
      {kind === "entry" && !entry && (
        <SmartEntryCapture
          accounts={accounts}
          categories={categories}
          onApply={(fields) => {
            setForm((current) => {
              const next = { ...current };
              for (const [key, value] of Object.entries(fields)) {
                if (value) next[key] = value;
              }
              return next;
            });
          }}
        />
      )}
      {kind === "entry" && (
        <Tabs value={form.type} onValueChange={(v) => set("type", v)}>
          <TabsList className="full">
            <TabsTrigger value="expense">Gastei</TabsTrigger>
            <TabsTrigger value="income">Entrada</TabsTrigger>
            <TabsTrigger value="transfer">Transferência</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {special && <h3>{entity?.name}</h3>}
      {needsMoney &&
        kind !== "contribution" &&
        (kind !== "account" || form.type === "credit") && (
        <Field
          label={
            kind === "account"
              ? "Limite do cartão"
              : requestedKind === "receivable"
                ? entry
                  ? "Saldo ainda a receber"
                  : "Valor total do trabalho"
              : kind === "debt"
                ? "Valor original"
                : kind === "budget"
                  ? "Limite mensal"
                  : kind === "goal" || kind === "reserve"
                    ? "Valor alvo"
                      : kind === "purchase"
                        ? "Preço da compra"
                        : kind === "recurring"
                          ? form.type === "income"
                            ? "Valor mensal previsto"
                            : "Valor mensal estimado"
                      : "Valor"
          }
        >
          {moneyInput("amount", kind !== "recurring")}
        </Field>
      )}
      {!special && (
        <Field
          label={
            kind === "entry"
              ? requestedKind === "receivable"
                ? "Trabalho ou serviço"
                : "Descrição"
              : kind === "recurring" && form.type === "income"
                ? "Nome da renda"
                : "Nome"
          }
        >
          {input("name", "text", true)}
        </Field>
      )}
      {kind === "entry" && (
        <>
          {form.type === "income" && (
            <>
              <Field label="De onde vem esta entrada?">
                {choice(
                  "incomeSource",
                  [
                    ["salary", "Salário fixo"],
                    ["freelance", "Freela / serviço"],
                    ["sales", "Vendas / comissões"],
                    ["other", "Outra entrada"],
                  ],
                  "Origem da entrada",
                )}
              </Field>
              <Field label="Cliente ou pagador (opcional)">
                {input("payer")}
              </Field>
              <div className="form-grid">
                <Field label="Situação">
                  {choice(
                    "status",
                    [
                      ["confirmed", "Já recebi"],
                      ["pending", "Ainda vou receber"],
                    ],
                    "Situação da entrada",
                  )}
                </Field>
                <Field
                  label={
                    form.status === "pending"
                      ? "Quando espera receber?"
                      : "Quando recebeu?"
                  }
                >
                  {input("date", "date", true)}
                </Field>
              </div>
              {entry && entry.status === "confirmed" && !entry.receivable && !entry.expectedDate && (
                <Field label="Data prevista original (se conhecida)">
                  {input("expectedDate", "date")}
                  <p className="footnote">Preencha apenas se souber a data originalmente combinada. Ela permite reabrir a pendência ao excluir um pagamento; não é a data em que o dinheiro entrou.</p>
                </Field>
              )}
              {!entry && form.incomeSource === "salary" && (
                <Field label="Repetir este salário?">
                  {choice(
                    "repeatIncome",
                    [
                      ["no", "Só esta entrada"],
                      ["yes", "Repetir automaticamente todo mês"],
                    ],
                    "Repetição do salário",
                  )}
                </Field>
              )}
              <p className="footnote">
                {form.incomeSource === "salary" && form.repeatIncome === "yes"
                  ? "A partir do próximo mês, o salário aparecerá sozinho em “A receber”. Você só confirma quando o dinheiro entrar."
                  : requestedKind === "receivable" && !entry
                    ? "Informe o valor total combinado. Quando um pagamento entrar, você poderá marcar “Recebi tudo” ou “Recebi só uma parte”."
                  : form.status === "pending"
                  ? "Este valor fica a receber e não aumenta seu saldo. Você poderá confirmar o recebimento total ou parcial."
                  : "Este valor entra no saldo da conta selecionada."}
              </p>
            </>
          )}
          <Field label="Categoria">
            {choice("category", categories, "Categoria")}
          </Field>
          <Field label="Conta ou cartão">
            {choice(
              "account",
              accounts
                .filter((a) => form.type === "expense" || a.type !== "credit")
                .map((a) => [a.id, a.name]),
              "Conta ou cartão",
            )}
          </Field>
          {form.type === "transfer" && (
            <Field label="Destino">
              {choice(
                "destination",
                accounts
                  .filter((a) => a.id !== form.account)
                  .map((a) => [a.id, a.name]),
                "Destino",
              )}
            </Field>
          )}
          <button
            type="button"
            className="textbutton"
            onClick={() => setDetails(!details)}
          >
            <ChevronDown size={17} />{" "}
            {details ? "Menos detalhes" : "Mais detalhes"}
          </button>
          {details && (
            <>
              {form.type !== "income" && (
                <div className="form-grid">
                  <Field label="Data">{input("date", "date", true)}</Field>
                  <Field label="Situação">
                    {choice(
                      "status",
                      [
                        ["confirmed", "Confirmado"],
                        ["pending", "Pendente"],
                      ],
                      "Situação",
                    )}
                  </Field>
                </div>
              )}
              {!entry && form.type === "expense" && (
                <Field label="Quantidade de parcelas">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={form.count}
                    onChange={(e) => set("count", e.target.value)}
                  />
                </Field>
              )}
              {advanced && (
                <>
                  <Field label="Tags (separadas por vírgula)">
                    {input("tags")}
                  </Field>
                  <Field label="Projeto">
                    {choice(
                      "project",
                      [
                        ["none", "Sem projeto"],
                        ...data.entities
                          .filter((e) => e.kind === "project")
                          .map((e) => [e.id, e.name] as [string, string]),
                      ],
                      "Projeto",
                    )}
                  </Field>
                </>
              )}
              <Field label="Observações">
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  maxLength={3000}
                />
              </Field>
            </>
          )}
          {accounts.find((a) => a.id === form.account)?.type === "credit" && (
            <p className="footnote">
              O gasto entra no mês de vencimento de cada parcela. O total da
              compra ocupa o limite do cartão. O pagamento da fatura é uma
              transferência.
            </p>
          )}
        </>
      )}
      {kind === "account" && (
        <>
          <Field label="Tipo de conta">
            {choice(
              "type",
              [
                ["checking", "Conta corrente / digital"],
                ["cash", "Dinheiro / carteira"],
                ["savings", "Poupança / reserva"],
                ["investment", "Investimento"],
                ["credit", "Cartão de crédito"],
              ],
              "Tipo de conta",
            )}
          </Field>
          <Field
            label={
              form.type === "credit"
                ? "Dívida inicial do cartão"
                : "Saldo inicial"
            }
          >
            {moneyInput("current", false)}
          </Field>
          {form.type === "credit" && (
            <div className="form-grid">
              <Field label="Dia do fechamento">
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.closing}
                  onChange={(e) => set("closing", e.target.value)}
                />
              </Field>
              <Field label="Dia do vencimento">
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={form.due}
                  onChange={(e) => set("due", e.target.value)}
                />
              </Field>
            </div>
          )}
          <p className="footnote">
            O saldo inicial é o ponto de partida. Não inclua nele movimentações
            que você também vai registrar.
          </p>
        </>
      )}
      {["goal", "reserve", "purchase", "debt", "contribution"].includes(
        kind,
      ) && (
        <Field
          label={kind === "debt" ? "Saldo devedor atual" : "Valor já reservado"}
        >
          {moneyInput("current")}
        </Field>
      )}
      {kind === "contribution" && (
        <p className="footnote">
          Este ajuste separa dinheiro virtualmente. Não cria receita ou despesa
          e não transfere entre contas.
        </p>
      )}
      {[
        "goal",
        "purchase",
        "reserve",
        "project",
        "debt",
        "recurring",
        "debt-payment",
        "card-payment",
      ].includes(kind) && (
        <Field
          label={
            kind === "debt-payment" || kind === "card-payment"
              ? "Data do pagamento"
              : kind === "recurring"
                ? form.type === "income"
                  ? "Primeira data prevista (opcional)"
                  : "Primeiro vencimento (opcional)"
                : "Data desejada / vencimento"
          }
        >
          {input("date", "date", special)}
        </Field>
      )}
      {["recurring", "debt-payment", "card-payment"].includes(kind) && (
        <Field label="Conta">
          {choice(
            "account",
            kind === "recurring"
              ? [
                  ["none", "Definir depois"],
                  ...cash.map((a) => [a.id, a.name] as [string, string]),
                ]
              : cash.map((a) => [a.id, a.name]),
            "Conta",
          )}
        </Field>
      )}
      {kind === "budget" && (
        <>
          <Field label="Categoria">
            {choice("category", categories, "Categoria")}
          </Field>
          <Field label="Mês do orçamento">
            <input
              type="month"
              value={form.date.slice(0, 7)}
              onChange={(e) => set("date", e.target.value + "-01")}
              required
            />
          </Field>
        </>
      )}
      {kind === "debt" && (
        <div className="form-grid">
          <Field label="Juros ao mês (%)">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.rate}
              onChange={(e) => set("rate", e.target.value)}
            />
          </Field>
          <Field label="Parcelas restantes">
            <input
              type="number"
              min="1"
              max="600"
              value={form.count}
              onChange={(e) => set("count", e.target.value)}
            />
          </Field>
        </div>
      )}
      {kind === "recurring" && (
        <>
          {!isFixedIncome && (
            <Field label="Tipo">
              {choice(
                "type",
                [
                  ["expense", "Despesa"],
                  ["income", "Receita"],
                ],
                "Tipo",
              )}
            </Field>
          )}
          <Field label="Frequência">
            {choice("period", ["Mensal", "Anual"], "Frequência")}
          </Field>
          <Field label="Automação">
            {choice(
              "status",
              [
                ["Ativo", "Ativa · preparar todo mês"],
                ["Inativo", "Pausada · não criar lançamentos"],
              ],
              "Automação",
            )}
          </Field>
          {form.type === "expense" && (
            <Field label="Como este gasto entra no plano?">
              {choice(
                "expenseClass",
                [
                  ["fixed", "Custo fixo / essencial"],
                  ["variable", "Conta variável (água, luz, alimentação…)"],
                  ["debt", "Parcela ou compromisso de dívida"],
                ],
                "Tipo de gasto",
              )}
            </Field>
          )}
          <Field label="Categoria">
            {choice("category", categories, "Categoria")}
          </Field>
          <p className="footnote">
            {form.type === "income"
              ? "Complete valor, conta e primeira data para a renda aparecer automaticamente em “A receber” a cada mês. O saldo só muda quando você confirmar o recebimento."
              : "Você pode salvar sem saber o valor, a conta ou o vencimento. Para preparar o lançamento automático do mês, complete os três dados. Se o vencimento cair nos dias 29, 30 ou 31, usamos o último dia nos meses mais curtos. Ele ficará pendente até você confirmar."}
          </p>
        </>
      )}
      {["goal", "reserve", "purchase", "debt", "project"].includes(kind) && (
        <Field label="Prioridade">
          {choice("priority", ["Baixa", "Média", "Alta"], "Prioridade")}
        </Field>
      )}
      {kind === "purchase" && (
        <>
          <Field label="Situação">
            {choice(
              "status",
              [
                "Ideia",
                "Pesquisando",
                "Planejando",
                "Reservado",
                "Comprado",
                "Cancelado",
              ],
              "Situação",
            )}
          </Field>
          <Field label="Link do produto">{input("url", "url")}</Field>
          <p className="footnote">
            Marcar como comprado libera a reserva. Registre também a
            movimentação da compra para atualizar seu saldo.
          </p>
        </>
      )}
      {kind !== "entry" && !special && (
        <Field label="Observações">
          <textarea
            value={form.notes}
            maxLength={3000}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      )}
      {entry?.receivable && (
        <p className="footnote">
          Recebimento parcial vinculado. Excluir devolve este valor à entrada
          pendente, se ela ainda existir.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {item && !special && (
          <button
            className="danger"
            type="button"
            onClick={() => onDelete(item)}
          >
            <Trash2 size={16} /> Excluir
          </button>
        )}
        <button
          className="primary"
          disabled={busy}
          type="submit"
        >
          {busy ? "Salvando…" : "Confirmar e salvar"} <Check size={17} />
        </button>
      </div>
    </form>
  );
}

function specialDate(
  kind: string,
  item: Entity | Entry | undefined,
  month: string,
) {
  return ["debt-payment", "card-payment"].includes(kind)
    ? today()
    : item?.date ||
        (kind === "budget" ? month + "-01" : kind === "recurring" ? "" : today());
}

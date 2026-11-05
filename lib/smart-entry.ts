import type { Entity } from "./finance";

export type SmartSource = "text" | "voice" | "image";

export type SmartEntryDraft = {
  type: "expense" | "income" | "transfer";
  amount?: number;
  date: string;
  name: string;
  category: string;
  account?: string;
  incomeSource: "salary" | "freelance" | "sales" | "other";
  payer: string;
  status: "confirmed" | "pending";
  source: SmartSource;
  missing: Array<"amount" | "name">;
};

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const categoryWords: Array<[string, string[]]> = [
  [
    "Alimentação",
    [
      "mercado",
      "supermercado",
      "feira",
      "almoço",
      "almoco",
      "jantar",
      "lanche",
      "restaurante",
      "padaria",
      "ifood",
      "comida",
    ],
  ],
  [
    "Transporte",
    [
      "uber",
      "99",
      "ônibus",
      "onibus",
      "metro",
      "metrô",
      "gasolina",
      "combustível",
      "combustivel",
      "estacionamento",
      "pedágio",
      "pedagio",
    ],
  ],
  [
    "Moradia",
    [
      "aluguel",
      "condomínio",
      "condominio",
      "energia",
      "luz",
      "água",
      "agua",
      "internet",
      "gás",
      "gas",
    ],
  ],
  [
    "Saúde",
    [
      "farmácia",
      "farmacia",
      "médico",
      "medico",
      "dentista",
      "consulta",
      "exame",
      "remédio",
      "remedio",
    ],
  ],
  [
    "Educação",
    ["curso", "faculdade", "escola", "livro", "mensalidade", "aula"],
  ],
  ["Lazer", ["cinema", "show", "bar", "passeio", "jogo", "streaming"]],
  [
    "Compras",
    ["loja", "shopping", "roupa", "sapato", "eletrônico", "eletronico"],
  ],
  ["Assinaturas", ["assinatura", "netflix", "spotify", "prime", "icloud"]],
  ["Pets", ["pet", "ração", "racao", "veterinário", "veterinario"]],
  ["Viagens", ["hotel", "passagem", "viagem", "hospedagem", "airbnb"]],
  ["Dívidas", ["dívida", "divida", "empréstimo", "emprestimo", "parcela"]],
  ["Investimentos", ["investimento", "apliquei", "aplicação", "aplicacao"]],
  [
    "Trabalho",
    [
      "salário",
      "salario",
      "freela",
      "freelance",
      "cliente",
      "serviço",
      "servico",
      "comissão",
      "comissao",
      "venda",
    ],
  ],
];

const numberValues: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const regexEscape = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseNumberWords(value: string) {
  const tokens = value
    .toLowerCase()
    .split(/\s+/)
    .filter((x) => x && x !== "e");
  if (!tokens.length || tokens.some((x) => !(x in numberValues) && x !== "mil"))
    return;
  let total = 0;
  let group = 0;
  for (const token of tokens) {
    if (token === "mil") {
      total += (group || 1) * 1000;
      group = 0;
    } else group += numberValues[token];
  }
  return total + group;
}

function parseNumericAmount(value: string) {
  const cleaned = value.replace(/\s/g, "");
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned))
    return Math.round(
      Number(cleaned.replace(/\./g, "").replace(",", ".")) * 100,
    );
  if (/^\d+(?:,\d{1,2})$/.test(cleaned))
    return Math.round(Number(cleaned.replace(",", ".")) * 100);
  if (/^\d+(?:\.\d{1,2})$/.test(cleaned))
    return Math.round(Number(cleaned) * 100);
  if (/^\d{1,7}$/.test(cleaned)) return Number(cleaned) * 100;
}

function amountFrom(text: string, source: SmartSource) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amountPattern =
    /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
  const candidates: Array<{ value: number; score: number; index: number }> = [];
  lines.forEach((line, index) => {
    let match: RegExpExecArray | null;
    while ((match = amountPattern.exec(line))) {
      const value = parseNumericAmount(match[1]);
      if (!value || value > 100_000_000_000) continue;
      const lowered = fold(line);
      const looksLikeDate = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(
        match[1],
      );
      if (looksLikeDate) continue;
      let score = /R\$/i.test(match[0]) ? 4 : 0;
      if (
        /\b(total a pagar|total|valor pago|valor da compra|pagamento)\b/i.test(
          lowered,
        )
      )
        score += 8;
      if (
        /\b(subtotal|troco|desconto|documento|cnpj|cpf|cartao|cartão)\b/i.test(
          lowered,
        )
      )
        score -= 3;
      if (/[.,]\d{2}\b/.test(match[1])) score += 2;
      candidates.push({ value, score, index });
    }
  });
  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || b.index - a.index);
    if (source === "image" || candidates[0].score > 0)
      return candidates[0].value;
    return candidates[0].value;
  }
  const normalized = text.toLowerCase();
  const reais = normalized.match(/([a-zá-úç\s]+?)\s+reais?\b/iu);
  const whole = reais
    ? parseNumberWords(
        reais[1]
          .trim()
          .split(/\b(?:gastei|paguei|recebi|ganhei|valor|foi)\b/)
          .pop() || "",
      )
    : undefined;
  if (whole === undefined) return;
  const centsMatch = normalized.match(/([a-zá-úç\s]+?)\s+centavos?\b/iu);
  const cents = centsMatch
    ? parseNumberWords(centsMatch[1].trim().split(/\be\b/).pop() || "") || 0
    : 0;
  return whole * 100 + Math.min(99, cents);
}

function dateFrom(text: string, now: string) {
  const lowered = fold(text);
  const base = new Date(now + "T12:00:00");
  if (/\banteontem\b/.test(lowered)) base.setDate(base.getDate() - 2);
  else if (/\bontem\b/.test(lowered)) base.setDate(base.getDate() - 1);
  else {
    const match = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (!match) return now;
    const year = match[3]
      ? Number(match[3]) < 100
        ? 2000 + Number(match[3])
        : Number(match[3])
      : Number(now.slice(0, 4));
    const date = `${year}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    const parsed = new Date(date + "T12:00:00");
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getDate() === Number(match[1])
    )
      return date;
    return now;
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function nameFrom(
  text: string,
  source: SmartSource,
  type: SmartEntryDraft["type"],
) {
  if (source === "image") {
    const line = text
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(
        (value) =>
          value.length >= 3 &&
          /[A-Za-zÀ-ÿ]/.test(value) &&
          !/\b(cnpj|cpf|cupom|nota fiscal|nfce|total|subtotal|valor|data|hora|cart[aã]o|pix|troco|obrigad|consumidor)\b/i.test(
            value,
          ),
      );
    return (
      line
        ?.replace(/[^A-Za-zÀ-ÿ0-9 &'´`.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Compra por foto"
    );
  }
  let value = text
    .replace(
      /\b(?:gastei|paguei|comprei|recebi|ganhei|entrou|transferi|anote|registre|registrar)\b/gi,
      " ",
    )
    .replace(/R\$\s*\d[\d.,]*/gi, " ")
    .replace(/\b\d[\d.,]*\s*(?:reais?|conto?s?|centavos?)\b/gi, " ")
    .replace(/\b(?:hoje|ontem|anteontem)\b/gi, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b(?:no|na|nos|nas|em|com|de|do|da|para|pelo|pela)\b/gi, " ")
    .replace(/[.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value)
    value =
      type === "income"
        ? "Entrada"
        : type === "transfer"
          ? "Transferência"
          : "Gasto";
  return value.charAt(0).toUpperCase() + value.slice(1, 100);
}

export function parseSmartEntry({
  text,
  source,
  accounts = [],
  categories = [],
  now = localToday(),
}: {
  text: string;
  source: SmartSource;
  accounts?: Entity[];
  categories?: string[];
  now?: string;
}): SmartEntryDraft {
  const comparable = fold(text);
  const type: SmartEntryDraft["type"] =
    /\b(transferi|transferencia|movi|mandei dinheiro)\b/.test(comparable)
      ? "transfer"
      : /\b(recebi|recebido|recebimento|entrada|salario|freela|freelance|venda|comissao|ganhei|pix recebido|vou receber)\b/.test(
            comparable,
          )
        ? "income"
        : "expense";
  const date = dateFrom(text, now);
  const knownCategory = categoryWords.find(([, words]) =>
    words.some((word) => comparable.includes(fold(word))),
  )?.[0];
  const category =
    categories.find((value) => fold(value) === fold(knownCategory || "")) ||
    knownCategory ||
    (type === "income" ? "Trabalho" : "Outros");
  const matchedAccount = accounts.find((value) =>
    comparable.includes(fold(value.name)),
  );
  const incomeSource: SmartEntryDraft["incomeSource"] =
    /\b(salario|salario fixo)\b/.test(comparable)
      ? "salary"
      : /\b(venda|comissao)\b/.test(comparable)
        ? "sales"
        : /\b(freela|freelance|servico|cliente)\b/.test(comparable)
          ? "freelance"
          : "other";
  const payerMatch = text.match(
    /\bcliente\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '-]{1,60}?)(?=\s+(?:pelo|pela|por|em|hoje|ontem)\b|[.,;]|$)/i,
  );
  const payer = payerMatch?.[1]?.trim() || "";
  const amount = amountFrom(text, source);
  let name = nameFrom(text, source, type);
  if (source !== "image" && type === "income") {
    if (incomeSource === "salary") name = "Salário";
    else if (incomeSource === "freelance")
      name = payer ? `Freela · ${payer}` : "Freela";
    else if (incomeSource === "sales") name = "Venda / comissão";
  }
  if (matchedAccount && source !== "image") {
    name = name
      .replace(new RegExp(`\\b${regexEscape(matchedAccount.name)}\\b`, "i"), "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const status: SmartEntryDraft["status"] =
    type === "income" &&
    (date > now ||
      /\b(vou receber|a receber|previsto|pendente)\b/.test(comparable))
      ? "pending"
      : "confirmed";
  return {
    type,
    amount,
    date,
    name,
    category,
    account: matchedAccount?.id,
    incomeSource,
    payer,
    status,
    source,
    missing: [
      ...(!amount ? (["amount"] as const) : []),
      ...(!name ? (["name"] as const) : []),
    ],
  };
}

export function amountForInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

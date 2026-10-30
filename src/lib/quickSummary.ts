/**
 * Resumo rápido gravado em users/{uid}/resumo/atual, para o Atalho do iPhone
 * (Tocar nas costas) mostrar o saldo e escolher categorias sem abrir o app.
 *
 * Mesmas regras do app (App.tsx): o saldo soma receitas e subtrai despesas sem
 * cartão (despesa de cartão só pesa quando a fatura é paga); os totais do mês
 * seguem a data de Brasília.
 *
 * Sem imports e só com sintaxe que o Node entende ao apagar tipos: o script
 * scripts/sync-pluggy.mjs importa este arquivo direto.
 */
export interface SummaryTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'investment';
  date?: string;
  time?: string;
  cardId?: string;
  category?: string;
}

export interface SummaryCategory {
  name: string;
  type: 'income' | 'expense' | 'investment';
}

export interface QuickSummary {
  /** Instante da geração (ISO), para mostrar "atualizado às ..." */
  atualizadoEm: string;
  saldo: number;
  entradasMes: number;
  gastosMes: number;
  pendentesTotal: number;
  pendentesQtd: number;
  /** Título do alerta do Atalho (ex: "Financy · 29 out"). */
  titulo: string;
  /** Texto pronto para o alerta do Atalho (popup de vidro), com mini gráficos em caracteres. */
  texto: string;
  /** Cartão em HTML (fundo escuro, estilo ilha) para o Atalho abrir na Visualização Rápida. */
  html: string;
  /** Versão compacta do cartão para caber dentro do popup de vidro (Mostrar resultado), sem rolagem. */
  htmlPopup: string;
  /** Uma categoria por linha: o Atalho separa por linha e mostra a lista. */
  categoriasDespesa: string;
  categoriasReceita: string;
}

const RECENT_LIMIT = 3;
const DESCRIPTION_MAX = 26;
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Descrição curta e legível para a caixa do Atalho: tira o prefixo do banco antes de "|",
 * transforma GRITARIA em Título e corta no tamanho máximo.
 */
function shortDescription(raw: string): string {
  const afterPipe = raw.includes('|') ? raw.slice(raw.lastIndexOf('|') + 1) : raw;
  const text = afterPipe.replace(/\s+/g, ' ').trim() || raw.trim();
  const shouting = text === text.toUpperCase() && text !== text.toLowerCase();
  const normal = shouting
    ? text.toLowerCase().replace(/(^|\s)(\S)/g, (_match, space: string, char: string) => space + char.toUpperCase())
    : text;
  return normal.length > DESCRIPTION_MAX ? `${normal.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : normal;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface RecentLine {
  income: boolean;
  amount: string;
  description: string;
}

interface CategoryBar {
  name: string;
  amount: string;
  /** 0 a 100, em relação à maior categoria. */
  width: number;
}

interface CardData {
  saldo: string;
  entradas: string;
  gastos: string;
  /** Gastos como % das entradas do mês (0 a 100). */
  spentPercent: number;
  pendentes: string | null;
  recent: RecentLine[];
  categories: CategoryBar[];
  /** Saldo no fim de cada um dos últimos dias, do mais antigo ao de hoje. */
  series: number[];
  dateLabel: string;
  time: string;
}

const CATEGORY_COLORS = ['#30d158', '#0a84ff', '#ff9f0a', '#bf5af2'];
const SERIES_DAYS = 14;
const TOP_CATEGORIES = 4;
const SPARK_WIDTH = 320;
const SPARK_HEIGHT = 56;
const DONUT_RADIUS = 34;
const SPARK_BLOCKS = '▁▂▃▄▅▆▇█';
const PERCENT_BAR_SEGMENTS = 10;
const CATEGORY_DOTS = ['🟢', '🔵', '🟠', '🟣'];
const TEXT_CATEGORIES = 3;

/** Mini gráfico do saldo em caracteres (▁ a █), do mais antigo ao mais novo. */
function sparkText(series: number[]): string {
  const min = Math.min(...series);
  const span = Math.max(...series) - min || 1;
  return series
    .map((value) => SPARK_BLOCKS[Math.min(SPARK_BLOCKS.length - 1, Math.floor(((value - min) / span) * SPARK_BLOCKS.length))])
    .join('');
}

/** Barra de progresso em caracteres: ▰▰▰▰▰▰▰▰▰▱ */
function percentBar(percent: number): string {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * PERCENT_BAR_SEGMENTS);
  return '▰'.repeat(filled) + '▱'.repeat(PERCENT_BAR_SEGMENTS - filled);
}

/** Linha e área do gráfico do saldo (SVG), do mais antigo ao mais novo. */
function sparklineSvg(series: number[]): string {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = SPARK_WIDTH / Math.max(series.length - 1, 1);
  const points = series.map((value, i) => ({
    x: Math.round(i * stepX * 10) / 10,
    y: Math.round((SPARK_HEIGHT - 6 - ((value - min) / span) * (SPARK_HEIGHT - 12)) * 10) / 10,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const last = points[points.length - 1];
  const up = series[series.length - 1] >= series[0];
  const color = up ? '#30d158' : '#ff453a';
  return [
    `<svg viewBox="0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}" width="100%" height="${SPARK_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">`,
    `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`,
    `<path d="${line} L${SPARK_WIDTH} ${SPARK_HEIGHT} L0 ${SPARK_HEIGHT} Z" fill="url(#sg)"/>`,
    `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${last.x}" cy="${last.y}" r="4" fill="${color}"/>`,
    '</svg>',
  ].join('');
}

/** Anel de "quanto das entradas já foi gasto" (SVG). */
function donutSvg(percent: number): string {
  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const filled = (Math.min(Math.max(percent, 0), 100) / 100) * circumference;
  const color = percent >= 100 ? '#ff453a' : percent >= 80 ? '#ff9f0a' : '#30d158';
  return [
    '<svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">',
    `<circle cx="44" cy="44" r="${DONUT_RADIUS}" fill="none" stroke="#2c2c2e" stroke-width="10"/>`,
    `<circle cx="44" cy="44" r="${DONUT_RADIUS}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${Math.round(filled * 10) / 10} ${Math.round(circumference * 10) / 10}" transform="rotate(-90 44 44)"/>`,
    `<text x="44" y="48" text-anchor="middle" font-size="18" font-weight="700" fill="#fff">${Math.round(percent)}%</text>`,
    '<text x="44" y="62" text-anchor="middle" font-size="9" fill="#8e8e93">gasto</text>',
    '</svg>',
  ].join('');
}

const ICON_UP =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#30d158" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';
const ICON_DOWN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ff453a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 8v9H8"/></svg>';
const ICON_HOURGLASS =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff9f0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4"/></svg>';
const ICON_WALLET =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1.2" fill="#fff"/></svg>';

const CARD_CSS = [
  '*{box-sizing:border-box}body{margin:0;padding:14px;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}',
  '.c{background:linear-gradient(160deg,#1f1f22,#141416);border-radius:30px;padding:22px;box-shadow:0 0 0 1px #2c2c2e}',
  '.h{display:flex;align-items:center;gap:10px}.logo{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#30d158,#0a84ff);display:flex;align-items:center;justify-content:center}',
  '.h b{font-size:16px}.h span{margin-left:auto;font-size:12px;color:#8e8e93}',
  '.l{margin-top:18px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93}',
  '.s{font-size:42px;font-weight:700;letter-spacing:-.03em;line-height:1.1}',
  '.sp{margin:6px -4px 0}.sp small{display:block;text-align:right;font-size:11px;color:#8e8e93;margin-top:2px}',
  '.r{display:flex;align-items:center;gap:16px;margin-top:16px;background:#2c2c2e66;border-radius:22px;padding:14px}',
  '.r .v{flex:1;display:flex;flex-direction:column;gap:10px}.k{display:flex;align-items:center;gap:8px;font-size:13px;color:#aeaeb2}.k b{margin-left:auto;font-size:16px;color:#fff}',
  '.pill{display:flex;align-items:center;gap:10px;margin-top:12px;background:#ff9f0a1f;border-radius:18px;padding:12px 14px;font-size:14px}.pill b{margin-left:auto;color:#ff9f0a}',
  'h3{margin:20px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93;font-weight:600}',
  '.cat{margin-bottom:10px}.cat div{display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px}.cat i{display:block;height:7px;border-radius:4px}.bar{background:#2c2c2e;border-radius:4px}',
  'ul{list-style:none;margin:0;padding:0}li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #2c2c2e;font-size:14px}',
  '.d{flex:1;color:#d1d1d6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.in{color:#30d158;font-weight:600}.out{font-weight:600}',
  '.t{margin-top:16px;font-size:12px;color:#8e8e93;text-align:center}',
].join('');

/**
 * Página autocontida (sem recursos externos): cartão escuro com gráficos em SVG, igual ao saldo do app.
 */
function buildHtml(d: CardData): string {
  const categories = d.categories
    .map(
      (c, i) =>
        `<div class="cat"><div><span>${escapeHtml(c.name)}</span><b>${escapeHtml(c.amount)}</b></div><div class="bar"><i style="width:${c.width}%;background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"></i></div></div>`
    )
    .join('');
  const recent = d.recent
    .map(
      (r) =>
        `<li>${r.income ? ICON_UP : ICON_DOWN}<span class="d">${escapeHtml(r.description)}</span><span class="${r.income ? 'in' : 'out'}">${r.income ? '+' : '−'}${escapeHtml(r.amount)}</span></li>`
    )
    .join('');
  const pending = d.pendentes
    ? `<div class="pill">${ICON_HOURGLASS}<span>Pendentes</span><b>${escapeHtml(d.pendentes)}</b></div>`
    : '';
  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">',
    `<style>${CARD_CSS}</style></head><body><div class="c">`,
    `<div class="h"><div class="logo">${ICON_WALLET}</div><b>Financy</b><span>${escapeHtml(d.dateLabel)}</span></div>`,
    '<div class="l">Saldo</div>',
    `<div class="s">${escapeHtml(d.saldo)}</div>`,
    d.series.length > 1 ? `<div class="sp">${sparklineSvg(d.series)}<small>últimos ${d.series.length} dias</small></div>` : '',
    `<div class="r">${donutSvg(d.spentPercent)}<div class="v">`,
    `<div class="k">${ICON_UP} Entradas <b>${escapeHtml(d.entradas)}</b></div>`,
    `<div class="k">${ICON_DOWN} Gastos <b>${escapeHtml(d.gastos)}</b></div></div></div>`,
    pending,
    categories ? `<h3>Onde você gastou</h3>${categories}` : '',
    recent ? `<h3>Últimos</h3><ul>${recent}</ul>` : '',
    `<div class="t">Atualizado às ${escapeHtml(d.time)}</div>`,
    '</div></body></html>',
  ].join('');
}

/**
 * Cartão para o popup de vidro (Mostrar resultado). A página ali tem só ~230 px de altura, então
 * tudo é medido em fatias de 1% da altura da janela (--u): o cartão se ajusta e nunca passa dela.
 */
const POPUP_CSS = [
  ':root{--u:calc(min(100vh,232px)/100)}',
  '*{box-sizing:border-box}html,body{margin:0;background:#000}',
  'body{padding:4px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}',
  '.c{height:calc(var(--u)*100 - 8px);display:flex;flex-direction:column;justify-content:space-between;padding:calc(var(--u)*5) calc(var(--u)*6);border-radius:calc(var(--u)*11);background:linear-gradient(160deg,#1f1f22,#141416)}',
  '.top{display:flex;justify-content:space-between;align-items:baseline;font-size:calc(var(--u)*6);color:#8e8e93;text-transform:uppercase;letter-spacing:.06em}',
  '.s{font-size:calc(var(--u)*16);font-weight:700;letter-spacing:-.02em;line-height:1;color:#fff;text-transform:none;margin-top:calc(var(--u)*1)}',
  '.sp svg{width:100%;height:calc(var(--u)*19);display:block}',
  '.b{display:flex;align-items:center;gap:calc(var(--u)*6)}.b>svg{width:calc(var(--u)*29);height:calc(var(--u)*29);flex:none}',
  '.v{flex:1;display:flex;flex-direction:column;gap:calc(var(--u)*3);font-size:calc(var(--u)*7.5)}',
  '.k{display:flex;align-items:center;gap:calc(var(--u)*3);color:#aeaeb2}.k svg{width:calc(var(--u)*7);height:calc(var(--u)*7);flex:none}.k b{margin-left:auto;color:#fff;font-size:calc(var(--u)*8)}',
  '.k.p{color:#ff9f0a}.k.p b{color:#ff9f0a}',
].join('');

function buildPopupHtml(d: CardData): string {
  const pending = d.pendentes ? `<div class="k p">${ICON_HOURGLASS}Pendentes <b>${escapeHtml(d.pendentes)}</b></div>` : '';
  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">',
    `<style>${POPUP_CSS}</style></head><body><div class="c">`,
    `<div><div class="top"><span>Saldo</span><span>${escapeHtml(d.dateLabel)} · ${escapeHtml(d.time)}</span></div><div class="s">${escapeHtml(d.saldo)}</div></div>`,
    d.series.length > 1 ? `<div class="sp">${sparklineSvg(d.series)}</div>` : '',
    `<div class="b">${donutSvg(d.spentPercent)}<div class="v">`,
    `<div class="k">${ICON_UP}Entradas <b>${escapeHtml(d.entradas)}</b></div>`,
    `<div class="k">${ICON_DOWN}Gastos <b>${escapeHtml(d.gastos)}</b></div>`,
    `${pending}</div></div>`,
    '</div></body></html>',
  ].join('');
}

/** Chave de ordenação "AAAA-MM-DD HH:MM" (sem hora, o lançamento fica no começo do dia). */
const sortKey = (t: { date?: string; time?: string }): string => `${t.date || ''} ${t.time || '00:00'}`;

/** Parte AAAA-MM-DD e HH:MM do instante, no fuso de Brasília. */
function brazilNow(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** AAAA-MM-DD deslocado em dias (calendário puro, sem fuso). */
function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Saldo no fim de um dia: receitas menos despesas sem cartão, até aquela data. */
function balanceUpTo(transactions: readonly SummaryTransaction[], dateISO: string): number {
  return transactions.reduce((acc, t) => {
    if (!t.date || t.date > dateISO) return acc;
    if (t.type === 'income') return acc + t.amount;
    if (t.type === 'expense' && !t.cardId) return acc - t.amount;
    return acc;
  }, 0);
}

/** Saldo no fim de cada um dos últimos dias, terminando hoje. */
function balanceSeries(transactions: readonly SummaryTransaction[], today: string): number[] {
  return Array.from({ length: SERIES_DAYS }, (_, i) => balanceUpTo(transactions, addDays(today, i - (SERIES_DAYS - 1))));
}

/** As categorias em que mais se gastou no mês, com a largura da barra relativa à maior. */
function topCategories(monthExpenses: readonly SummaryTransaction[]): CategoryBar[] {
  const totals = new Map<string, number>();
  monthExpenses.forEach((t) => {
    const name = (t.category || 'Outros').trim() || 'Outros';
    totals.set(name, (totals.get(name) ?? 0) + t.amount);
  });
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_CATEGORIES);
  const max = sorted.length > 0 ? sorted[0][1] : 1;
  return sorted.map(([name, amount]) => ({
    name: name.length > DESCRIPTION_MAX ? `${name.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : name,
    amount: brl(amount),
    width: Math.max(4, Math.round((amount / max) * 100)),
  }));
}

/** "29 out" no fuso de Brasília. */
const dateLabelOf = (now: Date): string =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: BRAZIL_TIMEZONE, day: 'numeric', month: 'short' }).format(now).replace('.', '');

export function buildQuickSummary(
  transactions: readonly SummaryTransaction[],
  categories: readonly SummaryCategory[],
  pendingAmounts: readonly number[],
  now: Date = new Date()
): QuickSummary {
  const { date: today, time } = brazilNow(now);
  const month = today.slice(0, 7);

  const saldo = transactions.reduce((acc, t) => {
    if (!t.date || t.date.slice(0, 7) > month) return acc;
    if (t.type === 'income') return acc + t.amount;
    if (t.type === 'expense' && !t.cardId) return acc - t.amount;
    return acc;
  }, 0);

  const inMonth = transactions.filter((t) => t.date && t.date.startsWith(month));
  const entradasMes = inMonth.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const gastosMes = inMonth.filter((t) => t.type === 'expense' && !t.cardId).reduce((acc, t) => acc + t.amount, 0);

  const pendentesTotal = pendingAmounts.reduce((acc, amount) => acc + amount, 0);
  const pendentesQtd = pendingAmounts.length;

  const recent = [...transactions]
    .filter((t) => t.type !== 'investment' && (t.date || '') <= today)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, RECENT_LIMIT);

  const recentLines: RecentLine[] = recent.map((t) => ({
    income: t.type === 'income',
    amount: brl(t.amount),
    description: shortDescription(t.description),
  }));
  const pendentes = pendentesQtd > 0 ? `${pendentesQtd} · ${brl(pendentesTotal)}` : null;

  const series = balanceSeries(transactions, today);
  const spentPercent = entradasMes > 0 ? (gastosMes / entradasMes) * 100 : gastosMes > 0 ? 100 : 0;
  const categoryBars = topCategories(inMonth.filter((t) => t.type === 'expense' && !t.cardId));

  const lines = [`💰  ${brl(saldo)}`, `${sparkText(series)}  ${series.length} dias`, ''];
  lines.push(`📈  Entradas  ${brl(entradasMes)}`, `📉  Gastos  ${brl(gastosMes)}`);
  lines.push(`${percentBar(spentPercent)}  ${Math.round(spentPercent)}% gasto`);
  if (pendentes) lines.push('', `⏳  Pendentes  ${pendentes}`);
  if (categoryBars.length > 0) {
    lines.push('', 'Onde você gastou');
    categoryBars.slice(0, TEXT_CATEGORIES).forEach((c, i) => lines.push(`${CATEGORY_DOTS[i % CATEGORY_DOTS.length]}  ${c.name}  ${c.amount}`));
  }
  if (recentLines.length > 0) {
    lines.push('', 'Últimos');
    recentLines.forEach((r) => lines.push(`${r.income ? '🟢 +' : '🔴 −'}${r.amount}  ${r.description}`));
  }
  lines.push('', `🕓  Atualizado às ${time}`);

  const card: CardData = {
    saldo: brl(saldo),
    entradas: brl(entradasMes),
    gastos: brl(gastosMes),
    spentPercent,
    pendentes,
    recent: recentLines,
    categories: categoryBars,
    series,
    dateLabel: dateLabelOf(now),
    time,
  };

  const namesOf = (type: SummaryCategory['type']): string =>
    categories.filter((c) => c.type === type).map((c) => c.name).join('\n');

  return {
    atualizadoEm: now.toISOString(),
    saldo,
    entradasMes,
    gastosMes,
    pendentesTotal,
    pendentesQtd,
    titulo: `Financy · ${dateLabelOf(now)}`,
    texto: lines.join('\n'),
    html: buildHtml(card),
    htmlPopup: buildPopupHtml(card),
    categoriasDespesa: namesOf('expense'),
    categoriasReceita: namesOf('income'),
  };
}

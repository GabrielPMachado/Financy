import { GoogleGenAI } from '@google/genai';

/**
 * Painel de IA simples e gratuito (tier free do Gemini) usado só na área de
 * Planejamento — nunca lê nem grava nas transações reais, só recebe um
 * resumo do que o usuário está planejando (dívidas/investimentos futuros) e
 * devolve texto. A chave é injetada no bundle do cliente em build time (ver
 * vite.config.ts) porque esse app não tem backend; não é secreta de verdade.
 */
// process.env.GEMINI_API_KEY é substituído por um literal de string em build
// time pelo `define` do vite.config.ts — não existe `process` de verdade no
// navegador, então NÃO dá pra guardar isso atrás de um `typeof process`
// check (a expressão inteira precisa aparecer literal aqui pro Vite achar).
const API_KEY: string = process.env.GEMINI_API_KEY || '';
// Alias que a Google mantém sempre apontando pro modelo flash (rápido/barato,
// dentro do tier free) mais atual — evita ter que atualizar isso manualmente
// toda vez que uma versão específica (ex: gemini-2.0-flash) é descontinuada.
const MODEL = 'gemini-flash-latest';

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: API_KEY });
  }
  return client;
}

export function isGeminiConfigured(): boolean {
  return Boolean(API_KEY);
}

export interface PlanningAiContext {
  /** Saldo atual real, só como referência — a IA não pode alterar isso. */
  currentBalance: number;
  plannedDebts: Array<{ description: string; amount: number; dueDate?: string; notes?: string }>;
  plannedInvestments: Array<{ description: string; amount: number; targetDate?: string; notes?: string }>;
  /** Pergunta livre do usuário. Se vazio, gera uma análise geral automática. */
  question?: string;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function buildPrompt(ctx: PlanningAiContext): string {
  const debtsList = ctx.plannedDebts.length
    ? ctx.plannedDebts
        .map((d) => `- ${d.description}: ${formatBRL(d.amount)}${d.dueDate ? ` (vencimento ${d.dueDate})` : ''}${d.notes ? ` — ${d.notes}` : ''}`)
        .join('\n')
    : '- (nenhuma dívida futura cadastrada)';

  const investmentsList = ctx.plannedInvestments.length
    ? ctx.plannedInvestments
        .map((i) => `- ${i.description}: ${formatBRL(i.amount)}${i.targetDate ? ` (meta ${i.targetDate})` : ''}${i.notes ? ` — ${i.notes}` : ''}`)
        .join('\n')
    : '- (nenhum investimento futuro cadastrado)';

  const instructions = ctx.question
    ? `O usuário perguntou: "${ctx.question}"\nResponda essa pergunta com base nos dados acima.`
    : 'Faça uma análise curta e prática desse planejamento: aponte riscos (ex: dívidas que pesam muito no saldo atual), prioridades e 1-2 sugestões objetivas.';

  return `Você é um assistente financeiro simples e direto, respondendo em português do Brasil.
Isso é só um PLANEJAMENTO/simulação do usuário — nada aqui é uma transação real ainda.

Saldo atual real: ${formatBRL(ctx.currentBalance)}

Dívidas futuras planejadas:
${debtsList}

Investimentos futuros planejados:
${investmentsList}

${instructions}

Responda em no máximo 6 linhas, direto ao ponto, sem markdown pesado (pode usar "-" pra listas). Não invente dados que não foram informados. Deixe claro que é só uma sugestão, não uma recomendação financeira profissional.`;
}

export async function askPlanningAi(ctx: PlanningAiContext): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error(
      'Nenhuma GEMINI_API_KEY configurada. Adicione uma chave gratuita do Google AI Studio no arquivo .env.local pra ativar o assistente.'
    );
  }

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: buildPrompt(ctx),
  });

  const text = response.text;
  if (!text) {
    throw new Error('A IA não retornou nenhuma resposta. Tente novamente.');
  }
  return text.trim();
}

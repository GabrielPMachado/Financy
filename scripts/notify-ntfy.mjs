#!/usr/bin/env node
/**
 * Push no celular (app ntfy) ao fim de uma sincronização manual. Roda na última
 * etapa do workflow ("Avisar no celular").
 *
 * Deu certo: qual banco foi atualizado e quantos lançamentos entraram (contagens de
 * $RUNNER_TEMP/sync-result.json, que o sync-pluggy.mjs deixa). Deu errado: a mesma
 * mensagem que o app mostra (src/lib/syncErrors.ts), e tocar abre o log.
 * Valores e descrições nunca vão para o ntfy.sh, que é um serviço externo.
 *
 * Ambiente: NTFY_TOPIC (secret), STATUS (job.status), REASON, BANKS, REFRESH, RUN_URL.
 * O log mostra só o HTTP, o id da mensagem e o tamanho do tópico (nunca o tópico).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeWorkflowFailure } from '../src/lib/syncErrors.ts';

// Tira espaços, quebras de linha e crases que vêm junto ao colar o secret.
const topic = String(process.env.NTFY_TOPIC || '').replace(/[\s`]/g, '');
if (!topic) process.exit(0);

function readCounts() {
  const file = join(process.env.RUNNER_TEMP || '', 'sync-result.json');
  if (!process.env.RUNNER_TEMP || !existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/** "Mercado Pago" "Nubank" -> ['Mercado Pago', 'Nubank'] */
function banksOf(list) {
  return [...String(list || '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function titleFor(ok, banks, refresh) {
  if (!ok) return 'Sincronização com problema';
  if (!refresh) return 'Dados dos bancos buscados';
  return banks.length === 1 ? `${banks[0]} atualizado` : 'Bancos atualizados';
}

function countLines(counts) {
  const expenses = counts?.despesas || 0;
  const income = counts?.receitas || 0;
  if (expenses + income === 0) return ['Nada novo desde a última vez.'];
  const lines = [`${plural(expenses + income, 'lançamento novo', 'lançamentos novos')}:`];
  if (expenses > 0) lines.push(`🔴 ${plural(expenses, 'despesa', 'despesas')}`);
  if (income > 0) lines.push(`🟢 ${plural(income, 'receita', 'receitas')}`);
  return lines;
}

function successMessage(counts) {
  return [...countLines(counts), '', 'Abra o Financy para ver os detalhes.'].join('\n');
}

function failureMessage(reason, counts) {
  const { message } = describeWorkflowFailure(reason ? [{ name: `Falha [${reason}]`, conclusion: 'failure' }] : []);
  const created = (counts?.despesas || 0) + (counts?.receitas || 0);
  const extra = created > 0 ? `\n\nMesmo assim, ${plural(created, 'lançamento novo entrou', 'lançamentos novos entraram')}.` : '';
  return `${message}${extra}\n\nToque para ver o log.`;
}

const ok = process.env.STATUS === 'success';
const counts = readCounts();
const body = {
  topic,
  title: titleFor(ok, banksOf(process.env.BANKS), process.env.REFRESH !== 'false'),
  message: ok ? successMessage(counts) : failureMessage(process.env.REASON, counts),
  tags: ok ? ['white_check_mark'] : ['warning'],
  priority: ok ? 3 : 4,
  ...(ok ? {} : { click: process.env.RUN_URL }),
};

try {
  const res = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const id = (await res.json().catch(() => ({}))).id || '?';
  console.log(`ntfy: HTTP ${res.status}, mensagem ${id}, tópico com ${topic.length} caracteres.`);
  if (!res.ok) console.log(`::warning::O ntfy não aceitou o aviso (HTTP ${res.status}).`);
} catch (err) {
  console.log(`::warning::Não foi possível falar com o ntfy (${err.message}).`);
}

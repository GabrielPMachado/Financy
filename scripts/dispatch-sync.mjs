#!/usr/bin/env node
/**
 * Dispara o workflow de sincronização no GitHub Actions a partir do seu PC.
 * Serve para o agendador do Windows (scripts/install-sync-task.ps1) rodar de hora em
 * hora, já que o agendamento do próprio GitHub costuma atrasar e pular horários.
 *
 *   node scripts/dispatch-sync.mjs            -> atualiza o Mercado Pago
 *                                                (os dois bancos às 06h e 18h, horário de Brasília)
 *   node scripts/dispatch-sync.mjs todos      -> força os dois bancos
 *   node scripts/dispatch-sync.mjs rapido     -> só busca os dados (sem pedir atualização)
 *
 * Token: GITHUB_DISPATCH_TOKEN ou VITE_GITHUB_SYNC_TOKEN no .env.local (permissão
 * Actions: leitura e escrita, restrito ao repositório). Nunca é impresso.
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // sem .env.local: usa o ambiente
}

const REPO = process.env.GITHUB_REPO || 'GabrielPMachado/financy';
const WORKFLOW_FILE = 'sync-pluggy.yml';
const BRANCH = 'main';
const NUBANK_HOURS_BRT = new Set([6, 18]);

function fail(message) {
  console.error(`${new Date().toISOString()} ${message}`);
  process.exit(1);
}

function brasiliaHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
}

function chooseInputs(arg) {
  if (arg === 'rapido') return { refresh: 'false', banks: 'todos' };
  if (arg === 'todos' || NUBANK_HOURS_BRT.has(brasiliaHour())) return { refresh: 'true', banks: 'todos' };
  return { refresh: 'true', banks: 'Mercado Pago' };
}

const HTTP_ERRORS = {
  401: 'Token do GitHub inválido ou expirado.',
  403: 'O token não tem a permissão Actions (leitura e escrita) neste repositório.',
  404: 'Repositório ou workflow não encontrado (o token é do repositório financy? o projeto foi enviado com git push?).',
  422: 'O GitHub recusou os parâmetros: o workflow publicado está desatualizado. Rode git push origin main.',
};

async function main() {
  const token = process.env.GITHUB_DISPATCH_TOKEN || process.env.VITE_GITHUB_SYNC_TOKEN;
  if (!token) fail('Defina GITHUB_DISPATCH_TOKEN (ou VITE_GITHUB_SYNC_TOKEN) no .env.local.');

  const inputs = chooseInputs(process.argv[2]);
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: BRANCH, inputs }),
    });
  } catch {
    fail('Sem conexão com o GitHub (PC sem internet?).');
  }
  if (!res.ok) fail(HTTP_ERRORS[res.status] ?? `O GitHub respondeu com erro ${res.status}.`);
  console.log(`${new Date().toISOString()} Sincronização disparada (refresh=${inputs.refresh}, banks=${inputs.banks}).`);
}

main();

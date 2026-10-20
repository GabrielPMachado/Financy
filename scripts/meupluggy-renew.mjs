#!/usr/bin/env node
/**
 * Renova sozinho a sessão do Meu Pluggy (login com Google) e atualiza o secret
 * MEUPLUGGY_STORAGE_STATE no GitHub, para o workflow não ficar sem acesso.
 *
 *   node scripts/meupluggy-renew.mjs setup   -> UMA vez: abre um navegador dedicado;
 *                                               entre no Google e no Meu Pluggy
 *   node scripts/meupluggy-renew.mjs renew   -> sem janela: usa o perfil salvo,
 *                                               refaz o login com a conta Google que já
 *                                               está lá, e atualiza o secret
 *
 * O perfil dedicado fica em .auth/profile (ignorado pelo git; é como uma cópia do
 * seu navegador logado: não compartilhe). Para atualizar o secret é preciso
 * GITHUB_SECRETS_TOKEN no .env.local: token fine-grained do repositório com
 * permissão "Secrets: Read and write" (e nada além disso).
 *
 * Nada de senha/segredo é impresso. Em caso de falha, salva .auth/renew-failure.png
 * (pode mostrar dados da sua conta: não envie esse arquivo a ninguém).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sodium from 'libsodium-wrappers';

try {
  process.loadEnvFile('.env.local');
} catch {
  // sem .env.local: usa o ambiente
}

const SITE = 'https://meu.pluggy.ai';
const PROFILE_DIR = '.auth/profile';
const FAILURE_SHOT = '.auth/renew-failure.png';
const REPO = process.env.GITHUB_REPO || 'GabrielPMachado/financy';
const SECRET_NAME = 'MEUPLUGGY_STORAGE_STATE';
const LOGGED_IN_URL = /meu\.pluggy\.ai\/(overview|connections|flow|assets)/;
const mode = process.argv[2];

const launchProfile = (headless) =>
  chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chromium', // Chromium completo (o "headless shell" costuma ser bloqueado por antivírus)
    headless,
    locale: 'pt-BR',
    args: ['--disable-blink-features=AutomationControlled'],
  });

/** Estado reduzido (só cookies do Pluggy, < 48 KB) em base64, no formato que o workflow espera. */
async function exportState(context) {
  const state = await context.storageState();
  state.cookies = state.cookies.filter((c) => /pluggy/i.test(c.domain));
  const encoded = Buffer.from(JSON.stringify(state)).toString('base64');
  if (encoded.length > 48_000) throw new Error(`Sessão grande demais para um secret (${encoded.length} caracteres).`);
  return encoded;
}

const GITHUB_ERRORS = {
  401: 'O GITHUB_SECRETS_TOKEN é inválido ou expirou (tokens fine-grained têm prazo de validade). Gere outro token e atualize o .env.local.',
  403: 'O GITHUB_SECRETS_TOKEN não tem a permissão "Secrets: Read and write" (ou o limite de requisições do GitHub foi atingido).',
  404: `O GitHub não achou o repositório ${REPO}: o token é desse repositório? (confira também GITHUB_REPO).`,
};

/** Chama a API de secrets do repositório; devolve o cabeçalho e a chave pública. Mensagem própria para cada falha. */
async function fetchSecretsKey() {
  const token = process.env.GITHUB_SECRETS_TOKEN;
  if (!token) throw new Error('Defina GITHUB_SECRETS_TOKEN no .env.local (token com permissão Secrets: leitura e escrita).');
  const api = `https://api.github.com/repos/${REPO}/actions/secrets`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  let res;
  try {
    res = await fetch(`${api}/public-key`, { headers });
  } catch {
    throw new Error('Sem conexão com o GitHub (PC sem internet?).');
  }
  if (!res.ok) throw new Error(GITHUB_ERRORS[res.status] ?? `O GitHub respondeu com erro ${res.status} ao ler a chave pública.`);
  const { key, key_id: keyId } = await res.json();
  return { api, headers, key, keyId };
}

async function updateGithubSecret(value) {
  const { api, headers, key, keyId } = await fetchSecretsKey();

  await sodium.ready;
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
  const encrypted = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);

  const putRes = await fetch(`${api}/${SECRET_NAME}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encrypted, key_id: keyId }),
  });
  if (!putRes.ok) throw new Error(`O GitHub recusou a gravação do secret (HTTP ${putRes.status}).`);
}

async function setup() {
  await fetchSecretsKey(); // falha logo se o token estiver ruim, antes de pedir o login
  mkdirSync('.auth', { recursive: true });
  const context = await launchProfile(false);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(SITE, { waitUntil: 'commit', timeout: 120_000 });
  console.log('Entre com o Google e no Meu Pluggy na janela que abriu (até 5 min). Não feche a janela: ela fecha sozinha.');
  try {
    await page.waitForURL(LOGGED_IN_URL, { timeout: 300_000 });
  } catch (err) {
    if (/closed/i.test(err.message)) {
      throw new Error('A janela foi fechada antes de chegar ao painel do Meu Pluggy. Rode de novo e só feche depois que ela fechar sozinha.');
    }
    throw new Error('Passaram 5 minutos sem chegar ao painel do Meu Pluggy. Rode de novo e conclua o login.');
  }
  await page.waitForTimeout(3000);
  const encoded = await exportState(context);
  await context.close();
  console.log('Perfil salvo em .auth/profile.');
  await updateGithubSecret(encoded);
  console.log(`Secret ${SECRET_NAME} atualizado no GitHub.`);
}

/** Na tela de login: clica em "Continuar com Google" e escolhe a conta que já está logada. */
async function signInWithGoogleSession(page) {
  const google = page.getByRole('button', { name: /google/i }).or(page.getByRole('link', { name: /google/i })).first();
  if (await google.isVisible({ timeout: 15_000 }).catch(() => false)) await google.click();

  // Seletor de contas do Google: escolhe a primeira conta listada.
  const account = page.locator('[data-identifier], [data-email]').first();
  if (await account.isVisible({ timeout: 20_000 }).catch(() => false)) await account.click();

  // Algumas vezes pede uma confirmação final.
  const proceed = page.getByRole('button', { name: /continuar|continue|permitir|allow/i }).first();
  if (await proceed.isVisible({ timeout: 8_000 }).catch(() => false)) await proceed.click();
}

async function renew() {
  await fetchSecretsKey(); // não abre o navegador à toa se o token do GitHub estiver ruim
  const context = await launchProfile(true);
  const page = context.pages()[0] ?? (await context.newPage());
  try {
    await page.goto(`${SITE}/connections`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    if (!LOGGED_IN_URL.test(page.url())) {
      console.log('Sessão do Meu Pluggy expirada: entrando de novo pelo Google…');
      await signInWithGoogleSession(page);
    }
    try {
      await page.waitForURL(LOGGED_IN_URL, { timeout: 60_000 });
    } catch {
      throw new Error('Não consegui voltar ao painel. Se o Google pediu senha/verificação, rode "npm run meupluggy:setup" de novo.');
    }
    await page.waitForTimeout(3000);

    const encoded = await exportState(context);
    await updateGithubSecret(encoded);
    console.log(`${new Date().toISOString()} Sessão renovada e secret ${SECRET_NAME} atualizado.`);
  } catch (err) {
    await page.screenshot({ path: FAILURE_SHOT }).catch(() => {});
    throw err;
  } finally {
    await context.close();
  }
}

(mode === 'setup' ? setup() : mode === 'renew' ? renew() : Promise.reject(new Error('Use: setup | renew')))
  .catch((err) => {
    console.error(`${new Date().toISOString()} ${err.message}`);
    process.exit(1);
  });

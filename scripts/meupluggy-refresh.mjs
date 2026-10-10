#!/usr/bin/env node
/**
 * Clica em "Atualizar" no site do Meu Pluggy (meu.pluggy.ai), porque a API da
 * Pluggy recusa atualizar itens do MeuPluggy ("MeuPluggy item cant be updated").
 *
 *   node scripts/meupluggy-refresh.mjs login                 -> abre o Chrome para você entrar
 *                                                               uma vez e salva a sessão em .auth/
 *   node scripts/meupluggy-refresh.mjs refresh "Mercado Pago" "Nubank"
 *                                                            -> atualiza os bancos citados
 *
 * Em produção (GitHub Actions) a sessão vem do secret MEUPLUGGY_STORAGE_STATE
 * (arquivo .auth/meupluggy.json codificado em base64). A senha nunca passa por aqui:
 * o login é feito por você, no navegador, na etapa `login`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SITE = 'https://meu.pluggy.ai';
const STATE_FILE = '.auth/meupluggy.json';
const [mode, ...banks] = process.argv.slice(2);

/**
 * Abre um navegador VISÍVEL para o login manual. Prefere um navegador já
 * instalado (logins do Google costumam bloquear navegadores "de teste").
 * Ordem: BROWSER_PATH (caminho do .exe do seu navegador) > Chrome > Edge >
 * Chromium do Playwright (instale com: npx playwright install chromium).
 */
async function launchVisibleBrowser() {
  const options = { headless: false, args: ['--disable-blink-features=AutomationControlled'] };
  const attempts = [
    ...(process.env.BROWSER_PATH ? [{ executablePath: process.env.BROWSER_PATH }] : []),
    { channel: 'chrome' },
    { channel: 'msedge' },
    {},
  ];
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...options, ...attempt });
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    'Nenhum navegador encontrado. Rode "npx playwright install chromium" ou defina BROWSER_PATH com o caminho do .exe do seu navegador.'
  );
}

async function login() {
  const browser = await launchVisibleBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SITE);
  console.log('Faça login na janela que abriu. Aguardando (até 5 min)…');
  await page.waitForURL(/meu\.pluggy\.ai\/(overview|connections|flow|assets)/, { timeout: 300_000 });
  await page.waitForTimeout(3000);
  mkdirSync('.auth', { recursive: true });
  await context.storageState({ path: STATE_FILE });
  await browser.close();
  console.log(`Sessão salva em ${STATE_FILE}. Esse arquivo é um segredo: não commite nem compartilhe.`);
}

function loadState() {
  if (process.env.MEUPLUGGY_STORAGE_STATE) {
    return JSON.parse(Buffer.from(process.env.MEUPLUGGY_STORAGE_STATE, 'base64').toString('utf8'));
  }
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  throw new Error('Sem sessão do Meu Pluggy. Rode "node scripts/meupluggy-refresh.mjs login" primeiro.');
}

async function refreshBank(page, bank) {
  await page.goto(`${SITE}/connections`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  if (/login|signin|sign-in|auth/i.test(new URL(page.url()).pathname)) {
    throw new Error('Sessão do Meu Pluggy expirada. Rode o login de novo e atualize o secret MEUPLUGGY_STORAGE_STATE.');
  }

  const card = page.getByText(bank, { exact: true }).first();
  try {
    await card.waitFor({ timeout: 30_000 });
  } catch {
    throw new Error(`Conexão "${bank}" não encontrada na tela de Conexões.`);
  }
  await card.click();
  await page.waitForURL(/\/connections\/[0-9a-f-]{36}/, { timeout: 20_000 });

  const button = page.getByRole('button', { name: /atualizar/i });
  await button.waitFor({ timeout: 20_000 });
  await button.click();

  // Espera começar (botão desabilita) e terminar (volta a habilitar).
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await button.isEnabled().catch(() => true)) break;
    await page.waitForTimeout(2000);
  }
  console.log(`${bank}: atualização pedida e concluída.`);
}

async function refresh() {
  if (banks.length === 0) throw new Error('Informe ao menos um banco, ex: "Mercado Pago".');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: loadState(), locale: 'pt-BR' });
  const page = await context.newPage();
  const failures = [];
  for (const bank of banks) {
    try {
      await refreshBank(page, bank);
    } catch (err) {
      failures.push(err.message);
      console.error(`${bank}: ${err.message}`);
    }
  }
  await browser.close();
  if (failures.length > 0) process.exit(1);
}

(mode === 'login' ? login() : mode === 'refresh' ? refresh() : Promise.reject(new Error('Use: login | refresh <banco…>')))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });

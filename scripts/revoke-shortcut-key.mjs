#!/usr/bin/env node
/**
 * Invalida a chave do Atalho do iPhone (e qualquer outra sessão da sua conta): use se o
 * Atalho foi compartilhado por engano ou o iPhone foi perdido. Depois disso, o app
 * pede login de novo e você copia uma chave nova em Ajustes > Atalho do iPhone.
 *
 *   node scripts/revoke-shortcut-key.mjs                       -> usa FIREBASE_SERVICE_ACCOUNT do ambiente/.env.local
 *   node scripts/revoke-shortcut-key.mjs conta-de-servico.json -> lê a conta de serviço de um arquivo
 *
 * Também precisa de SYNC_USER_EMAIL (e-mail da sua conta). Nada é impresso além do resultado.
 * Obs.: o Firestore ainda aceita um token já emitido por até 1 hora depois de revogar.
 */
import { readFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env.local');
} catch {
  // sem .env.local: usa o ambiente
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const file = process.argv[2];
  const raw = file ? readFileSync(file, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return fail('Informe a conta de serviço: um arquivo .json como argumento ou FIREBASE_SERVICE_ACCOUNT no ambiente.');
  const email = process.env.SYNC_USER_EMAIL;
  if (!email) return fail('Defina SYNC_USER_EMAIL (o e-mail da sua conta) no ambiente ou no .env.local.');

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(initializeApp({ credential: cert(JSON.parse(raw)) }));

  const user = await auth.getUserByEmail(email);
  await auth.revokeRefreshTokens(user.uid);
  console.log('Chaves revogadas. Entre no app de novo e copie uma chave nova para o Atalho.');
}

main().catch((err) => fail(`Não foi possível revogar: ${err.message}`));

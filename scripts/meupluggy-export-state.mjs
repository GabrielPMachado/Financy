#!/usr/bin/env node
/**
 * Prepara o valor do secret MEUPLUGGY_STORAGE_STATE: pega a sessão salva em
 * .auth/meupluggy.json, mantém só os cookies do Pluggy (o GitHub limita secrets
 * a 48 KB e o navegador guarda dezenas de cookies de rastreamento), converte
 * para base64 e COPIA para a área de transferência. Nada é impresso na tela.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const state = JSON.parse(readFileSync('.auth/meupluggy.json', 'utf8'));
const trimmed = { ...state, cookies: state.cookies.filter((c) => /pluggy/i.test(c.domain)) };
const encoded = Buffer.from(JSON.stringify(trimmed)).toString('base64');

if (encoded.length > 48_000) {
  console.error(`Ainda grande demais (${encoded.length} caracteres; limite 48000).`);
  process.exit(1);
}

const clip = spawnSync(process.platform === 'win32' ? 'clip' : 'pbcopy', { input: encoded });
if (clip.status !== 0) {
  console.error('Não consegui copiar para a área de transferência.');
  process.exit(1);
}
console.log(`Copiado (${encoded.length} caracteres, ${trimmed.cookies.length} cookies). Cole no secret MEUPLUGGY_STORAGE_STATE.`);

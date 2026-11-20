/** Testes de conexão das Configurações: conta (Firebase) e Órbita. */
import { doc, getDocFromServer, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const quando = (d: Date) => {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 2) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
};

/** Renova a sessão e lê a conta direto do servidor (sem cache). */
export async function testAccount(): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Você não está conectado.');
  await u.getIdToken(true).catch(() => {
    throw new Error('A sessão expirou. Toque em "Entrar de novo".');
  });
  await getDocFromServer(doc(db, 'users', u.uid)).catch(() => {
    throw new Error('O Firebase não respondeu. Confira a internet.');
  });
  return 'Sessão renovada e dados sincronizando com a nuvem';
}

export type OrbitaStatus = { visto: Date; versao?: string } | null;

/** Último sinal do Órbita (ele grava users/{uid}/orbita/status quando abre). */
export async function orbitaStatus(): Promise<OrbitaStatus> {
  const u = auth.currentUser;
  if (!u) return null;
  const snap = await getDocFromServer(doc(db, 'users', u.uid, 'orbita', 'status'));
  if (!snap.exists()) return null;
  const v = snap.get('visto');
  const visto = v instanceof Timestamp ? v.toDate() : new Date(String(v));
  return { visto, versao: snap.get('versao') ?? undefined };
}

export async function testOrbita(): Promise<string> {
  const s = await orbitaStatus().catch(() => {
    throw new Error('Não consegui ler o status do Órbita. Confira a internet.');
  });
  if (!s) throw new Error('O Órbita ainda não respondeu. Abra o Órbita (0.16 ou mais novo) e teste de novo.');
  return `Órbita${s.versao ? ` ${s.versao}` : ''} conectado · visto ${quando(s.visto)}`;
}

export const vistoHa = quando;

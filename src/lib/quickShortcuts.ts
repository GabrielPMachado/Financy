import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { isValidQuickJob, mergeJobIntoPending, type PendingWeek, type QuickJob } from './freelance';
import type { QuickSummary } from './quickSummary';

/**
 * Ponte com o Atalho do iPhone (Tocar nas costas):
 *  - users/{uid}/resumo/atual           -> resumo que o Atalho lê (o app o mantém atualizado);
 *  - users/{uid}/trabalhosRapidos/{id}  -> fila de trabalhos freelancer enviados pelo Atalho;
 *    o app (dono do estado) os coloca nas semanas pendentes, com as mesmas regras
 *    da calculadora, e esvazia a fila.
 */
const SUMMARY_COLLECTION = 'resumo';
const SUMMARY_DOC_ID = 'atual';
const JOBS_COLLECTION = 'trabalhosRapidos';
const PENDING_COLLECTION = 'simulacoesPendentes';

export async function saveQuickSummary(uid: string, summary: QuickSummary): Promise<void> {
  await setDoc(doc(db, 'users', uid, SUMMARY_COLLECTION, SUMMARY_DOC_ID), summary);
}

export function subscribeQuickJobs(uid: string, onJobs: (jobs: Array<Partial<QuickJob>>) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, JOBS_COLLECTION),
    (snapshot) => onJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => console.error('Erro ao ler a fila de trabalhos rápidos:', error)
  );
}

const byDateAndStart = (a: QuickJob, b: QuickJob): number => `${a.date} ${a.inicio}`.localeCompare(`${b.date} ${b.inicio}`);

/**
 * Passa os trabalhos da fila para as semanas pendentes e apaga a fila, tudo num
 * único batch (ou entra tudo, ou nada). Trabalhos mal formados são descartados
 * para não travarem a fila. Devolve quantos entraram.
 */
export async function processQuickJobs(uid: string, jobs: Array<Partial<QuickJob>>): Promise<number> {
  if (jobs.length === 0) return 0;

  const pendingCollection = collection(db, 'users', uid, PENDING_COLLECTION);
  const snapshot = await getDocs(pendingCollection);
  const original = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PendingWeek);

  const valid = jobs.filter(isValidQuickJob).sort(byDateAndStart);
  const rejected = jobs.length - valid.length;
  if (rejected > 0) console.warn(`${rejected} trabalho(s) rápido(s) inválido(s) descartado(s).`);

  const merged = valid.reduce<PendingWeek[]>((acc, job) => mergeJobIntoPending(acc, job), original);
  const before = new Map(original.map((p) => [p.id, JSON.stringify(p)]));

  const batch = writeBatch(db);
  merged
    .filter((p) => before.get(p.id) !== JSON.stringify(p))
    .forEach((p) => {
      const { id, ...rest } = p;
      batch.set(doc(pendingCollection, id), JSON.parse(JSON.stringify(rest)), { merge: true });
    });
  jobs.forEach((job) => {
    if (job.id) batch.delete(doc(db, 'users', uid, JOBS_COLLECTION, job.id));
  });
  await batch.commit();
  return valid.length;
}

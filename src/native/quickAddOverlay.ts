import { registerPlugin } from '@capacitor/core';

export interface QuickAddOverlayPlugin {
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted?: boolean }>;
  startQuickAdd(): Promise<void>;
  stopQuickAdd(): Promise<void>;

  /** Empurra a sessão de login atual (uid + ID token do Firebase) pro
   *  overlay conseguir ler/escrever direto no Firestore. Chamar no login e
   *  de novo sempre que o token for renovado (onIdTokenChanged). */
  setAuthSession(options: { uid: string; idToken: string }): Promise<void>;
  /** Chamar no logout. */
  clearAuthSession(): Promise<void>;

  /** Cache local pro overlay funcionar offline. Chamar sempre que a lista
   *  correspondente mudar no app. */
  cacheCards(options: { cardsJson: string }): Promise<void>;
  cacheCardsUsage(options: { cardsUsageJson: string }): Promise<void>;
  cacheCategories(options: { categoriesJson: string }): Promise<void>;

  /** Transações criadas no overlay enquanto offline (ou sem sessão válida),
   *  ainda não sincronizadas com o Firestore. Chamar ao abrir o app
   *  (logado), gravar normalmente e então chamar clearPendingTransactions(). */
  getPendingTransactions(): Promise<{ transactionsJson: string }>;
  clearPendingTransactions(): Promise<void>;
}

// Só existe em Android nativo (Capacitor). No navegador comum (PWA no
// Chrome), essas chamadas devem ser evitadas — ver exemplo de uso abaixo.
export const QuickAddOverlay = registerPlugin<QuickAddOverlayPlugin>('QuickAddOverlay');

/*
Exemplo de uso em um componente (ex: tela de Configurações):

import { Capacitor } from '@capacitor/core';
import { QuickAddOverlay } from '../native/quickAddOverlay';

async function ativarLancamentoRapido() {
  if (Capacitor.getPlatform() !== 'android') {
    alert('Esse recurso só funciona no app Android instalado.');
    return;
  }
  const { granted } = await QuickAddOverlay.hasOverlayPermission();
  if (!granted) {
    await QuickAddOverlay.requestOverlayPermission();
    // Usuário concede na tela do sistema e volta pro app.
    // Nesse ponto ainda não sabemos se ele concedeu; oriente o usuário
    // a tocar em "Ativar" de novo, ou escute o evento de retorno:
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        const check = await QuickAddOverlay.hasOverlayPermission();
        if (check.granted) await QuickAddOverlay.startQuickAdd();
      }
    });
    return;
  }
  await QuickAddOverlay.startQuickAdd();
}
*/

import { registerPlugin } from '@capacitor/core';

export interface QuickAddOverlayPlugin {
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted?: boolean }>;
  startQuickAdd(): Promise<void>;
  stopQuickAdd(): Promise<void>;
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

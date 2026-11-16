import type { CapacitorConfig } from '@capacitor/cli';

// No iPhone o app nativo carrega o site publicado (https://financy-2d.web.app):
// fica sempre atualizado sem reinstalar o .ipa, e o login/Firebase rodam no mesmo
// domínio do PWA. O workflow build-ios.yml liga isso com CAP_REMOTE=1.
const remote = process.env.CAP_REMOTE === '1';

const config: CapacitorConfig = {
  appId: 'com.financy.app',
  appName: 'Financy',
  webDir: 'dist',
  ...(remote
    ? {
        server: {
          url: 'https://financy-2d.web.app',
          allowNavigation: ['financy-2d.web.app', '*.googleapis.com', '*.firebaseio.com', '*.firebaseapp.com'],
        },
      }
    : {}),
  appendUserAgent: 'FinancyApp',
  ios: {
    contentInset: 'never',
    backgroundColor: '#08090B',
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;

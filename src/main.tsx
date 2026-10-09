import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Aplica a classe .dark o quanto antes (antes do primeiro paint do React),
// pra não piscar tema claro por uma fração de segundo em quem prefere escuro.
// O hook useThemePreference (src/lib/theme.ts) assume o controle depois.
(() => {
  try {
    const saved = localStorage.getItem('financas_tema');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (saved !== 'light' && !!prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  } catch {
    // ignora — fica no tema claro padrão
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { TerminosPage } from './pages/TerminosPage';

export { PREGUNTAS } from './faq';

const html = (node: ReactNode) => renderToString(<StrictMode>{node}</StrictMode>);

/** HTML de cada página para el prerender del build (scripts/prerender.mjs). */
export function render(): string {
  return html(<App />);
}

export function renderTerminos(): string {
  return html(<TerminosPage />);
}

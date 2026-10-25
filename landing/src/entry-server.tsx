import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';

export { PREGUNTAS } from './faq';

/** HTML de la página para el prerender del build (scripts/prerender.mjs). */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

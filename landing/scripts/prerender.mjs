// Prerender de la landing: mete el HTML de React dentro de public/index.html para que los
// buscadores lean todo el contenido sin ejecutar JavaScript, y agrega el JSON-LD FAQPage.
// Corre después de `vite build` (cliente) y `vite build --ssr` (dist-ssr/entry-server.js).
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const htmlPath = `${root}../public/index.html`;
const ssrDir = `${root}dist-ssr`;

const { render, PREGUNTAS } = await import(`${ssrDir}/entry-server.js`);

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PREGUNTAS.map(({ p, r }) => ({
    '@type': 'Question',
    name: p,
    acceptedAnswer: { '@type': 'Answer', text: r },
  })),
};

const html = await readFile(htmlPath, 'utf8');
if (!html.includes('<div id="root"></div>') || !html.includes('<!--faq-ld-->')) {
  throw new Error('public/index.html no tiene los marcadores del prerender');
}

await writeFile(
  htmlPath,
  html
    .replace('<div id="root"></div>', `<div id="root">${render()}</div>`)
    .replace('<!--faq-ld-->', `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`),
);
await rm(ssrDir, { recursive: true, force: true });
console.log('Prerender listo: public/index.html');

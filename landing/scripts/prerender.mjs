// Prerender de la landing: mete el HTML de React dentro de cada página compilada en public/
// para que los buscadores lean todo el contenido sin ejecutar JavaScript, y agrega el JSON-LD
// FAQPage a la portada. Corre después de `vite build` (cliente) y `vite build --ssr`
// (dist-ssr/entry-server.js).
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = `${root}../public`;
const ssrDir = `${root}dist-ssr`;

const { render, renderTerminos, renderPrivacidad, PREGUNTAS } = await import(`${ssrDir}/entry-server.js`);

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PREGUNTAS.map(({ p, r }) => ({
    '@type': 'Question',
    name: p,
    acceptedAnswer: { '@type': 'Answer', text: r },
  })),
};

/** Reemplaza cada marcador de la página; falla si alguno no está, para no publicar una página vacía. */
async function prerender(file, replacements) {
  const path = `${publicDir}/${file}`;
  let html = await readFile(path, 'utf8');
  for (const [marker, value] of replacements) {
    if (!html.includes(marker)) throw new Error(`${file} no tiene el marcador ${marker}`);
    html = html.replace(marker, value);
  }
  await writeFile(path, html);
  console.log(`Prerender listo: public/${file}`);
}

await prerender('index.html', [
  ['<div id="root"></div>', `<div id="root">${render()}</div>`],
  ['<!--faq-ld-->', `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`],
]);
await prerender('terminos/index.html', [['<div id="root"></div>', `<div id="root">${renderTerminos()}</div>`]]);
await prerender('privacidad/index.html', [['<div id="root"></div>', `<div id="root">${renderPrivacidad()}</div>`]]);

await rm(ssrDir, { recursive: true, force: true });

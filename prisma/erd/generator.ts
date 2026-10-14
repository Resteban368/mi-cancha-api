// Generador de Prisma que dibuja el diagrama entidad-relación de la base de datos.
// Se ejecuta solo en cada `prisma generate` / `prisma migrate dev`, así el diagrama
// siempre refleja el schema actual. Node lo corre directo (type stripping nativo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// El paquete es CommonJS: desde ESM se toma por su export por defecto.
import generatorHelper from '@prisma/generator-helper';
import type { DMMF, GeneratorOptions } from '@prisma/generator-helper';

type Model = DMMF.Model;
type Field = DMMF.Field;

const { generatorHandler } = generatorHelper;

const DEFAULT_OUTPUT = 'docs/database';
const MERMAID_CDN =
  'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';

generatorHandler({
  onManifest: () => ({
    prettyName: 'Diagrama ER',
    defaultOutput: DEFAULT_OUTPUT,
  }),
  onGenerate: async (options: GeneratorOptions) => {
    const { models, enums } = options.dmmf.datamodel;
    const outputDir = options.generator.output?.value ?? DEFAULT_OUTPUT;
    const diagram = buildMermaid(models);

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, 'ERD.md'),
      buildMarkdown(diagram, models, enums),
    );
    writeFileSync(
      join(outputDir, 'erd.html'),
      buildHtml(diagram, models, enums),
    );
  },
});

function buildMermaid(models: readonly Model[]): string {
  const lines = ['erDiagram'];

  for (const model of models) {
    const foreignKeys = new Set(
      model.fields.flatMap((f) => f.relationFromFields ?? []),
    );
    lines.push(`  ${model.name} {`);
    for (const field of model.fields) {
      if (field.kind === 'object') continue;
      lines.push(
        `    ${attributeType(field)} ${field.name}${keys(field, foreignKeys)}${comment(field)}`,
      );
    }
    lines.push('  }');
  }

  // Cada relación se dibuja una vez: desde el lado que tiene la llave foránea o,
  // en las muchos-a-muchos implícitas (sin llave en ningún lado), desde un solo extremo.
  for (const model of models) {
    for (const field of model.fields) {
      if (field.kind !== 'object') continue;
      const parent = models.find((m) => m.name === field.type);
      const backRelation = parent?.fields.find(
        (f) => f.relationName === field.relationName && f !== field,
      );

      if (field.isList && backRelation?.isList) {
        if (model.name < field.type) {
          lines.push(
            `  ${model.name} }o--o{ ${field.type} : "${field.relationName}"`,
          );
        }
        continue;
      }
      if (!field.relationFromFields?.length) continue;

      const parentSide = field.isRequired ? '||' : '|o';
      const childSide = backRelation?.isList ? 'o{' : 'o|';
      lines.push(
        `  ${field.type} ${parentSide}--${childSide} ${model.name} : "${backRelation?.name ?? field.name}"`,
      );
    }
  }

  return lines.join('\n');
}

function attributeType(field: Field): string {
  return field.isList ? `${field.type}[]` : field.type;
}

// Los únicos compuestos no se marcan por campo: se listan aparte.
function keys(field: Field, foreignKeys: Set<string>): string {
  const markers: string[] = [];
  if (field.isId) markers.push('PK');
  if (foreignKeys.has(field.name)) markers.push('FK');
  if (field.isUnique) markers.push('UK');
  return markers.length ? ` ${markers.join(', ')}` : '';
}

function comment(field: Field): string {
  const notes: string[] = [];
  if (!field.isRequired) notes.push('opcional');
  if (field.documentation) notes.push(field.documentation.replace(/"/g, "'"));
  return notes.length ? ` "${notes.join(' · ')}"` : '';
}

interface TableInfo {
  description: string;
  fields: { name: string; type: string; keys: string; note: string }[];
  relations: { target: string; text: string }[];
}

/** Lo que muestra el panel al tocar una tabla: para qué sirve, campos y relaciones. */
function buildTableInfo(models: readonly Model[]): Record<string, TableInfo> {
  return Object.fromEntries(
    models.map((model) => {
      const foreignKeys = new Set(
        model.fields.flatMap((f) => f.relationFromFields ?? []),
      );
      const fields = model.fields
        .filter((f) => f.kind !== 'object')
        .map((f) => ({
          name: f.name,
          type: attributeType(f),
          keys: keys(f, foreignKeys).trim(),
          note: [f.isRequired ? '' : 'opcional', f.documentation ?? '']
            .filter(Boolean)
            .join(' · '),
        }));
      const relations = model.fields
        .filter((f) => f.kind === 'object')
        .map((f) => ({
          target: f.type,
          text: describeRelation(models, model, f),
        }));
      return [
        model.name,
        {
          description: model.documentation ?? 'Sin descripción.',
          fields,
          relations,
        },
      ];
    }),
  );
}

function describeRelation(
  models: readonly Model[],
  model: Model,
  field: Field,
): string {
  const target = field.type;
  const back = models
    .find((m) => m.name === target)
    ?.fields.find((f) => f.relationName === field.relationName && f !== field);

  if (field.isList && back?.isList) {
    return `Muchos a muchos con ${target}: cada ${model.name} puede tener varios ${target} y cada ${target} puede estar en varios ${model.name} (campo ${field.name}).`;
  }
  if (field.isList) {
    return `Tiene cero o muchos ${target} (campo ${field.name}). Cada ${target} apunta a este ${model.name}.`;
  }
  if (field.relationFromFields?.length) {
    const fk = field.relationFromFields.join(', ');
    const link = field.isRequired
      ? `Pertenece siempre a un ${target}`
      : `Puede pertenecer a un ${target}`;
    const cardinality = back?.isList
      ? `un ${target} puede tener varios ${model.name}`
      : `un ${target} tiene como máximo un ${model.name}`;
    return `${link} mediante ${fk}; ${cardinality}. ${onDeleteText(model.name, target, field, !!back?.isList)}`;
  }
  return `Puede tener un ${target} (campo ${field.name}); la llave foránea está en ${target}.`;
}

function onDeleteText(
  model: string,
  target: string,
  field: Field,
  many: boolean,
): string {
  const action =
    field.relationOnDelete ?? (field.isRequired ? 'Restrict' : 'SetNull');
  switch (action) {
    case 'Cascade':
      return many
        ? `Si se borra el ${target}, se borran también sus ${model}.`
        : `Si se borra el ${target}, se borra también su ${model}.`;
    case 'SetNull':
      return `Si se borra el ${target}, el ${model} se conserva sin ${target}.`;
    case 'Restrict':
    case 'NoAction':
      return `No se puede borrar un ${target} mientras tenga ${model}.`;
    default:
      return `Al borrar el ${target}: ${action}.`;
  }
}

function compoundUniqueNotes(models: readonly Model[]): string[] {
  return models.flatMap((model) =>
    model.uniqueFields
      .filter((fields) => fields.length > 1)
      .map((fields) => `${model.name}: (${fields.join(', ')})`),
  );
}

function buildMarkdown(
  diagram: string,
  models: readonly Model[],
  enums: readonly DMMF.DatamodelEnum[],
): string {
  const enumRows = enums
    .map(
      (e) =>
        `| \`${e.name}\` | ${e.values.map((v) => `\`${v.name}\``).join(', ')} |`,
    )
    .join('\n');
  const uniques = compoundUniqueNotes(models)
    .map((note) => `- ${note}`)
    .join('\n');
  const tables = Object.entries(buildTableInfo(models))
    .map(
      ([name, info]) =>
        `### ${name}\n\n${info.description}\n\n${info.relations
          .map((r) => `- **${r.target}**: ${r.text}`)
          .join('\n')}`,
    )
    .join('\n\n');

  return `<!-- Archivo generado por prisma/erd/generator.ts. No editar a mano: se regenera con \`prisma generate\`. -->

# Diagrama de la base de datos

Fuente: \`prisma/schema.prisma\`. Versión navegable: [erd.html](./erd.html).

\`\`\`mermaid
${diagram}
\`\`\`

**Leyenda:** PK llave primaria · FK llave foránea · UK única · \`||\` exactamente uno · \`|o\` cero o uno · \`o{\` cero o muchos · \`}o--o{\` muchos a muchos.

## Tablas

${tables}

## Enums

| Enum | Valores |
|---|---|
${enumRows}
${uniques ? `\n## Únicos compuestos\n\n${uniques}\n` : ''}`;
}

function buildHtml(
  diagram: string,
  models: readonly Model[],
  enums: readonly DMMF.DatamodelEnum[],
): string {
  const enumCards = enums
    .map(
      (e) =>
        `      <div class="card"><h3>${e.name}</h3><ul>${e.values
          .map((v) => `<li>${v.name}</li>`)
          .join('')}</ul></div>`,
    )
    .join('\n');
  const uniques = compoundUniqueNotes(models)
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join('');
  const tableButtons = models
    .map(
      (m) =>
        `<button type="button" class="chip" data-table="${m.name}">${m.name}</button>`,
    )
    .join('');
  // `<` escapado para que ningún texto del schema pueda cerrar el <script>.
  const tableInfo = JSON.stringify(buildTableInfo(models)).replace(
    /</g,
    '\\u003c',
  );

  return `<!doctype html>
<!-- Archivo generado por prisma/erd/generator.ts. No editar a mano. -->
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mi Cancha · Diagrama ER</title>
  <style>
    :root { --bg: #f7f8fa; --fg: #1d2330; --muted: #5b6475; --card: #fff; --border: #dde1e8; --accent: #1f8a4c; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #12151b; --fg: #e6e9ef; --muted: #9aa3b2; --card: #1b2029; --border: #2c333f; --accent: #4cc27f; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, sans-serif; }
    main { max-width: 1400px; margin: 0 auto; }
    h1 { margin: 0 0 4px; font-size: 1.6rem; }
    h2 { margin: 32px 0 12px; font-size: 1.15rem; }
    h3 { margin: 0 0 6px; font-size: .95rem; color: var(--accent); }
    p.sub { margin: 0 0 20px; color: var(--muted); }
    .diagram { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; overflow: auto; }
    .diagram svg { max-width: none; height: auto; }
    .legend { color: var(--muted); font-size: .85rem; margin-top: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
    .card ul { margin: 0; padding-left: 18px; font-family: ui-monospace, monospace; font-size: .85rem; }
    code, li { word-break: break-word; }
    .layout { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr) 380px; } .panel { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: auto; } }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .chip { font: inherit; font-size: .85rem; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--fg); cursor: pointer; }
    .chip:hover, .chip[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
    .panel { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; align-self: start; }
    .panel h2 { margin: 0 0 6px; color: var(--accent); }
    .panel h4 { margin: 16px 0 6px; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    .panel p { margin: 0; }
    .panel .hint { color: var(--muted); }
    .panel table { width: 100%; border-collapse: collapse; font-size: .83rem; }
    .panel td { padding: 5px 4px; border-top: 1px solid var(--border); vertical-align: top; }
    .panel td:first-child { font-family: ui-monospace, monospace; white-space: nowrap; }
    .panel .muted { color: var(--muted); }
    .panel ul.rel { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 8px; font-size: .88rem; }
    .panel ul.rel li { border-left: 3px solid var(--accent); padding-left: 8px; }
    .link { font: inherit; padding: 0; border: 0; background: none; color: var(--accent); cursor: pointer; text-decoration: underline; }
    .zoom { display: flex; gap: 6px; margin-bottom: 8px; }
    .diagram.fit svg { width: 100% !important; max-width: 100% !important; height: auto; }
    .diagram g.er-clickable { cursor: pointer; }
    .diagram g.er-selected rect { stroke: var(--accent) !important; stroke-width: 3px !important; }
    .diagram g.er-related rect { stroke: var(--accent) !important; stroke-width: 1.5px !important; stroke-dasharray: 4 3; }
  </style>
</head>
<body>
  <main>
    <h1>Mi Cancha · Base de datos</h1>
    <p class="sub">${models.length} tablas · ${enums.length} enums · generado desde <code>prisma/schema.prisma</code></p>
    <div class="layout">
      <div>
        <div class="chips" role="toolbar" aria-label="Tablas">${tableButtons}</div>
        <div class="zoom"><button type="button" class="chip" id="fit" aria-pressed="true">Ajustar al ancho</button><button type="button" class="chip" id="full" aria-pressed="false">Tamaño real</button></div>
        <div class="diagram fit"><pre class="mermaid">
${escapeHtml(diagram)}
        </pre></div>
      </div>
      <aside class="panel" id="panel" aria-live="polite">
        <p class="hint">Toca una tabla en el diagrama (o arriba) para ver para qué sirve, sus campos y cómo se relaciona con las demás.</p>
      </aside>
    </div>
    <p class="legend">PK llave primaria · FK llave foránea · UK única · líneas: <code>||</code> uno · <code>|o</code> cero o uno · <code>o{</code> muchos · <code>}o--o{</code> muchos a muchos</p>
    <h2>Enums</h2>
    <div class="grid">
${enumCards}
    </div>
    ${uniques ? `<h2>Únicos compuestos</h2><ul>${uniques}</ul>` : ''}
  </main>
  <script type="module">
    import mermaid from '${MERMAID_CDN}';
    const TABLES = ${tableInfo};
    const names = Object.keys(TABLES).sort((a, b) => b.length - a.length);
    const panel = document.getElementById('panel');
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const nodes = new Map();

    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', er: { useMaxWidth: false } });
    await mermaid.run({ querySelector: '.mermaid' });

    // Cada entidad del SVG es un <g> cuyo id incluye el nombre de la tabla.
    for (const g of document.querySelectorAll('.diagram svg g[id]')) {
      const name = names.find((n) => g.id.includes('-' + n + '-') || g.id.endsWith('-' + n));
      if (!name || nodes.has(name) || !g.querySelector('rect, path')) continue;
      nodes.set(name, g);
      g.classList.add('er-clickable');
      g.addEventListener('click', () => show(name));
    }

    document.querySelectorAll('.chip[data-table]').forEach((b) => b.addEventListener('click', () => show(b.dataset.table)));
    const diagram = document.querySelector('.diagram');
    const setFit = (fit) => {
      diagram.classList.toggle('fit', fit);
      document.getElementById('fit').setAttribute('aria-pressed', String(fit));
      document.getElementById('full').setAttribute('aria-pressed', String(!fit));
    };
    document.getElementById('fit').addEventListener('click', () => setFit(true));
    document.getElementById('full').addEventListener('click', () => setFit(false));
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-goto]');
      if (t) show(t.dataset.goto);
    });

    function show(name) {
      const info = TABLES[name];
      const related = new Set(info.relations.map((r) => r.target));
      for (const [n, g] of nodes) {
        g.classList.toggle('er-selected', n === name);
        g.classList.toggle('er-related', related.has(n) && n !== name);
      }
      document.querySelectorAll('.chip[data-table]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.table === name)));
      nodes.get(name)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      const fields = info.fields.map((f) =>
        '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.type) + (f.keys ? ' <b>' + esc(f.keys) + '</b>' : '') +
        (f.note ? '<div class="muted">' + esc(f.note) + '</div>' : '') + '</td></tr>').join('');
      const relations = info.relations.length
        ? '<ul class="rel">' + info.relations.map((r) =>
            '<li><button type="button" class="link" data-goto="' + esc(r.target) + '">' + esc(r.target) + '</button> · ' + esc(r.text) + '</li>').join('') + '</ul>'
        : '<p class="muted">No se relaciona con otras tablas.</p>';
      panel.innerHTML =
        '<h2>' + esc(name) + '</h2><p>' + esc(info.description) + '</p>' +
        '<h4>Relaciones</h4>' + relations +
        '<h4>Campos</h4><table>' + fields + '</table>';
      if (matchMedia('(max-width: 1099px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  </script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

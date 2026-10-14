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

  return `<!-- Archivo generado por prisma/erd/generator.ts. No editar a mano: se regenera con \`prisma generate\`. -->

# Diagrama de la base de datos

Fuente: \`prisma/schema.prisma\`. Versión navegable: [erd.html](./erd.html).

\`\`\`mermaid
${diagram}
\`\`\`

**Leyenda:** PK llave primaria · FK llave foránea · UK única · \`||\` exactamente uno · \`|o\` cero o uno · \`o{\` cero o muchos · \`}o--o{\` muchos a muchos.

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
  </style>
</head>
<body>
  <main>
    <h1>Mi Cancha · Base de datos</h1>
    <p class="sub">${models.length} tablas · ${enums.length} enums · generado desde <code>prisma/schema.prisma</code></p>
    <div class="diagram"><pre class="mermaid">
${escapeHtml(diagram)}
    </pre></div>
    <p class="legend">PK llave primaria · FK llave foránea · UK única · líneas: <code>||</code> uno · <code>|o</code> cero o uno · <code>o{</code> muchos · <code>}o--o{</code> muchos a muchos</p>
    <h2>Enums</h2>
    <div class="grid">
${enumCards}
    </div>
    ${uniques ? `<h2>Únicos compuestos</h2><ul>${uniques}</ul>` : ''}
  </main>
  <script type="module">
    import mermaid from '${MERMAID_CDN}';
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: true, theme: dark ? 'dark' : 'default', er: { useMaxWidth: false } });
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

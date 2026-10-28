// Genera la documentación de la API a partir de la app compilada (npm run docs:api):
//   docs/api/openapi.json                     especificación OpenAPI 3
//   docs/api/ENDPOINTS.md                     referencia de endpoints en Markdown
//   docs/api/mi-cancha.postman_collection.json colección de Postman (v2.1)
// Usa el modo preview de Nest: no instancia providers ni se conecta a la base.
import { mkdirSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../dist/app.module.js';
import { API_PREFIX } from '../dist/setup-app.js';

const OUT = 'docs/api';
const PREFIX = `/${API_PREFIX}`;

const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
app.setGlobalPrefix(API_PREFIX);
const spec = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Mi Cancha API')
    .setDescription(
      'Backend de la app Mi Cancha: reservas de canchas deportivas',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local')
    .addServer('https://app.micanchaapp.com', 'Producción')
    .addBearerAuth()
    .build(),
);
await app.close();

const schemas = spec.components.schemas;
// Primero las rutas sin parámetros (listados y altas): así llenan los ids que
// usan las siguientes al correr la colección en orden.
const pathParamCount = (path) => path.split('{').length - 1;
const operations = Object.entries(spec.paths)
  .flatMap(([path, item]) =>
    Object.entries(item).map(([method, op]) => ({ path, method, op })),
  )
  .sort((a, b) => pathParamCount(a.path) - pathParamCount(b.path));

// ── Grupos: por quién consume cada endpoint ─────────────────────────────────

const GROUPS = [
  {
    name: 'Salud y autenticación',
    tags: ['health', 'auth'],
    auth: 'none',
    flat: true,
  },
  {
    name: 'Negocio (app y panel)',
    tags: (t) => t.startsWith('business') || t === 'catalogs',
    auth: 'businessToken',
  },
  {
    name: 'Reservas en línea: público',
    tags: ['public / reservas en línea'],
    auth: 'none',
  },
  { name: 'Reservas en línea: jugador', tags: ['player'], auth: 'playerToken' },
  {
    name: 'Super admin',
    tags: (t) => t.startsWith('admin'),
    auth: 'adminToken',
  },
  { name: 'Imágenes', tags: ['images'], auth: 'none' },
];
const groupOf = (tag) =>
  GROUPS.find((g) =>
    typeof g.tags === 'function' ? g.tags(tag) : g.tags.includes(tag),
  );

const ROLE_BY_TOKEN = {
  businessToken: 'ADMIN_NEGOCIO',
  playerToken: 'JUGADOR',
  adminToken: 'SUPER_ADMIN',
};

// ── Esquemas → ejemplos ─────────────────────────────────────────────────────

const deref = (schema) =>
  schema?.$ref ? schemas[schema.$ref.split('/').pop()] : schema;

/** Variables de Postman para los ids que se encadenan entre requests. */
const ID_VARIABLES = {
  courtId: 'courtId',
  customerId: 'customerId',
  reservationId: 'reservationId',
  planId: 'planId',
  paymentMethodId: 'paymentMethodId',
  surfaceId: 'courtSurfaceId',
  courtSurfaceId: 'courtSurfaceId',
};

/** Valores para strings sin `example` en el DTO, según el nombre del campo. */
const STRING_FALLBACKS = {
  name: 'Juan Pérez',
  fullName: 'Juan Pérez',
  phone: '+57 300 123 4567',
  email: 'jugador@example.com',
  password: 'Contrasena2026!',
  reason: 'El cliente pidió cancelar',
  slug: 'golazo',
};

/** Campos que se agregan a ejemplos concretos para que funcionen tal cual. */
const WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const EXAMPLE_EXTRAS = {
  CreateReservationDto: { courtId: '{{courtId}}' },
  CreateCourtDto: {
    name: 'Cancha 1',
    schedules: WEEK.map((dayOfWeek) => ({
      dayOfWeek,
      isOpen: true,
      openTime: '06:00',
      closeTime: '23:00',
    })),
  },
};

function example(schema, key = '', depth = 0) {
  const extras = schema?.$ref
    ? EXAMPLE_EXTRAS[schema.$ref.split('/').pop()]
    : undefined;
  schema = deref(schema);
  if (!schema || depth > 6) return null;
  if (schema.allOf) return example(schema.allOf[0], key, depth);
  if (schema.oneOf) return example(schema.oneOf[0], key, depth);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.format === 'uuid') return `{{${ID_VARIABLES[key] ?? key}}}`;
  switch (schema.type) {
    case 'object': {
      const out = {};
      const required = new Set(schema.required ?? []);
      for (const [prop, sub] of Object.entries(schema.properties ?? {})) {
        // Solo los obligatorios y los que traen ejemplo, para que el body sea usable.
        const resolved = deref(sub);
        const hasExample =
          resolved?.example !== undefined ||
          deref(resolved?.allOf?.[0])?.type === 'object';
        if (required.has(prop) || hasExample)
          out[prop] = example(sub, prop, depth + 1);
      }
      return { ...out, ...extras };
    }
    case 'array':
      return [example(schema.items, key, depth + 1)];
    case 'string':
      if (schema.format === 'date-time') return '2026-10-20T19:00:00-05:00';
      return STRING_FALLBACKS[key] ?? `<${key || 'texto'}>`;
    case 'number':
    case 'integer':
      return schema.minimum ?? 0;
    case 'boolean':
      return true;
    default:
      return null;
  }
}

const schemaAnchor = (name) => name.toLowerCase();

function typeLabel(schema, link = false) {
  if (!schema) return '';
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    return link ? `[${name}](#${schemaAnchor(name)})` : name;
  }
  if (schema.allOf) return typeLabel(schema.allOf[0], link);
  if (schema.oneOf)
    return schema.oneOf.map((s) => typeLabel(s, link)).join(' | ');
  if (schema.enum) return schema.enum.map((v) => `\`${v}\``).join(' | ');
  if (schema.type === 'array') return `${typeLabel(schema.items, link)}[]`;
  return schema.format
    ? `${schema.type} (${schema.format})`
    : (schema.type ?? 'object');
}

function constraints(schema) {
  const parts = [];
  if (schema.minimum !== undefined) parts.push(`mín. ${schema.minimum}`);
  if (schema.maximum !== undefined) parts.push(`máx. ${schema.maximum}`);
  if (schema.minLength !== undefined)
    parts.push(`${schema.minLength}+ caracteres`);
  if (schema.maxLength !== undefined)
    parts.push(`hasta ${schema.maxLength} caracteres`);
  if (schema.minItems !== undefined)
    parts.push(`${schema.minItems}+ elementos`);
  if (schema.pattern) parts.push(`patrón \`${schema.pattern}\``);
  if (schema.default !== undefined)
    parts.push(`por defecto \`${schema.default}\``);
  return parts.join(', ');
}

const cell = (text) =>
  String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

// ── Postman ─────────────────────────────────────────────────────────────────

const pathParamVariable = (path, name) => {
  if (name === 'slug') return 'slug';
  if (name === 'slot') return 'photoSlot';
  if (name !== 'id') return ID_VARIABLES[name] ?? name;
  if (path.includes('/admin/clients/')) return 'clientId';
  if (path.includes('/admin/plans/')) return 'planId';
  if (path.includes('/amenities/')) return 'amenityId';
  if (path.includes('/payment-methods/')) return 'paymentMethodId';
  if (path.includes('/court-surfaces/')) return 'courtSurfaceId';
  if (path.includes('/business/courts/')) return 'courtId';
  if (path.includes('/business/reservations/')) return 'reservationId';
  if (path.includes('/business/payments/')) return 'paymentId';
  if (path.includes('/images/')) return 'imageId';
  return 'id';
};

const bearer = (variable) => ({
  type: 'bearer',
  bearer: [{ key: 'token', value: `{{${variable}}}`, type: 'string' }],
});

/** Tras estas peticiones se guardan tokens e ids en variables de la colección. */
const CAPTURES = {
  'post /auth/business/login': [['businessToken', 'json.accessToken']],
  'post /auth/business/register': [['businessToken', 'json.accessToken']],
  'post /public/auth/login': [['playerToken', 'json.accessToken']],
  'post /public/auth/register': [['playerToken', 'json.accessToken']],
  'post /business/courts': [['courtId', 'json.id']],
  'post /business/customers': [['customerId', 'json.id']],
  'post /business/reservations': [['reservationId', 'json.id']],
  'post /player/businesses/{slug}/reservations': [['reservationId', 'json.id']],
  'post /admin/clients': [['clientId', 'json.id']],
  'post /admin/plans': [['planId', 'json.id']],
  'post /admin/catalogs/amenities': [['amenityId', 'json.id']],
  'post /admin/catalogs/payment-methods': [['paymentMethodId', 'json.id']],
  'post /admin/catalogs/court-surfaces': [['courtSurfaceId', 'json.id']],
  'get /business/online-booking': [['slug', 'json.slug']],
};

/** Los listados llenan el id con el primer elemento si la variable está vacía. */
const FIRST_ID_CAPTURES = {
  'get /business/courts': 'courtId',
  'get /business/customers': 'customerId',
  'get /business/reservations': 'reservationId',
  'get /business/payments': 'paymentId',
  'get /admin/clients': 'clientId',
  'get /admin/plans': 'planId',
  'get /admin/catalogs/amenities': 'amenityId',
  'get /admin/catalogs/payment-methods': 'paymentMethodId',
  'get /admin/catalogs/court-surfaces': 'courtSurfaceId',
};

function captureScript(key) {
  const firstId = FIRST_ID_CAPTURES[key];
  const captures =
    CAPTURES[key] ??
    (firstId && [
      [firstId, '(Array.isArray(json) ? json : json.items)?.[0]?.id'],
    ]);
  if (!captures) return [];
  // Los ids de un listado no pisan uno que ya hayas elegido.
  const guard = (variable) =>
    firstId ? ` && !pm.collectionVariables.get('${variable}')` : '';
  return [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'if (pm.response.code < 300) {',
          '  const json = pm.response.json();',
          ...captures.map(
            ([variable, expr]) =>
              `  if (${expr}${guard(variable)}) pm.collectionVariables.set('${variable}', ${expr});`,
          ),
          '}',
        ],
      },
    },
  ];
}

function postmanRequest({ path, method, op }, group) {
  const relative = path.slice(PREFIX.length);
  const params = op.parameters ?? [];
  const pathVars = params.filter((p) => p.in === 'path');
  const query = params.filter((p) => p.in === 'query');
  const rawPath = relative.replace(/\{(\w+)\}/g, (_, name) => `:${name}`);
  const queryItems = query.map((p) => ({
    key: p.name,
    // date apunta a {{date}}, que el pre-request de la colección llena con mañana.
    value:
      p.name === 'date' ? '{{date}}' : String(example(p.schema, p.name) ?? ''),
    description: p.description,
    // Los opcionales quedan apagados para activarlos a mano.
    disabled: !(p.required && p.schema?.default === undefined),
  }));
  const enabledQuery = queryItems.filter((q) => !q.disabled);
  const raw =
    `{{baseUrl}}${rawPath}` +
    (enabledQuery.length
      ? `?${enabledQuery.map((q) => `${q.key}=${q.value}`).join('&')}`
      : '');

  const request = {
    method: method.toUpperCase(),
    header: [],
    url: {
      raw,
      host: ['{{baseUrl}}'],
      path: rawPath.split('/').filter(Boolean),
      query: queryItems,
      variable: pathVars.map((p) => ({
        key: p.name,
        value:
          p.name === 'slot'
            ? '{{photoSlot}}'
            : `{{${pathParamVariable(path, p.name)}}}`,
        description: p.schema?.enum
          ? `Uno de: ${p.schema.enum.join(', ')}`
          : p.description,
      })),
    },
    description: op.summary,
  };
  if (!op.security) request.auth = { type: 'noauth' };
  // Endpoints con token en una carpeta pública (p. ej. GET /auth/me).
  else if (group.auth === 'none') request.auth = bearer('businessToken');

  const content = op.requestBody?.content ?? {};
  if (content['multipart/form-data']) {
    request.body = {
      mode: 'formdata',
      formdata: [
        {
          key: 'image',
          type: 'file',
          src: [],
          description: 'JPG o PNG, máx. 4 MB',
        },
      ],
    };
  } else if (content['application/json']) {
    request.header.push({ key: 'Content-Type', value: 'application/json' });
    request.body = {
      mode: 'raw',
      raw: JSON.stringify(example(content['application/json'].schema), null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return {
    name: op.summary ?? `${method.toUpperCase()} ${relative}`,
    request,
    event: captureScript(`${method} ${relative}`),
  };
}

const folders = GROUPS.map((group) => {
  const ops = operations.filter((o) => groupOf(o.op.tags?.[0] ?? '') === group);
  const byTag = Map.groupBy(ops, (o) => o.op.tags?.[0] ?? 'otros');
  const item =
    byTag.size > 1 && !group.flat
      ? [...byTag].map(([tag, list]) => ({
          name: tag,
          item: list.map((o) => postmanRequest(o, group)),
        }))
      : ops.map((o) => postmanRequest(o, group));
  return {
    name: group.name,
    item,
    auth: group.auth === 'none' ? { type: 'noauth' } : bearer(group.auth),
  };
});

// El login de super admin usa el mismo endpoint que el de negocio.
const authFolder = folders[0];
const businessLogin = authFolder.item.find((i) =>
  i.request.url.raw.endsWith('/auth/business/login'),
);
authFolder.item.splice(authFolder.item.indexOf(businessLogin) + 1, 0, {
  ...structuredClone(businessLogin),
  name: 'Iniciar sesión como super admin (guarda adminToken)',
  request: {
    ...structuredClone(businessLogin.request),
    body: {
      ...businessLogin.request.body,
      raw: JSON.stringify(
        { email: '{{adminEmail}}', password: '{{adminPassword}}' },
        null,
        2,
      ),
    },
  },
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "if (pm.response.code < 300) pm.collectionVariables.set('adminToken', pm.response.json().accessToken);",
        ],
      },
    },
  ],
});
businessLogin.name += ' (guarda businessToken)';
businessLogin.request.body.raw = JSON.stringify(
  { email: '{{businessEmail}}', password: '{{businessPassword}}' },
  null,
  2,
);

const variables = {
  baseUrl: `http://localhost:3000${PREFIX}`,
  businessEmail: 'admin@micancha.co',
  // Las contraseñas no se publican: cada quien las llena en Postman.
  businessPassword: '',
  adminEmail: 'superadmin@micancha.co',
  adminPassword: '',
  businessToken: '',
  playerToken: '',
  adminToken: '',
  date: '',
  slug: '',
  photoSlot: 'MAIN',
  courtId: '',
  customerId: '',
  reservationId: '',
  paymentId: '',
  clientId: '',
  planId: '',
  amenityId: '',
  paymentMethodId: '',
  courtSurfaceId: '',
  imageId: '',
};

const collection = {
  info: {
    name: 'Mi Cancha API',
    description:
      'Colección generada desde la especificación OpenAPI (npm run docs:api). ' +
      'Empieza por «Salud y autenticación»: los logins guardan el token en businessToken, ' +
      'playerToken o adminToken, y los POST de creación guardan el id creado (courtId, customerId…). ' +
      'Para producción cambia baseUrl a https://mi-cancha-api.vercel.app/api/v1. ' +
      'Guía completa: docs/api/README.md.',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// date por defecto: mañana en hora de Colombia (UTC-5), en formato YYYY-MM-DD.',
          "if (!pm.collectionVariables.get('date')) {",
          '  const tomorrow = new Date(Date.now() - 5 * 3600e3 + 24 * 3600e3);',
          "  pm.variables.set('date', tomorrow.toISOString().slice(0, 10));",
          '}',
        ],
      },
    },
  ],
  item: folders,
  variable: Object.entries(variables).map(([key, value]) => ({ key, value })),
};

// ── Markdown ────────────────────────────────────────────────────────────────

function schemaTable(name, link = false) {
  const schema = schemas[name];
  if (!schema?.properties) return '';
  const required = new Set(schema.required ?? []);
  const rows = Object.entries(schema.properties).map(([prop, sub]) => {
    const resolved = sub.allOf ? { ...deref(sub.allOf[0]), ...sub } : sub;
    const notes = [resolved.description, constraints(resolved)]
      .filter(Boolean)
      .join(' · ');
    const ex =
      resolved.example !== undefined
        ? ` Ej.: \`${JSON.stringify(resolved.example)}\``
        : '';
    return `| \`${prop}\` | ${cell(typeLabel(sub, link))} | ${required.has(prop) ? 'sí' : 'no'} | ${cell(notes + ex)} |`;
  });
  return [
    `**\`${name}\`**`,
    '',
    '| Campo | Tipo | Obligatorio | Notas |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

/** Esquemas de entrada referenciados (incluidos los anidados). */
function referencedSchemas(schema, seen = new Set()) {
  if (!schema) return seen;
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (seen.has(name)) return seen;
    seen.add(name);
    return referencedSchemas(schemas[name], seen);
  }
  for (const sub of [
    ...(schema.allOf ?? []),
    ...(schema.oneOf ?? []),
    schema.items,
  ].filter(Boolean)) {
    referencedSchemas(sub, seen);
  }
  for (const sub of Object.values(schema.properties ?? {}))
    referencedSchemas(sub, seen);
  return seen;
}

function responseOf(op) {
  const [status, response] =
    Object.entries(op.responses ?? {}).find(([code]) => code.startsWith('2')) ??
    [];
  const schema = response?.content?.['application/json']?.schema;
  return {
    status,
    schema,
    type: schema
      ? typeLabel(schema, true)
      : status === '204'
        ? 'sin contenido'
        : '—',
  };
}

function endpointMarkdown({ path, method, op }) {
  const relative = path.slice(PREFIX.length);
  const group = groupOf(op.tags?.[0] ?? '');
  const lines = [
    `#### \`${method.toUpperCase()} ${relative}\``,
    '',
    op.summary ?? '',
    '',
  ];
  const role = op.security
    ? (ROLE_BY_TOKEN[group.auth] ?? 'cualquier usuario autenticado')
    : null;
  lines.push(
    `- **Acceso:** ${role ? `Bearer token · rol \`${role}\`` : 'público'}`,
  );
  const { status, type } = responseOf(op);
  if (status) lines.push(`- **Respuesta:** \`${status}\` · ${cell(type)}`);
  lines.push('');

  const params = op.parameters ?? [];
  if (params.length) {
    lines.push(
      '| Parámetro | En | Tipo | Obligatorio | Notas |',
      '|---|---|---|---|---|',
    );
    for (const p of params) {
      const required = p.required && p.schema?.default === undefined;
      const notes = [p.description, constraints(p.schema ?? {})]
        .filter(Boolean)
        .join(' · ');
      const ex =
        p.schema?.example !== undefined ? ` Ej.: \`${p.schema.example}\`` : '';
      lines.push(
        `| \`${p.name}\` | ${p.in} | ${cell(typeLabel(p.schema))} | ${required ? 'sí' : 'no'} | ${cell(notes + ex)} |`,
      );
    }
    lines.push('');
  }

  const content = op.requestBody?.content ?? {};
  if (content['multipart/form-data']) {
    lines.push(
      '**Body** `multipart/form-data`: campo `image` (archivo JPG o PNG, máx. 4 MB).',
      '',
    );
  } else if (content['application/json']) {
    const schema = content['application/json'].schema;
    lines.push('**Body** `application/json`', '');
    for (const name of referencedSchemas(schema)) lines.push(schemaTable(name));
    lines.push(
      '<details><summary>Ejemplo</summary>',
      '',
      '```json',
      JSON.stringify(example(schema), null, 2),
      '```',
      '',
      '</details>',
      '',
    );
  }
  return lines.join('\n');
}

// Modelos que devuelve la API (con sus anidados), para el apéndice.
const responseSchemas = new Set();
for (const { op } of operations)
  referencedSchemas(responseOf(op).schema, responseSchemas);

const toc = [];
const sections = [];
for (const group of GROUPS) {
  const ops = operations.filter((o) => groupOf(o.op.tags?.[0] ?? '') === group);
  if (!ops.length) continue;
  const anchor = group.name
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9 ]/g, '')
    .replace(/ +/g, '-');
  toc.push(`- [${group.name}](#${anchor}) (${ops.length})`);
  sections.push(`## ${group.name}`, '');
  sections.push('| Método | Ruta | Descripción |', '|---|---|---|');
  for (const { path, method, op } of ops) {
    sections.push(
      `| ${method.toUpperCase()} | \`${path.slice(PREFIX.length)}\` | ${cell(op.summary)} |`,
    );
  }
  sections.push('');
  for (const [tag, list] of Map.groupBy(
    ops,
    (o) => o.op.tags?.[0] ?? 'otros',
  )) {
    sections.push(`### ${tag}`, '', ...list.map(endpointMarkdown));
  }
}

const markdown = [
  '# Mi Cancha API — referencia de endpoints',
  '',
  '> Generado por `npm run docs:api` a partir del código (decoradores de Swagger y DTOs). No lo edites a mano.',
  '> Guía de uso (autenticación, errores, flujos): [README.md](README.md).',
  '',
  `Base URL: \`http://localhost:3000${PREFIX}\` (local) · \`https://mi-cancha-api.vercel.app${PREFIX}\` (producción). ${operations.length} endpoints.`,
  '',
  ...toc,
  `- [Modelos de respuesta](#modelos-de-respuesta) (${responseSchemas.size})`,
  '',
  ...sections,
  '## Modelos de respuesta',
  '',
  ...[...responseSchemas].sort().map((name) => {
    const table = schemaTable(name, true);
    return table ? `<a id="${schemaAnchor(name)}"></a>\n\n${table}` : '';
  }),
].join('\n');

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/openapi.json`, `${JSON.stringify(spec, null, 2)}\n`);
writeFileSync(`${OUT}/ENDPOINTS.md`, `${markdown.trimEnd()}\n`);
writeFileSync(
  `${OUT}/mi-cancha.postman_collection.json`,
  `${JSON.stringify(collection, null, 2)}\n`,
);
console.log(
  `docs/api: ${operations.length} endpoints, ${Object.keys(schemas).length} esquemas`,
);

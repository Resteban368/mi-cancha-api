# Marca Mi Cancha: paleta, logos y modos claro/oscuro

## Paleta

| Rol | Valor | Uso |
|---|---|---|
| Verde esmeralda | `#00C853` | Relleno de botones, marca, estados activos (`--accent`) |
| Negro azulado | `#0B1F28` | Fondo del modo oscuro y texto del modo claro |
| Blanco | `#F8FAFC` | Fondo del modo claro y texto del modo oscuro |

Tipografía de marca: **Montserrat** (Bold/ExtraBold), usada en títulos y en el nombre «Mi Cancha».

### Tokens (web de reservas y panel admin)

Definidos en `web/src/index.css` y `admin/src/index.css`: claro en `:root`, oscuro en
`:root[data-theme='dark']` (y, sin JavaScript, por `prefers-color-scheme`).

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#F8FAFC` | `#0B1F28` |
| `--surface` | `#FFFFFF` | `#102B37` |
| `--surface-2` | `#EDF2F1` | `#163845` |
| `--border` | `#D9E3E1` | `#1F4352` |
| `--fg` / `--fg-2` / `--fg-3` | `#0B1F28` / `#3C5360` / `#5B717C` | `#F8FAFC` / `#BFD0D8` / `#8AA3AE` |
| `--accent` (relleno) | `#00C853` | `#00C853` |
| `--accent-fg` (texto sobre relleno) | `#0B1F28` | `#0B1F28` |
| `--accent-text` (verde como texto) | `#007A33` | `#00C853` |
| `--danger` / `--danger-fg` | `#C62828` / `#FFFFFF` | `#FF8A80` / `#0B1F28` |
| `--warn` | `#8A5A00` | `#FFD54F` |

Regla: el verde `#00C853` no tiene contraste suficiente como **texto** sobre blanco, por eso el texto
verde usa `text-accent-text` (más oscuro en claro) y los rellenos usan `bg-accent` con `text-accent-fg`.

## Modo claro / oscuro

`src/lib/theme.ts` (en `web/` y `admin/`) guarda la preferencia (`mi-cancha-theme` en localStorage:
`light`, `dark` o ninguna = seguir al sistema) y pone `data-theme` en `<html>`. Un script en
`index.html` lo aplica antes de pintar para evitar el parpadeo. `ThemeToggle` es el selector:
completo en Perfil (web) y en la barra lateral (admin); un solo botón que rota en las barras
superiores.

## Logos e iconos

En `web/public/brand/` y `admin/public/brand/`:

- `icon.png` (1024), `icon-512.png`, `icon-192.png`, `icon-128.png`, `favicon-32.png`: icono de app
  (a partir de `mi-cancha-v2-icono-redondeado.png`).
- `apple-touch-icon.png` (180): sin esquinas transparentes (iOS aplica su máscara).
- `favicon.svg`, `mark.svg`, `mark.png`: la marca vectorizada (verde, fondo transparente).
- `logo-light.png` (texto oscuro, para fondos claros) y `logo-dark.png` (texto claro, para fondos
  oscuros): marca + «Mi Cancha» + «TUS RESERVAS, AL INSTANTE».

En la interfaz, `BrandLogo` muestra uno u otro según el tema (clases `.brand-on-light` /
`.brand-on-dark`).

## Prompt para la app Flutter

> Aplica la marca Mi Cancha y soporta modo claro y oscuro (que siga al sistema, con opción manual
> en Perfil: Claro / Sistema / Oscuro, guardada en SharedPreferences). Colores:
> verde esmeralda `#00C853` (primary), negro azulado `#0B1F28`, blanco `#F8FAFC`.
> **Claro:** scaffold `#F8FAFC`, surface `#FFFFFF`, surfaceVariant `#EDF2F1`, outline `#D9E3E1`,
> onSurface `#0B1F28`, onSurfaceVariant `#3C5360`, primary `#00C853` con onPrimary `#0B1F28`; el texto
> verde (links, chips) usa `#007A33`; error `#C62828`.
> **Oscuro:** scaffold `#0B1F28`, surface `#102B37`, surfaceVariant `#163845`, outline `#1F4352`,
> onSurface `#F8FAFC`, onSurfaceVariant `#BFD0D8`, primary `#00C853` con onPrimary `#0B1F28`; error
> `#FF8A80`.
> Define `ThemeData` claro y oscuro con `ColorScheme` explícito (no `fromSeed`), usa `themeMode`
> con un cubit y reemplaza colores sueltos por los del tema. Tipografía: Montserrat
> (`google_fonts`) en títulos y en el nombre de la marca. Icono de la app: usa
> `web/public/brand/icon.png` de la API (1024×1024) con `flutter_launcher_icons` y el logo
> `logo-light.png`/`logo-dark.png` según el tema en el splash y el login. Revisa contraste en ambos
> modos y no dejes warnings en `flutter analyze`.

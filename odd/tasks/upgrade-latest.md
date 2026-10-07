# Feature: actualización a versiones estables más recientes

- Rama: `chore/upgrade-latest` (apilada sobre `feat/content-kinds`)
- Estado: en curso
- Decisión humana: **todo a latest estable**, incluidos los saltos mayores.

## Inventario medido (`npm outdated`, Node 24.21.0 / npm 11.19.0)

| Paquete | Actual | Latest | Salto |
|---|---|---|---|
| react / react-dom | 19.2.4 | 19.3.0 | menor |
| react-router-dom | 7.13.0 | 7.18.4 | menor |
| postcss / autoprefixer | 8.5.6 / 10.4.23 | 8.5.29 / 10.6.1 | patch |
| @types/node | 22.19.7 | 26.6.4 | mayor (tipos) |
| @vitejs/plugin-react | 5.1.2 | 6.1.2 | mayor |
| vite | 6.4.1 | 8.3.3 | mayor (build) |
| js-yaml | 4.1.0 | 5.4.3 | mayor (parser de frontmatter) |
| react-markdown | 9.0.1 | 10.1.0 | mayor (un uso: `pages/Writeup.tsx`) |
| typescript | 5.8.3 | 7.0.2 | mayor (compilador) |
| tailwindcss | 3.4.19 | 4.3.3 | mayor (sistema de estilos) |
| gray-matter | presente | — | **sin usar → eliminar** |

## Hallazgos de exploración

- `tailwind.config.js`: **`plugins: []`** → no hay plugins que migrar a `@plugin`.
  Tema Nord + `deep-bg` + clases propias viven en `theme.extend` y en `index.css`.
- `index.css`: `@tailwind base/components/utilities` + `@layer base` + **8 `@apply`**
  + keyframes/clases propias (`scanline`, `frosty-glow`, `logo-animate`).
- `postcss.config.js` usa el plugin `tailwindcss` → en v4 pasa a `@tailwindcss/postcss`.
- `@tailwindcss/container-queries` y `@tailwindcss/forms` están en devDependencies
  pero **no se usan** (no aparecen en `plugins`) → eliminar.
- `react-markdown` se usa en un solo lugar: `pages/Writeup.tsx:327`.
- `js-yaml` lo consume solo `lib/frontmatter.js` (`load`).

## Estrategia (dos unidades de trabajo, gates en cada tramo)

**Unidad 1 — dependencias sin cambio de sistema:**
react/react-dom 19.3 · router 7.18 · postcss/autoprefixer · @types/node 26 ·
vite 8 + plugin-react 6 · js-yaml 5 · react-markdown 10 · typescript 7 ·
eliminar `gray-matter` y los dos `@tailwindcss/*` sin usar · refrescar
`caniuse-lite`.

Gate por tramo: `npm test` (169) + `npx tsc --noEmit` + `npm run build`.

**Unidad 2 — Tailwind 4:**
- `tailwindcss@4` + `@tailwindcss/postcss`.
- `index.css`: `@import "tailwindcss";` + `@config "../tailwind.config.js";`
  para conservar el tema Nord y las clases actuales sin reescribir nada.
- `postcss.config.js`: plugin `@tailwindcss/postcss`.
- Verificar que los 8 `@apply` y las clases propias compilan.

**Lo que NO puedo verificar sin navegador**: la estética resultante
(scanline, glow, paleta Nord). Lo marca el humano con `npm run dev`.

## Tareas

- [ ] T1. Rama, documento de feature y `todo`.
- [ ] T2. Unidad 1 — upgrades de dependencias con gate por tramo.
- [ ] T3. Unidad 1 — verificación independiente y commit.
- [ ] T4. Unidad 2 — migración a Tailwind 4.
- [ ] T5. Unidad 2 — verificación y commit.
- [ ] T6. Verificación final completa + cierre del documento.

## Evidencia de commits

- (pendiente)

## Cierre

- (pendiente)

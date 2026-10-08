# Feature: actualización a versiones estables más recientes

- Rama: `chore/upgrade-latest` (apilada sobre `feat/content-kinds`)
- Estado: completado (T1–T6). Decisión humana registrada sobre las clases
  huérfanas (ver Cierre).
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

- [x] T1. Rama, documento de feature y `todo`.
- [x] T2. Unidad 1 — upgrades con gate por etapa (A–E). Dos paradas
      justificadas por cambios upstream y resueltas con decisión explícita:
      guard de bloque vacío/comentarios en `lib/frontmatter.js` (js-yaml 5
      tira sobre entrada vacía) y `strict: false` +
      `noUncheckedSideEffectImports: false` en `tsconfig.json` (TS7 cambió
      los defaults; `@types/react` ni siquiera está instalado).
- [x] T3. Verificación independiente + commit `0785f5b`.
- [x] T4. Unidad 2 — Tailwind 4 vía `@config`, `tailwind.config.js` intacto.
- [x] T5. Verificación + commit `062df5c`.
- [x] T6. Verificación final: **PASS en las 8 verificaciones** + fix del
      aviso `__dirname` de Vite 8 en `vite.config.ts`.

## Evidencia de commits

| Commit | Tareas |
|---|---|
| `d7ce99a` docs: plan de actualizacion a versiones estables recientes | T1 |
| `0785f5b` chore: actualizar dependencias a latest estable | T2, T3 |
| `062df5c` chore: migrar a Tailwind 4 | T4, T5 |

## Cierre

- **`npm outdated` vacío**: react/react-dom 19.3.0, router 7.18.4,
  vite 8.3.3, plugin-react 6.1.2, @types/node 26.6.4, js-yaml 5.4.3,
  react-markdown 10.1.0, typescript 7.0.2, tailwindcss 4.3.3,
  @tailwindcss/postcss 4.3.3, postcss 8.5.29, autoprefixer 10.6.1.
  Eliminados `gray-matter` y los dos `@tailwindcss/*` sin uso.
- Verificación final PASS: 169/169 tests · `tsc` 0 · `build` 0 ·
  `index.json` byte idéntico · CSS compilada sin directivas v3, con paleta
  Nord y clases utilitarias presentes · árbol limpio.
- **`scanline` (Layout.tsx:24) y `frosty-glow` (Directory.tsx:322) no tienen
  definición CSS en ningún archivo del repo** — huérfanas **antes** de la
  migración (verificado contra el build v3 previo: tampoco estaban, así que
  no es un daño de la actualización). **Decisión del humano: dejarlas como
  están**, sin definir. Cero cambio visual; si algún día se quieren, es
  trabajo nuevo.
- **Deuda documentada**: `tsconfig.json` con `strict: false` explícito
  (semántica TS5.8 preservada); activar `strict` + `@types/react` es
  trabajo propio de la fase del frontend. `vite.config.ts` dejó de usar
  `__dirname` (aviso de Vite 8 resuelto).

## Review de la actualización: APPROVED

- Slice con `baseRef = 8bcadb3` (24 archivos, sin imágenes) → linaje
  `review-5ce910236858d553`, target `sha256:81f00070…`, **`approved`**,
  autoridad quemada (`gentle-ai.review-acknowledged/v1`).
- Tres hallazgos admisibles y su disposición (**decisión humana: atacar 1 y
  2, dejar strict como deuda**):
  1. `R3-blank-frontmatter-guard-untested` (WARNING) — el comportamiento
     ya era correcto (verificado antes de tocar nada); faltaba cobertura
     del bloque `---\n\n---`. Test añadido. **Sin RED: era un hueco de
     cobertura, no un bug, y no se inventa evidencia.**
  2. `R3-js-yaml-pin-removed` (SUGGESTIÓN) — el pin exacto de `js-yaml`
     (antes `4.1.0` sin caret) se había perdido al pasar a `^5.4.3`.
     Repineado a `5.4.3` exacto: es el parser de todo el frontmatter.
  3. `R3-strict-false-ts7` (WARNING) — decisión propia documentada arriba;
     **se mantiene como deuda de la Fase 2** por orden humana.
- Resultado: **170/170 tests**, `tsc` 0, `build` 0, `npm audit` → **0
  vulnerabilidades** (las mejoras de versión limpiaron las 10 previas).

## Review final de la rama: APPROVED con 3 hallazgos → DEUDA (decisión humana)

- Linajes `review-703d2d4d1445438a`, `review-346673823f318010`,
  `review-fd81b4e797165486`, `review-667288614caca725` → todos **`approved`**
  con autoridad quemada, vía slice `baseRef = 8bcadb3` (29 archivos, sin
  imágenes, ya que el candidato completo choca con `lens_context_budget_exceeded`).
- Hallazgos corregidos en el camino: forma de cada entrada del índice
  (`f0fef1f`), forma del array, determinismo de `readdir`, contrato de CSS,
  `ContentIndexError` en vez de `[]` silencioso, pin exacto de `js-yaml`.
- **Tres hallazgos finales que el humano decide dejar como deuda** (los tres
  SUGGESTIÓN, ninguno bloqueante):
  1. `R3-tags-boundary-unvalidated` — `lib/content-kinds.js:194-214`: el
     validador de entradas chequea `group` pero **no `tags`**, aunque `KINDS`
     expone los tres vocabularios. Un índice editado a mano con un tag ajeno
     pasaría el borde. Mismo patrón que el fix de `group` (~6 líneas).
  2. `R3-fetchdoc-return-type` — `lib/content.ts:215-219`: el loader
     compartido declara `Promise<CertificateDoc | null>` pero lo usan
     `fetchWriteup` y `fetchProject` además de `fetchCertificate` — el tipo
     miente sobre qué devuelve.
  3. `R3-styling-compiled-conditional-skip` — `tests/styling.test.ts:55`:
     sin `dist/` la capa compilada se salta en silencio, así que un checkout
     nuevo pasa el test sin verificar el contrato de estilo. Nuestro gate
     corre `build` antes de `test`, por eso en la práctica sí se ejercita.
- Resultado de esos ciclos: **193/193 tests**, `tsc` 0, `build` 0,
  `index.json` byte idéntico.
- **Decisión del humano: ninguno se ataca; se espera el frontend (Fase 2).**

# Feature: limpieza de artefactos y suite de tests

- Rama: `chore/cleanup-and-tests`
- Estado: completado (T1–T10)
- Rama: `chore/cleanup-and-tests` (5 commits, árbol limpio)
- Creado: 2026-XX (sesión actual)

## Objetivo

Eliminar restos de plantilla y riesgos innecesarios del sitio StarkHack, unificar el
parseo de frontmatter en una sola implementación y establecer una suite de tests
que proteja el pipeline de contenido (markdown → index.json → UI).

## Contexto explorado

- `vite.config.ts` inyecta `process.env.API_KEY` / `process.env.GEMINI_API_KEY` vía
  `define`. No hay `.env` en el repo y ningún archivo los consume → resto de plantilla.
  Si alguna vez existiera una clave real quedaría expuesta en el bundle.
- `components/Layout.tsx` implementa un contador de vistas contra
  `api.counterapi.dev` con un namespace hardcodeado (`starkhack-35GH3-1C4B50-1A34`).
  Se elimina por completo (estado, effect y render del footer).
- El frontmatter se parsea en dos lugares con implementaciones distintas:
  - `scripts/generate-index.js`: parser de líneas escrito a mano (Node, build time).
  - `lib/content.ts`: regex de separador + `js-yaml` (browser, runtime).
  Verificado: `js-yaml` sobre los 16 writeups produce `public/index.json`
  **byte a byte idéntico** al actual → la unificación es segura.
- No existe runner de tests. Se agrega Vitest (nativo del stack Vite 6).

## Decisiones

1. **Fuente única de verdad**: `lib/frontmatter.js` (ESM plano + JSDoc, importable
   tanto por Node como por el bundler sin loader extra) exporta
   `parseFrontmatter(text) -> { data, content }` usando `js-yaml` + normalización de
   `Date -> string YYYY-MM-DD`.
2. `generate-index.js` y `lib/content.ts` importan ese módulo; se elimina el parser
   manual y la regex duplicada de `content.ts`.
3. `generate-index.js` expone `generateIndex(dir)` reutilizable con guard CLI para
   poder testearlo con fixtures.
4. Tests en inglés (convención de títulos de test), comentarios siguen el estilo del
   archivo que los rodea.

## Tareas

- [x] T1. Limpieza de `vite.config.ts`: eliminar `define` de API_KEY/GEMINI_API_KEY y
      el `loadEnv` que quedó sin uso. Verificar que no queden referencias.
- [x] T2. Eliminar el contador de vistas de `components/Layout.tsx` (estado, effect,
      bloque del footer e imports huérfanos).
- [x] T3. Unificar el parseo de frontmatter en `lib/frontmatter.js`; migrar
      `scripts/generate-index.js` y `lib/content.ts`.
- [x] T4. Regenerar `public/index.json` y confirmar que no cambia respecto del
      actual (prueba de no-regresión del pipeline de contenido).
- [x] T5. Instalar y configurar Vitest + script `npm test`.
- [x] T6. Tests del parser de frontmatter: 9 pruebas (sin RED previa: la
      implementación ya existía → tests de caracterización).
- [x] T7. Tests de `generateIndex`: 6 pruebas con fixtures en tmp.
- [x] T8. Tests de `lib/content.ts` con `fetch` mockeado: 11 pruebas.
- [x] T9. Test de sincronía: 33 pruebas + prueba RED/GREEN real (entrada falsa
      en `index.json` → falla → restaurar → verde). Ampliado con la regla
      `draft: true` → excluido del índice.
- [x] T10. Verificación final: `npm test` 59/59, `tsc --noEmit` exit 0,
      `npm run build` exit 0, árbol limpio, sin rastros de API key ni contador.

## Evidencia de commits

| Commit | Tarea |
|---|---|
| `77a752e` chore: eliminar inyección muerta de API_KEY/GEMINI_API_KEY en vite.config.ts | T1 |
| `f40e3fb` chore: eliminar el contador de vistas externo del layout | T2 |
| `61a3d64` refactor: unificar el parseo de frontmatter en lib/frontmatter.js | T3, T4 |
| `28a253f` test: incorporar vitest como runner de pruebas | T5 |
| `acfb08f` test: cubrir el pipeline de contenido con 59 pruebas | T6–T9 |

## Cierre

- Verificación final (T10): `npm test` → 4 archivos / 59 pruebas en verde;
  `npx tsc --noEmit` → exit 0; `npm run build` → exit 0 (211 módulos);
  `git status --short` vacío; grep sin rastros de API key ni contador.
- Bundle bajó de 420.62 kB a 411.32 kB (gzip 132.14 → 128.62 kB) al quitar
  la inyección muerta y el contador.
- Checks no ejecutados: no hay e2e ni navegador; la verificación es de
  compilación, build y suite unitaria.
- Advertencia preexistente: `caniuse-lite` desactualizado (no bloquea).
- Pendiente fuera de alcance: `gray-matter` figura en `package.json` pero
  ningún archivo lo importa (candidato a `npm uninstall`).

## Review nativo (RDD)

- Lineage: `review-fe24803f47452ed7` · tier medium · lente `review-reliability`.
- Resultado: **approved**, acknowledge ejecutado, autoridad consumida
  (`gentle-ai.review-acknowledged/v1`). Entrega pendiente de decisión humana.
- Hallazgos admisibles (no bloqueantes, informativos):
  - `R3-01` WARNING — `scripts/generate-index.js:30`
  - `R3-02` SUGGESTION — `tests/sync.test.ts:60`
  - `R3-03` SUGGESTION — `lib/content.ts:66`
  Ninguno abrió corrección ni reabre esta revisión; van como trabajo aparte.

# Feature: code-polish

**Goal**: pulir el código eliminando código muerto olvidado por cambios y
archivos que ocupan espacio, dejando la suite en verde (689 tests).

**Branch**: chore/code-polish · **Started**: 2026-10-16

## Specs

- **S1** (pedido original, verbatim): "Vamos con un analisis de código completo
  utiliza engram para esto mas que todo para que tengas clara la estrucutura,
  luego vamos a pulir el código y con esto me refiero a investigar por código
  muerto que no este en uso o que aya quedado olvidado por cambios y este
  ocupando espacio."
- **S2** (decisión humana, verbatim — links de wave): "Wave queda sin links" →
  los 2 tests de `tests/writeup-view.test.ts` que pineaban `machineLinks`/`toolLinks`
  de wave se actualizan para pinear que wave NO tiene links (el frontmatter
  actual de `public/writeups/hackmyvm/wave.md` es la fuente de verdad).
- **S3** (decisión humana, verbatim — imágenes de proyectos): "Borrar las 18" →
  se eliminan `public/projects/{dockerhack,entorno,starktools}/media/01..06.webp`
  (18 archivos, ~2.3 MB, no referenciados por ningún markdown).
- **S4** (decisión humana, verbatim — pines stale): "Actualizar los 3 pines" →
  `tests/projects-model.test.ts` ("zero project entries"),
  `tests/terminal-data.test.ts` ("agrees with the real index") y
  `tests/registry.test.ts` ("appends project tags at the END") se ajustan al
  estado real del índice (4 proyectos, listas actuales de tags) — RED ya
  observado → GREEN.
- **S5** (decisión humana, verbatim — archivo muerto): "Borrar el archivo
  muerto" → se elimina `public/_archive/unreferenced/` (73 webp, 2.6 MB) y con
  eso se retira `scripts/migrate-images.js` (herramienta de migración única ya
  completada, única referencia a `_archive`).

Fuera de alcance: los 31 `export` redundantes (solo uso interno) — no son
código muerto y su de-exportación agrega churn; queda anotado, no se toca.

## Tasks

- **T1** · S1 · doc ODD + espejo Engram + rama `chore/code-polish` + todo · commit doc
- **T2** · S1 · cadena muerta de template: borrar `src/data/projectContents.ts` (508 líneas), su import y `hasTemplateProjectContent` en `src/lib/detailRoutes.tsx`, y el pin de `hasTemplateProjectContent` en `tests/router.test.ts` · `ContenidoPendiente` NO se toca (vivo: fallback del error boundary)
- **T3** · S1 · imports/locales muertos: 12 imports sin uso en 7 componentes, prop `machineTitle` (declarada y nunca leída) en `MarkdownRenderer` + sus 2 callers, type `Project` sin usar en `detailRoutes`, import `EMPTY_DIRECTORY_FILTERS` sin usar en `WriteupsScreen`, 2 type imports en `tests/terminal-data.test.ts`, `WriteupSummary` muerto en `types.ts` · gate: `tsc --noUnusedLocals --noUnusedParameters` en 0
- **T4** · S1,S5 · restos de plantilla/herramientas sin uso: `metadata.json`, `.markdownlint.json`, `scripts/convert_img.py`, `scripts/markdown.py`, `scripts/__pycache__/`
- **T5** · S5 · borrar `scripts/migrate-images.js`
- **T6** · S3 · borrar las 18 imágenes 01..06 de proyectos → `tests/media.test.ts` verde
- **T7** · S5 · borrar `public/_archive/unreferenced/` (73 webp)
- **T8** · S2 · actualizar los 2 tests de wave a "sin links"
- **T9** · S4 · actualizar los 3 pines stale (projects-model, terminal-data, registry)
- **T10** · todos · gate final: `npm test` (build + suite) verde, `tsc` 0, sin restos; commits work-unit; Risk line

## Log

- **L1** · S1 · pedido original del humano (verbatim en S1).
- **L2** · S2-S5 · decisiones del humano en la tanda de preguntas del análisis:
  "Wave queda sin links" · "Borrar las 18" · "Actualizar los 3 pines" ·
  "Borrar el archivo muerto".
- **L3** · evidencia · suite de partida ROJA: 6 failed | 683 passed (689) en 5
  archivos (media, projects-model, terminal-data, registry, writeup-view×2);
  causas atribuidas al commit `79f5246 "reforma completo"`.

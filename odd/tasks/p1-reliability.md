# Feature: p1-reliability (P1 de la auditoría)

**Goal**: cerrar los cuatro items P1 del reporte de auditoría: error honesto
en vez de falso "404" cuando el fetch del documento falla (E1), timeout de red
(E2), error boundary global (E3) y pines de contenido frágiles → patrón
derivado (E5).

**Branch**: fix/p1-reliability (sobre security/url-hardening) · **Started**: 2026-10-16

## Specs

- **S1** (E1 verbatim del reporte): "Un fallo de red se muestra como '404'" —
  `fetchMarkdownDoc` (`lib/content.ts`) traga todos los errores y devuelve
  `null`; las rutas pintan "NO ENCONTRADO" para una caída de infra. Regla
  nueva: `!response.ok` → `null` (not-found honesto, ya pineado); fallo de
  red/timeout/parse → **rechaza** con `ContentDocError` tipado y la ruta pinta
  `DetailProblem` (estado de error honesto). Aplica a writeup/project/certificate
  (loader compartido).
- **S2** (E2 verbatim): "Sin timeout ni retry — un `/index.json` colgado deja
  toda la app en `loading` para siempre". Regla: `fetchWithTimeout` (helper
  interno con `AbortController`, default 10s, timeout parametrizable para
  tests) usado por el índice y el loader de documentos; el timeout rechaza
  con `ContentDocError`/`ContentIndexError` (nunca cuelga).
- **S3** (E3 verbatim): "Sin error boundary global — un crash en
  Home/Writeups/Projects = white screen". Regla: `GlobalErrorBoundary`
  (`src/components/GlobalErrorBoundary.tsx`) rodea `<Outlet />` en `App.tsx`
  con panel honesto (estética de los `StatePanel` de detailRoutes). El
  entorno de tests es `node` (sin jsdom) → cobertura por pin estructural
  (el boundary rodea al Outlet) + pin de render del fallback + unit de
  `getDerivedStateFromError`; el boundary de detalle existente se conserva.
- **S4** (E5 verbatim): "Tests frágiles → patrón derivado". Los pines que
  rompen con cada publicación pasan a derivarse de las entradas reales:
  `terminal-data.test.ts` (4 proyectos, 16 writeups ×2, wave literal),
  `projects-model.test.ts` (4 y `[4,1,1,2]`), `writeup-view.test.ts`
  (`'# Enumeración'`, conteo de headings 9), `router.test.ts` (title 'Wave',
  body). El contrato que queda: "una fila por entrada real" y "el cuerpo es
  el archivo real", sin literales de contenido.
- **S5**: test-first con RED observado por regla; gate final `npm test` +
  `tsc --noUnusedLocals` en 0; sin dependencias nuevas; el contrato
  not-found sigue intacto (`!ok` → null, test existente en content.test:480).

## Tasks

- **T1** · doc ODD + espejo Engram + rama
- **T2** · S2 · RED `fetchWithTimeout` (fake timers: aborta y rechaza; limpia timer en éxito) → implementar en `lib/content.ts` y usar en fetchRawIndex + fetchMarkdownDoc → GREEN
- **T3** · S1 · RED: `fetchWriteup` rechaza con `ContentDocError` en fallo de red y timeout; `!ok` sigue resolviendo null → implementar (loader compartido propaga) → GREEN
- **T4** · S3 · RED: pin estructural (App rodea Outlet con GlobalErrorBoundary) + render del fallback + getDerivedStateFromError → implementar componente → GREEN
- **T5** · S4 · RED: los pines frágiles fallan contra el patrón derivado → reescribir los 4 archivos de tests al patrón derivado → GREEN
- **T6** · S5 · gate final + commits work-unit + Risk line

## Log

- **L1** · S1-S5 · pedido del humano verbatim: "vamos con los P1" (tras el
  reporte de auditoría con E1/E2/E3/E5 en la fila P1).
- **L2** · evidencia · entorno vitest = `node` (vitest.config.ts) → sin
  jsdom, el boundary se pinnea estructuralmente (estilo styling.test.ts).
  El pin `content.test.ts:480` ("returns null when the response is not ok")
  es el contrato que S1 debe preservar.

# Epic: p2-structure (P2 de la auditoría)

**Goal**: ejecutar el lote P2 del reporte de auditoría como unidades chicos y
revisables, en orden de valor/riesgo. Cada unidad cierra con gate verde y su
propio commit; este doc es el índice del epic.

**Branch**: refactor/p2-structure (sobre fix/p1-reliability) · **Started**: 2026-10-16

## Unidades

- **U1 · useContentQuery (H2)** — un hook compartido reemplaza las 4 copias
  del fetch state machine (`Home.tsx`, `WriteupsScreen`, `ProjectsScreen`,
  `CertificationsScreen`) y los 2 contenedores de `detailRoutes.tsx`
  (loading/ready/missing/error). Sin jsdom en vitest → pin estructural (los
  contenedores usan el hook; ningún `let cancelled` queda fuera de él) +
  preservación de los renders SSR existentes.
- **U2 · duplicado de detalle (H3)** — extraer `useScrollSpy`,
  `useReadingProgress` y el layout de detalle compartido entre
  `WriteupPage`/`ProjectPage` (~100 líneas espejo).
- **U3 · tsconfig `strict: true`** — encender strict por completo (el código
  ya escribe guards `instanceof Error` en todos lados) y arreglar lo que
  revele; `noUncheckedIndexedAccess` queda como follow-up.
- **U4 · unificar tipos** — cerrar el desfasaje entre `/types.ts` (pipeline)
  y `src/types/index.ts` (UI): `MachineLinkFm`/`ToolLinkFm` vs
  `MachineLink`/`ToolLink` (divergentes en `githubStars`) y los pares
  mirror; naming de imports sin puntos confusos.
- **U5 · reorganizar `screens/` (H1)** — `src/lib/` deja de mezclar
  componentes con lógica pura: rutas/pantallas a `src/screens/` (o
  `src/app/`), `src/lib/` solo-puro.
- **U6 · registry como única fuente (H4)** — el CLI deja de editar tests/pins
  por ancla de texto y pasa a validador; los vocabularios se derivan de
  `lib/content-kinds.js` (tipos TS por `typeof`), eliminando los 10 lugares
  por alta de grupo. Es la unidad más grande y va la última (después de U5,
  para reescribir los anclas una sola vez).

## Reglas del epic

- Test-first donde el entorno lo permite (node, sin jsdom); donde no, pin
  estructural documentado + preservación de renders SSR + tsc + gate completo
  (la ausencia de jsdom es una limitación conocida, no una licencia).
- Differential check obligatorio: el gate completo tras cada unidad (los
  hermanos que comparten el código tocado se arreglan en la misma unidad).
- Cero dependencias nuevas.
- Sin cambios de contenido ni de diseño visual.

## Log

- **L1** · pedido del humano verbatim: "vamos con P2".
- **L2** · decisión de diseño · U1: el hook devuelve
  `{ data, status, error }` con `data: T | null`; `detailRoutes` mapea
  `ready + null` a su estado `missing` (el resolutor ya devuelve null para
  not-found) — mismo comportamiento observable, cero lógica nueva en las
  pantallas. `MainframeTerminalModal` queda fuera (ciclo de vida one-shot
  documentado, no es el mismo patrón).

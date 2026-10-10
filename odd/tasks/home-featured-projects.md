# Feature: home-featured-projects

**Goal**: el Home muestra exactamente los 3 writeups más recientes y los 3
proyectos más recientes (hoy muestra los 4 proyectos del índice), sin mentir
en los contadores del índice.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Diagnóstico (exploración)

- `src/lib/Home.tsx` llama `getRecentWriteups(3)` (limitado) pero
  `getProjects()` **sin límite** → `FeaturedProjects` recibe 4 tarjetas.
- `getProjects()` es la API "todos los proyectos" correcta para `/projects`
  y para el comando `projects` del terminal: no se toca su contrato.
- Índice real hoy: 4 proyectos (`convertmachines`, `dockerhack`, `entorno`,
  `starktools`) — **los 4 con la misma fecha `2026-10-09`**, por lo que
  "los 3 más recientes" necesita desempate determinístico.
- Regla ya usada por `getRecentWriteups`: fecha descendente + orden estable
  (los empates conservan el orden del índice). Se reutiliza esa misma regla.

## Diseño

1. `lib/content.ts`: helper puro exportado
   `mostRecentByDate(items, limit)` — fecha descendente, entradas sin fecha
   (o no parseable) al final (nunca inventadas), orden estable en empates,
   `slice(0, limit)`, no muta la entrada. `getRecentWriteups` pasa a usarlo
   (una sola implementación de la regla).
2. `src/lib/homeModel.ts` (nuevo): `loadHomeContent()` puro-orquestador con
   `HOME_WRITEUP_COUNT = 3` y `HOME_PROJECT_COUNT = 3`; devuelve
   `{ writeups, projects, projectTotal }`. Un solo fetch de `getProjects()`
   sirve para las tarjetas (3 más recientes) y para el total.
3. `src/lib/Home.tsx`: el effect llama `loadHomeContent()` (misma lógica de
   loading/error/cancel); pasa `totalCount={projectTotal}` a
   `FeaturedProjects`.
4. `src/components/FeaturedProjects.tsx`: prop opcional `totalCount`
   (default `projects.length`) usada por los dos contadores (`INDEX: NN
   REPOSITORIOS` y el pie `NN REPOSITORIOS INDEXADOS`) para que sigan
   siendo honestos cuando la grilla muestra solo 3.

## Tasks

- [x] T1 Tests RED: `mostRecentByDate` (orden, desempate estable, límite,
      sin fecha al final, no mutación) en `tests/content.test.ts` — RED real
      (5× `mostRecentByDate is not a function`).
- [x] T2 Tests RED: `tests/home-model.test.ts` — RED real (módulo inexistente,
      `INDEX: 03` ≠ `INDEX: 04` esperado, pin estructural de Home).
- [x] T3 Implementación (helper, homeModel, Home, FeaturedProjects).
- [x] T4 Verificación: enfoque verde 40/40; `npx tsc --noEmit` 0;
      `npx vite build` OK; suite completa 680/686 (los 6 rojos son
      PRE-EXISTENTES y ajenos, clasificados por verify).
- [x] T5 Commit work-unit + espejo de memoria (Engram obs 52).

## Evidence

- Enfoque (RED → GREEN): `npx vitest run tests/content.test.ts
  tests/home-model.test.ts` → 9 fallaban en RED, 40/40 en GREEN.
- Clasificación de la suite completa: los 6 rojos NO tocan el fix —
  `media.test` (huérfanos de `public/projects/*` sin trackear),
  `projects-model`/`terminal-data` (pin stale "zero projects" vs los 4
  proyectos del índice sucio), `registry` rule-2 (pin stale vs los tags
  nuevos de `lib/taxonomy.js` dirty) y 2× `writeup-view` wave (el working
  tree tiene borrados los `toolLinks` frontmatter de `wave.md`, cambio
  pre-existente sin commitear).
- Decisión de honestidad: la grilla muestra 3 tarjetas, los contadores
  (`INDEX: NN` y `NN REPOSITORIOS INDEXADOS`) siguen reportando el total
  real del índice (4 hoy) vía la prop `totalCount`.


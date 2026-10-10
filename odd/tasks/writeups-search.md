# Feature: writeups-search

**Goal**: el buscador de `/writeups` busca de verdad por lo que promete su
placeholder — `Search archives (name, tag, level, platform)` — y hoy solo
coincide con `title`/`description`: escribir un tag (p. ej. `Privilege
Escalation`) no devuelve nada.

**Branch**: feat/frontend-migration · **Started**: 2026-10-09

## Diagnóstico (exploración)

- `src/lib/directoryModel.ts` → `matchesSearch(item, query)` solo prueba
  `item.title` y `item.description`. El overlay global (`searchResults`) y la
  lista filtrada (`writeups`) comparten esa función, así que el fix es uno.
- El placeholder del input (`src/components/WriteupsScreen.tsx`) promete
  `name, tag, level, platform`: el contrato visible ya existía, no se cumple.
- Pin existente que hay que revisar deliberadamente:
  `tests/directory-model.test.ts` → "search matches real title/description
  only" (incluye el caso `search: 'hackmyvm'` con `platformId: 'vulnhub'` que
  espera `searchResults === ['wave']`; al matchear plataforma pasa a devolver
  también `flossy`).

## Diseño

- `matchesSearch` pasa a probar, en orden, campos REALES y solamente reales:
  `title`, `description`, `tags` (substring case-insensitive por tag),
  `level` (vocabulario verbatim Easy|Medium|Hard), `platform` (id lowercased)
  y `categories[0]` (nombre visible de la plataforma, p. ej. "HackMyVM").
  Nada inventado: mismo campo-por-campo que ya usa el modelo para filtros.
- Substring case-insensitive, sin stemming ni multi-término: misma semántica
  de antes, solo se agregan campos al haystack.
- Los tests que fijan el contrato viejo se REESCRIBEN a propósito (no se
  debilitan): se documenta el cambio de contrato en el header del test.

## Tasks

- [x] T1 Tests RED: casos nuevos (tag, level, platform id, nombre de
      plataforma) + reescritura deliberada del pin "title/description only" —
      RED real: 4 fallaban (`privilege escalation` → [], `easy` → [],
      `hackthebox` → [], y el overlay `hackmyvm` → ['wave'] ≠ ['wave','flossy']).
- [x] T2 Implementación de `matchesSearch` en `src/lib/directoryModel.ts`.
- [x] T3 Verificación: `npx vitest run` 683/689 (los 6 rojos son EXACTAMENTE
      el mismo baseline pre-existente que antes del fix); `tsc --noEmit` 0;
      `vite build` OK.
- [x] T4 Commit work-unit + espejo de memoria (Engram obs 53) + review RDD.

## Evidence

- RED → GREEN: `npx vitest run tests/directory-model.test.ts` → 4 fallaban,
  luego 19/19.
- Cambio de contrato documentado (no debilitado): el haystack de búsqueda
  pasa de `title`/`description` a `title`/`description`/`tags`/`level`/
  `platform`/`categories[0]` — todos campos REALES del pipeline; los
  negativos `10.10` y `443` (IPs/puertos, que no existen en el pipeline)
  siguen asserting `[]`.
- El overlay global y la lista filtrada comparten `matchesSearch`, así que
  ambos quedan corregidos con el mismo cambio.


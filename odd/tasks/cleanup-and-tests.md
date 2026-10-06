# Feature: limpieza de artefactos y suite de tests

- Rama: `chore/cleanup-and-tests`
- Estado: en curso
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

- [ ] T1. Limpieza de `vite.config.ts`: eliminar `define` de API_KEY/GEMINI_API_KEY y
      el `loadEnv` que quedó sin uso. Verificar que no queden referencias.
- [ ] T2. Eliminar el contador de vistas de `components/Layout.tsx` (estado, effect,
      bloque del footer e imports huérfanos).
- [ ] T3. Unificar el parseo de frontmatter en `lib/frontmatter.js`; migrar
      `scripts/generate-index.js` y `lib/content.ts`.
- [ ] T4. Regenerar `public/index.json` y confirmar que no cambia respecto del
      actual (prueba de no-regresión del pipeline de contenido).
- [ ] T5. Instalar y configurar Vitest + script `npm test`.
- [ ] T6. Tests del parser de frontmatter (RED → GREEN): frontmatter válido, sin
      frontmatter, fechas, arrays multilínea, drafts, CRLF.
- [ ] T7. Tests de `generateIndex`: excluye drafts, ordena por fecha descendente,
      completa `platform`/`slug`/`path`, tolera directorios no-dataset.
- [ ] T8. Tests de `lib/content.ts` con `fetch` mockeado: `getPlatforms`,
      `getMachinesByPlatform`, `getRecentWriteups`, `fetchWriteup`.
- [ ] T9. Test de sincronía: cada `.md` publicado parsea y coincide con lo que
      declara `public/index.json` (detecta "olvidé regenerar el índice").
- [ ] T10. Verificación final: `npm run build` + suite completa en verde.

## Evidencia de commits

- (pendiente)

## Cierre

- (pendiente)

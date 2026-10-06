# Feature: corrección de hallazgos del review R3

- Rama: `fix/review-reliability-findings` (apilada sobre `chore/cleanup-and-tests`)
- Estado: completado (T1–T7)
- Commits: `ce01dad` (R3-01, R3-02) · `43cf2b7` (R3-03, R3-04)
- Candidato previo: lineage `review-8a8ddd857fb68cd8` → approved, 4 hallazgos
  admisibles informativos (ninguno bloqueó ni reabre).

## Objetivo

Corregir los cuatro hallazgos admisibles del review `review-reliability` sobre el
candidato `sha256:3b7c67d3…`, con test-first real (RED observado) para los tres
cambios de comportamiento.

## Hallazgos y alcance

Los reviews entregan solo `id`/`severidad`/`ubicación`; la sustancia es lectura
del código señalado.

### R3-01 · WARNING · `scripts/generate-index.js:30`
El generador no valida ni da contexto de error:
- YAML inválido → `parseFrontmatter` tira sin decir qué archivo falló.
- `.md` sin frontmatter → `data = {}` y se indexa **sin `title` ni `date`**;
  el test de sincronía no lo detecta porque compara `undefined === undefined`.

Corrección: validar campos obligatorios (`title`, `date`) antes de indexar,
envolver el parseo por archivo con el `filePath` en el mensaje, fallar con
exit 1, y reforzar `tests/sync.test.ts` para exigir presencia de campos
( no solo igualdad ).

### R3-02 · WARNING · `tests/sync.test.ts:60`
`index.filter((entry) => entry.slug === slug)` matchea por `slug` sin `platform`.
Con una segunda plataforma y nombres repetidos, `matches` tiene 2 entradas y el
test falla contra la entrada equivocada.

Corrección: matchear por `path` (único por construcción).

### R3-03 · SUGGESTION · `lib/frontmatter.js:4`
El regex está anclado al byte cero: un UTF-8 **BOM** hace que el archivo se lea
como "sin frontmatter" → misma pérdida silenciosa de metadata que R3-01.

Corrección: stripear `\uFEFF` antes del match.

### R3-04 · SUGGESTION · `lib/content.ts:66`
`parseFrontmatter(text) as { data: any; content: string }` apaga los tipos:
`WriteupContent` exige `title`/`date` y el spread puede no cumplirlo.

Corrección: `parseFrontmatter` genérico y unificar los dos branches de
`fetchWriteup` para garantizar `title`/`date` con fallback en todos los caminos.

## Tareas

- [x] T1. Rama, documento de feature, `todo` visible y mirror Engram (mirror
      fallido: servidor Engram caído en 127.0.0.1:7437; queda pendiente).
- [x] T2. R3-01: RED observado (7 fallos) → validación de `title`/`date` con
      `filePath` en el mensaje, skip de drafts antes de validar, `runCli` con
      stderr + exit 1 → GREEN.
- [x] T3. R3-02: RED observado (2 fallos con slug compartido) → `entriesFor`
      resuelve por `path` único → GREEN.
- [x] T4. R3-03: RED observado (BOM) → stripear `\uFEFF` antes del match → GREEN.
- [x] T5. R3-04: `parseFrontmatter<T>` vía JSDoc `@template`, cero `any` en
      `lib/content.ts`, `title`/`date` garantizados con fallback en todos los
      caminos. Sin RED natural (contrato de compilación): verificado con
      `tsc --noEmit`. Cobertura movida a `tests/content.test.ts`.
- [x] T6. Verificación final: 74/74 tests, `tsc` exit 0, `build` exit 0,
      `index.json` byte idéntico, sin `any`, sin lookups por `slug` suelto.
- [x] T7. Preflight y transición completa del nuevo candidato.
  - `inspect` → `start` → `status` → captura del lente `review-reliability`.
  - El primer intento de ejecución del reviewer **falló por transporte**
    (`pi-host-relay-transport-failure`, `terminated` a los ~10 min, sin mutación);
    se repitió con STATUS fresco y el mismo binding reofrecido exactamente.
  - Resultado: **approved**, ack ejecutado, autoridad consumida
    (`gentle-ai.review-acknowledged/v1`).
  - Nuevos hallazgos admisibles (no bloqueantes):
    - `R3-001` WARNING — `scripts/generate-index.js:45`
    - `R3-002` WARNING — `tests/sync.test.ts:75`
    - `R3-003` SUGGESTION — `scripts/generate-index.js:84`

## Evidencia de commits

| Commit | Tareas |
|---|---|
| `ce01dad` fix: validar metadata del índice y matchear el sync por path (R3-01, R3-02) | T2, T3 |
| `43cf2b7` fix: tolerar BOM y eliminar el cast any de fetchWriteup (R3-03, R3-04) | T4, T5 |

### Técnicas y deudas detectadas

- `tsconfig.json` **no tiene `strict`/`strictNullChecks`**: un mutation test del
  writer probó que `tsc` no detecta `title` potencialmente `undefined`. La
  garantía hoy la dan los 3 tests en runtime. Habilitar strict es tarea aparte.
- `fetchWriteup` usa `??` (nullish), así que un `title: ""` explícito se
  conserva; en cambio el generador trata vacío/whitespace como campo faltante.
  Asimetría menor, documentada a propósito.

## Cierre

- Verificación final: 74/74 tests, `tsc --noEmit` exit 0, `npm run build`
  exit 0, `public/index.json` byte idéntico, cero `any` en `lib/content.ts`,
  cero lookups por `slug` suelto en `tests/`.
- Review: `review-703d2d4d1445438a` → approved y quemado. Tres hallazgos
  admisibles nuevos (R3-001..R3-003), pendientes de decisión del humano.
- Checks no ejecutados: no hay e2e/navegador; Engram sigue caído (127.0.0.1:7437)
  por lo que el mirror `odd/review-findings/tasks` no se pudo guardar.

## Segundo ciclo: R3-001 y R3-002 (sugerencias)

Review `review-cea004a52c906627` → approved y quemado. Dos hallazgos
admisibles sobre el código recién escrito, ambos corregidos por decisión del
humano («vamos con las correcciones»):

### R3-001 · SUGGESTION · `lib/content.ts:68` → corregido
El spread iba antes que `slug`/`content`, así que una clave `slug:` o
`content:` escrita en el frontmatter pisaba el id real y el cuerpo markdown.
Latente hoy: ningún writeup trae esas claves. Arreglo: el spread va primero
y `slug`/`content` se declaran después.

### R3-002 · SUGGESTION · `scripts/generate-index.js:45` → corregido
La validación chequeaba presencia/vacío pero no el tipo: `title: [a, b]` o
title: 123` pasaban y llegaban a React (array ⇒ crash de render). Arreglo:
un valor no-string cuenta como campo faltante.

Evidencia: RED observado en los 3 tests nuevos (`expected 'evil' to be
'wave'` y dos «did not throw») → corrección → 77/77 tests, `tsc --noEmit`
exit 0, `npm run build` exit 0, `public/index.json` byte idéntico.

No se abrió un tercer ciclo de review para este candidato: el usuario pidió
cerrar sin más ceremonia RDD. Queda registrado acá por si querés correrlo.

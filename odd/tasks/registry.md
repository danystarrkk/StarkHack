# Feature: `registry` — automatizar registros cerrados (plataformas, tags, grupos)

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Pedido del humano (verbatim fiel)

> vamos a automatizar la **creación de plataformas para writeups**, **agregación
> de tags extras** y más.

**Decisiones humanas (2 preguntas de alcance):**
1. Alcance = **pipeline + pines + aviso de UI**: el script registra en la
   implementación y en el pin de aprobación; lo que toque JSX (botones de
   filtro, labels) lo **detecta y reporta** con los archivos exactos, sin
   reescribir componentes React.
2. Pin = **el script actualiza lib y pin juntos**, con `--dry-run` y
   confirmación explícita (igual que el cambio manual de la sesión anterior).

## Análisis: los registros cerrados y sus huecos (lo que encontré)

| Registro | Implementación | Pin de aprobación | UI / extras |
|---|---|---|---|
| Plataforma (writeup) | directorio (`add-content --platform` ya lo crea ✓) + `WRITEUP_ICON_BY_PLATFORM` en `src/lib/contentAdapter.ts` | `tests/ui-content-adapter.test.ts:193` (bloque "documented map") | sin icono registrado → la tarjeta usa el fallback **`bug`**; el logo es genérico (`/ui/logo-plataformas.webp`) |
| Tag writeup | `TAGS` en `lib/taxonomy.js` (orden **alfabético**) | `APPROVED_TAGS` en `tests/taxonomy.test.ts` | — |
| Tag project | `PROJECT_TAGS` (orden **aprobado**, no alfabético) | `APPROVED_PROJECT_TAGS` | — |
| Tag certificate | `CERTIFICATE_TAGS` (orden aprobado) | `APPROVED_CERTIFICATE_TAGS` | — |
| Grupo project/certificate | `PROJECT_GROUPS`/`CERTIFICATE_GROUPS` en `lib/content-kinds.js` | `APPROVED_*_GROUPS` en `tests/taxonomy.test.ts` | **labels y uniones de tipo** en `certificationsModel.ts`/`projectsModel.ts` + **botones de filtro** en `CertificationsScreen.tsx`/`ProjectsScreen.tsx` + icono `PROJECT_ICON_BY_GROUP` + sus pines |
| Icono de proyecto por grupo | `PROJECT_ICON_BY_GROUP` en `contentAdapter.ts` | `tests/ui-content-adapter.test.ts:255` | — |

**Huecos detectados (el "y más"):**
- Un **grupo nuevo** valida en el pipeline pero queda **sin botón de filtro ni
  label** en la UI (las uniones de tipo y los arrays de filtros están
  hardcodeados) → solo visible en TODOS.
- Una **plataforma vacía** no aparece en la UI: `getPlatforms()` deriva del
  índice, así que registrarla sin writeups no la muestra. El script lo
  **advierte** (persistir una lista de plataformas sería un cambio de datos/UI,
  fuera del alcance elegido).
- El patrón de fondo: **todo registro cerrado vive en 2+ lugares**; olvidar el
  pin deja 2 tests rojos (ya pasó en esta sesión con los 9 tags de certificates).

## Diseño (mismo patrón de la sesión: motor puro + CLI)

```
node scripts/registry.js list
node scripts/registry.js platform <name> [--icon <i>] [--dry-run]
node scripts/registry.js tag <tag> [--kind writeup|project|certificate] [--dry-run]
node scripts/registry.js group <slug> --kind project|certificate [--label <LABEL>] [--dry-run]
```

- **`lib/registry.js`** (puro, sin I/O — estilo `lib/content-ingest.js`):
  recibe **textos fuente** y devuelve `{ problems, files: [{name, source}] }`
  con los textos ya modificados. Funciones: `planTagAddition`,
  `planPlatformAddition`, `planGroupAddition` y `auditGroupUi` (el aviso de UI:
  para un grupo, qué archivo falta tocar, con estado `ok|pending` por archivo).
  Inserción de listas: `TAGS`/`APPROVED_TAGS` **alfabética**; el resto **al
  final** (el orden aprobado se preserva y lib/pin deben coincidir posición a
  posición).
  **Matiz verificado (T1)**: `APPROVED_TAGS` guarda el orden histórico de
  aprobación y su suite lo compara **ordenado**, así que ese par se invariante
  por "misma longitud y mismo valor al ordenar"; los otros cuatro pares exigen
  igualdad por índice. Ambas formas insertan en la misma posición alfabética.
  **Matiz (T2)**: el preview del pin usa comillas simples (`+ 'Exposure',`)
  porque el bloque del test está en comillas simples — se previsualizan los
  bytes exactos que se van a escribir.
- **`scripts/registry.js`** (CLI): `parseArgs` (estilo add-content), `list`
  (inventario + huecos: plataformas en el índice sin icono, grupos sin label en
  la UI), lectura de fuentes, plan, impresión completa, `--dry-run` sin escribir,
  sin TTY imprime el plan y sale 1 (nunca cuelga), confirmación `y/N`, escritura
  de lib **y** pin, y al final indica qué tests correr.
- Vocabularios cerrados: icono de plataforma ∈ `wave|server|network|database|bug`
  (los de `Writeup['iconType']`; `bug` es el fallback → se permite con aviso);
  nombre de plataforma/grupo en `^[a-z0-9][a-z0-9-]*$`.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Motor puro `lib/registry.js` + `tests/registry.test.ts` (RED primero) | ✅ | RED (módulo inexistente) → **GREEN 31/31**; invariantes lib↔pin (`expectAlignedAtEveryIndex`); prueba textual tras un `planTagAddition`: lib 21/21 y pin 21/21 alineados |
| T2 | CLI `scripts/registry.js` + `tests/registry-cli.test.ts` (RED primero) | ✅ | RED → **GREEN 30/30**; suite completa **566/566**; sanity: sin args → 1 + usage, `list` → 0 con auditoría (`GAP: none`, tags 20/11/21), `tag Exposure --dry-run` → 0 con preview `+ "Exposure",` en lib y pin sin escribir |
| T3 | Verificación integral (tsc + build + vitest completo + prueba real en seco) | ✅ | `tsc` limpio · `npm test` = **24 archivos / 566 tests verdes** · `list` sin huecos (`GAP: none`, tags 20/11/21) · `tag Exposure --dry-run` muestra el preview en lib y pin sin escribir · re-ejecutar un plan repetido falla por duplicado (no duplica) |
| T4 | Cierre: doc, memoria, commits por unidad, revisión RDD en rangos seguros | ✅ | 4 commits + **4 revisiones aprobadas y quemadas** (una con corrección CRITICAL) |
| T5 | **Cableado automático de UI** (decisión humana posterior: "el script lo escribe todo") | pendiente | |

### T5 — por qué existe (decisión humana, verbatim)

> "la cosa era que **automáticamente se hiciera todo** no que nos dejara trabajo a nosotros"

El usuario registró `hacker-mentor` y quedó **a medio camino**: el motor y su
pin quedaron aplicados pero la UI no. La suite quedó **roja en 3 tests**
(`certifications-model` detecta el drift 3↔4, `content-kinds-api` pinea el
conteo 3, y `registry.test.ts` — un test nuestro — asumía la lista original
de 3). Además, el inventario por grep muestra que un grupo vive en **6 archivos**:

| # | Archivo | Papel |
|---|---|---|
| 1 | `lib/content-kinds.js` | vocabulario (lo escribe el script ✓) |
| 2 | `tests/taxonomy.test.ts` | pin de aprobación (lo escribe el script ✓) |
| 3 | `src/types/index.ts` | unión `Certification['category']` |
| 4 | `src/lib/certificationsModel.ts` | unión de label + `CERTIFICATE_GROUP_LABELS` + `CERTIFICATION_FILTER_CATEGORIES` |
| 5 | `src/components/CertificationsScreen.tsx` | botón de filtro (el badge usa la rama `default` → **no** hace falta case) |
| 6 | `tests/certifications-model.test.ts` | pines de labels/filtros/conteos |
| 7 | `tests/content-kinds-api.test.ts` | esperanza "all 3 canonical groups" |

También se arregla el **test frágil propio** (`registry.test.ts`) que asumía la
lista exacta de grupos — era el que rompía por un registro legítimo.

Para *projects* el inventario equivalente es: `projectsModel.ts` (unión/mapa/
filtros), `ProjectsScreen.tsx` (botón), `projects-model.test.ts` (pines) y, si
se pasa `--icon`, `contentAdapter.ts` + `tests/ui-content-adapter.test.ts`.

### Revisión nativa (RDD on): 4 slices, 4 recibos

| Slice | Commit | Líneas | Tier / lens | Resultado |
|---|---|---|---|---|
| Motor | `25d5184` | 645→657 | medium / reliability | `correction_required` → **corrección de 12 líneas** (`R3-tag-literals`, CRITICAL) → **APROBADA** `review-104331e0e4500915` |
| Tests del motor | `f7400ed` | 761 | medium / reliability | **APROBADA** `review-923cb453ddc524e2` (6 informativos) |
| CLI | `52235cc` | 745 | **high** / 4 lenses (process_boundary) | **APROBADA** `review-22b91098e7257f39` (tras 1 relanzo sancionado) |
| Tests del CLI | `913a2f0` | 431 | medium / reliability | **APROBADA** `review-668eb88dce7659b4` (4 informativos) |

**Hallazgo corregido (el review valió la pena)**: `R3-tag-literals` (CRITICAL) — el tag
escribía **sin escapar** en los dos archivos destino, así que un tag con
apóstrofo, comilla o salto de línea dejaba ambos archivos **sin parsear**
y el plan devolvía `problems: []` aplicándose como un éxito. Se agregó el
guard de comillas/backslashes/control chars (12 líneas) y se verificó con
smoke: `"SQL Injection's"`, `bad\nbreak` y `quote"inside` → problema + 0
archivos; `Good Tag` → plan normal.

**Incidencias de infraestructura registradas** (no del código):
- El amend posterior a la captura del plan de corrección dejó el plan huérfano
  (`corrected_candidate_unavailable` → `captured_artifacts_unverifiable`,
  terminal). Lección: **capturar el plan y aplicar la corrección en ese orden**;
  si hay que enmendar, primero enmendar y luego capturar.
- Dos rechazos del relay (`unknown field "lens"`, `no complete JSON object …
  byte 4766`); el provider pedía STATUS fresco y correr el mismo slot, y el
  relanzo funcionó. Los payloads rechazados quedan en
  `.git/gentle-ai/rejected-results/<lineage>/`.
- Payloads grandes de `capture_group` (4 bindings) se corrompieron al
  serializarse desde el modelo: se resolvió leyendo los bindings con
  `codemode` (JS) desde STATUS y reenviándolos tal cual.

## Commits

```
25d5184 feat(content): pure planner for closed-registry additions (platform, tag, group)
f7400ed test(content): contract suite for the registry planner (31 tests, RED first)
52235cc feat(content): registry CLI for platform, tag and group additions
913a2f0 test(content): contract suite for the registry CLI (30 tests, RED first)
```

Cada commit deja la suite verde por separado (verificado tras cada uno);
el rango completo `9b0d83d..913a2f0` = 2679 líneas, revisado en 4 slices
por debajo del techo comprobado (~850 líneas).

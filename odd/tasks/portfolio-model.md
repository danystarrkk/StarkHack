# Feature: modelo de contenido para portfolio (Fase 1)

- Rama: `feat/content-kinds` (apilada sobre `feat/normalization`)
- Estado: **Fase 1 completada** (T1–T8). Fase 2 detenida a la espera del
  código de frontend que provee el humano.
- Alcance: **solo modelo de contenido y API. Cero cambios de UI en esta fase.**

## Decisiones tomadas por el humano

1. **Orden de ejecución**: modelo primero → frontend → contenido real.
2. **Orden de certificados**: campo `order:` en el frontmatter del `.md`
   (reordenar = tocar un número, sin editar TypeScript).
3. **Reforma de frontend**: el humano proveerá el código del frontend nuevo
   **después**; el orquestador lo analiza, verifica e implementa de a poco
   reemplazando el viejo. Ahí se detiene el avance para afinar. **No se toca
   UI en esta fase.**
4. **Campos de tarjeta de proyecto**: básicos (`title`, `date`, `image`).
   (`description` entra porque el índice ya la propaga y las tarjetas la usan.)

## Contexto medido

- `scripts/generate-index.js` asume exactamente 2 niveles:
  `raiz/<plataforma>/*.md`.
- `lib/content.ts`: 5 exports, todos con forma de plataforma
  (`getPlatforms`, `getMachinesByPlatform`, `fetchWriteup(platform, slug)`
  construye la URL).
- Rutas: `/writeups/:platformId/:slug` — la plataforma está en la URL.
- `Directory`, `Machines`, `Home` y `Writeup` navegan con `platform`.
- `Home.tsx:36` tiene `if (platform === "hackthebox")` hardcodeado.
- `public/index.json` es un array plano sin campo `kind`.

**Consecuencia**: Projects no es una copia de Writeups, es la generalización
del mismo pipeline. 1/2/3 del pedido son **un solo cambio** de modelo.

## Diseño

### Registro de kinds — `lib/content-kinds.js` (fuente única)

```js
export const KINDS = {
  writeup:     { root: 'public/writeups',     platformed: true,  required: ['title', 'date'] },
  project:     { root: 'public/projects',     platformed: false, required: ['title', 'date', 'image'] },
  certificate: { root: 'public/certificates', platformed: false, required: ['title', 'order', 'image', 'description'] },
};
```

Mismo patrón que `frontmatter.js` y `taxonomy.js`: ESM plano + JSDoc,
importable por Node y por el bundler sin loaders.

### Raíces de contenido (no se mueve lo existente)

```
public/writeups/<platform>/<slug>.md          + <slug>/media/     (igual que hoy)
public/projects/<slug>.md                     + <slug>/media/
public/certificates/<slug>.md                 + <slug>/media/
```

**No se migra `public/writeups/`** — otra migración masiva = otro candidato
que rompe el presupuesto de review (ya nos pasó con 814 archivos).

### `public/index.json`

Un solo archivo, ahora con **`kind`** en cada entrada. La plataforma sigue
solo en `kind: 'writeup'`. `path` conserva el formato actual por kind.

### Validación (fail-loud, igual que la de metadata y tags)

- Campos requeridos **por kind** → error con `filePath` y campos faltantes.
- `order` de certificados: entero presente. ¿Único? → se define en T3
  (recomendado: rechazar duplicados para que el orden sea determinista).
- Tags → `assertValidTags` solo donde el writeup tenga tags (ya permite
  ausentes). Las imágenes siguen la convención `media/` con los tests de
  deriva existentes ampliados a las dos raíces nuevas.

### `lib/content.ts` — sin regresión

- Las funciones existentes **filtran `kind === 'writeup'`** dentro de la capa
  de API, para que la UI actual no vea proyectos ni certificados como
  máquinas. **La UI no se toca y el comportamiento visible no cambia.**
- Nuevos: `getProjects()`, `getCertificates()` (ordenado por `order`),
  `fetchProject(slug)`, `fetchCertificate(slug)`.

### Verificación de no-regresión

`public/index.json` regenerado: las 16 entradas de writeups deben conservar
exactamente sus campos actuales, más `kind`.

### Clasificadores y etiquetas por kind (extensión aprobada)

Aclaración clave: **`group` y `tags` no son lo mismo**, y cada kind declara
sus **propias** listas cerradas. Ninguna taxonomía comparte constantes con
otra.

| | `group` (clasificador, **1 por entrada**) | `tags` (**1..N**, vocabulario propio) |
|---|---|---|
| writeup | — (tiene `platform`) | 20 existentes en `lib/taxonomy.js` |
| project | `PROJECT_GROUPS` (3) | `PROJECT_TAGS` (11) |
| certificate | `CERTIFICATE_GROUPS` | `CERTIFICATE_TAGS` (8) |

**Listas aprobadas por el humano:**

```js
// lib/content-kinds.js — estructura del kind
export const PROJECT_GROUPS     = ['scripts', 'automatizaciones', 'herramientas'];
export const CERTIFICATE_GROUPS = ['universidad', 'hack4u', 'cisco'];   // emisor/plataforma

// lib/taxonomy.js — vocabularios de etiquetas (junto a TAGS de writeups)
export const PROJECT_TAGS = [
  'CLI Utilities', 'Recon', 'OSINT', 'Scanning', 'Networking', 'Web',
  'Cryptography', 'Parsers', 'Integrations', 'Reporting', 'Databases',
];
export const CERTIFICATE_TAGS = [
  'Networking', 'Cloud', 'Forensics', 'Web Security', 'Cryptography',
  'Systems', 'Incident Response', 'Auditing',
];
```

**Reglas de validación** (fail-loud con `filePath`, igual que todo lo demás):

```
project     → group ∈ PROJECT_GROUPS (obligatorio)   tags ≥1, ⊆ PROJECT_TAGS
certificate → group ∈ CERTIFICATE_GROUPS (oblig.)    tags ≥1, ⊆ CERTIFICATE_TAGS
writeup     → sin cambios (20 tags, hoy opcionales)
```

**API nueva** (`lib/content.ts`): `getProjects(group?)`,
`getProjectGroups()` y `getCertificateGroups()` devuelven los grupos **en
orden canónico incluidos los vacíos** para que el frontend pinte secciones
estables, y `getCertificates()` sigue ordenado por `order`.

Todo esto se implementa **antes del frontend** para que la Fase 2 no tenga
que inventar la forma de los datos.

**Decisiones abiertas (no implementadas sin que las definas):**

1. ¿Los tags de writeups pasan a ser obligatorios ≥1? Hoy son opcionales
   aunque los 16 actuales traen 4–6. Se deja **sin cambio** por ahora.
2. `CERTIFICATE_GROUPS` usa el criterio **emisor/plataforma** (opción (a)
   del borrador). Si más adelante querés el «tipo de estudio» como campo
   aparte, se agrega como campo nuevo, no mezclando la lista.

## Tareas

- [x] T1. Rama, documento de feature, `todo` y mirror Engram (mirror fallido:
      servidor Engram caído, documentado).
- [x] T2. `lib/content-kinds.js` (KINDS + `missingFields`) — RED A: módulo
      inexistente.
- [x] T3. Generador a 3 raíces + validación por kind — RED B: 12 fallos
      (project sin `image`, certificado sin `order`, `order` string/decimal/
      duplicado, writeup sin `title`, archivo sin frontmatter).
- [x] T4. `index.json` con `kind` + no-regresión: **diff de 16 líneas
      agregadas y 0 borradas**.
- [x] T5. `lib/content.ts`: `fetchIndex()` solo-writeups por contrato +
      `fetchIndexByKind`, `getProjects`, `getCertificates`, `fetchProject`,
      `fetchCertificate` — RED C: 9 fallos.
- [x] T6. `types.ts` con `ContentKind` y deriva de sync/media sobre las
      3 raíces vía `KINDS`.
- [x] T7. Verificación final: **PASS en las 9 verificaciones** (126/126,
      `tsc` 0, `build` 0, regeneración byte idéntica, cero archivos UI
      tocados, 16 entradas `kind: writeup` todas con `platform`, raíces
      ausentes toleradas en doble corrida).
- [x] T8. Cierre con commits por unidad de trabajo.
- [ ] T9. Vocabularios: `PROJECT_TAGS` y `CERTIFICATE_TAGS` en
      `lib/taxonomy.js`; `PROJECT_GROUPS` y `CERTIFICATE_GROUPS` en
      `lib/content-kinds.js` + tests de su contrato (orden, sin duplicados,
      contenido exacto).
- [ ] T10. Validación en el generador (RED con fixtures): proyecto sin
      `group`, `group` fuera de la lista, sin tags, tag desconocido;
      certificado sin `group`, sin tags, tag desconocido.
- [ ] T11. API: `getProjects(group?)`, `getProjectGroups()`,
      `getCertificateGroups()` con tests (orden canónico, conteos,
      grupo vacío, filtrado).
- [ ] T12. Deriva extendida: todo contenido real cumple group + tags por
      kind.
- [ ] T13. Verificación final y cierre de la extensión.

## Fuera de alcance de esta fase

- Cualquier cambio de UI, rutas o nav (Fase 2: código del frontend que provee
  el humano).
- Contenido real de proyectos y certificados (Fase 3).
- Migración de la raíz `public/writeups/`.

## Evidencia de commits

| Commit | Tareas |
|---|---|
| `e1049dc` docs: plan de la fase 1 del modelo de contenido para portfolio | T1 |
| `7834191` feat: modelo de contenido con 3 kinds (writeup, project, certificate) | T2–T6 |
| _(este commit)_ docs: cierre de la fase 1 | T7, T8 |

### Decisiones de implementación registradas

- Orden del índice: fechas parseables descendentes primero; sin fecha al
  final; dentro del mismo fecha, los certificados usan `order` ascendente.
  `getCertificates()` ordena por `order` para la vista.
- `fetchIndex()` devuelve **solo writeups por contrato** — así la UI actual
  (sin tocar) no empieza a listar proyectos como máquinas.
- `assertValidTags` sigue siendo de writeups: los tags cerrados son del
  sistema de writeups; proyectos/certificados pueden traer otros labels.
- Drafts se saltean antes de validar en **todos** los kinds.
- Log del índice renombrado a `Failed to fetch content index:` (servía a
  los 3 kinds).

## Cierre

- **Fase 1 terminada**: la rama `feat/content-kinds` tiene el pipeline
  generalizado a 3 kinds con **126/126 tests**, `tsc` y `build` en verde,
  `index.json` byte idéntico salvo el `kind` agregado, y **cero archivos
  UI modificados** (verificado con `git show` sobre el commit).
- **Siguiente paso**: Fase 2 — el humano entrega el código del frontend
  nuevo; el orquestador lo analiza, verifica e implementa de a poco
  reemplazando el viejo. Ahí se detiene para afinar.
- Fase 3 pendiente: contenido real de proyectos y certificados siguiendo
  la convención ya validada (`.md` + `media/` + campos requeridos por kind).

## Review nativo de esta fase: NO EJECUTADO (decisión humana)

- Preflight fallido en `review.start` con **`lens_context_budget_exceeded`**
  (`mutation_performed: false`, `next_action: stop`, `retry_safe: true`):
  no se creó autoridad de review, no hay nada que reparar.
- **Causa estructural**: el candidato se mide contra `base_ref = main`, así
  que mientras la pila no se fusione cada review incluye los 788 renames de
  imagen, `package-lock.json` y todo lo acumulado. Repetir el intento falla
  siempre igual.
- Opciones ofrecidas: slice con `baseRef` explícito (solo esta fase, 11
  archivos), dejarlo sin revisar, o fusionar a main para reducir el
  candidato futuro.
- **Decisión del humano: dejarlo sin revisar.** Respaldado por 126/126
  tests, `tsc` y `build` en verde, `index.json` byte idéntico salvo `kind`,
  y cero archivos UI tocados.

## Excepción de presupuesto concedida (decisión humana)

- Posteriormente el humano ordenó correr el RDD de todos modos. Se ejecutó
  un review por slices con `baseRef` explícito:
  - **Slice A** (`baseRef = 8bcadb3`, 13 archivos: esta fase + docs) →
    **`approved`**, linaje `review-99d9c39dce010d50`, target
    `sha256:1bc47ddb…`, autoridad quemada (`gentle-ai.review-acknowledged/v1`).
    Hallazgos admisibles: `R3-flat-kind-platform-key` (WARNING,
    `scripts/generate-index.js:163-170`), `R3-order-fallback-untested`
    (SUGGESTIÓN, `lib/content.ts:57-61`), `R3-samedate-scan-order-tiebreak`
    (SUGGESTIÓN, `scripts/generate-index.js:104-118`).
  - **Slice B** (`baseRef = cfe2741`, incluye la migración de imágenes) →
    `lens_context_budget_exceeded`, sin autoridad creada.
- **El humano concedió excepción de presupuesto y ordenó avanzar.** El tramo
  `e62b6c2`→`8bcadb3` (normalización + imágenes) queda **aceptado sin acuse
  de review** por decisión del dueño del repo. Esto NO es un acuse: es un
  waiver de gestión, y ningún documento debe citarlo como review aprobado.

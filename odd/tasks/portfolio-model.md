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

# Feature: modelo de contenido para portfolio (Fase 1)

- Rama: `feat/content-kinds` (apilada sobre `feat/normalization`)
- Estado: en curso
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

- [ ] T1. Rama, documento de feature, `todo` y mirror Engram.
- [ ] T2. `lib/content-kinds.js` + tests de su contrato.
- [ ] T3. Generador generalizado a 3 raíces + validación de campos por kind
      (RED observado con fixtures: proyecto sin `image`, certificado sin
      `order`, `order` duplicado).
- [ ] T4. `index.json` con `kind` + regeneración + verificación de
      no-regresión de las 16 entradas de writeups.
- [ ] T5. `lib/content.ts`: filtro `kind` en las APIs existentes (sin regresión
      de la UI) + `getProjects`/`getCertificates`/`fetchProject`/`fetchCertificate`
      con tests.
- [ ] T6. `types.ts` ampliado y tests de deriva de imágenes extendidos a
      `public/projects/` y `public/certificates/`.
- [ ] T7. Verificación final completa.
- [ ] T8. Cierre con commits por unidad de trabajo.

## Fuera de alcance de esta fase

- Cualquier cambio de UI, rutas o nav (Fase 2: código del frontend que provee
  el humano).
- Contenido real de proyectos y certificados (Fase 3).
- Migración de la raíz `public/writeups/`.

## Evidencia de commits

- (pendiente)

## Cierre

- (pendiente)

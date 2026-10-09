# Feature: `edit-content` — edición interactiva de contenido YA publicado

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Pedido del humano (verbatim fiel)

> para los 3 necesito poder editar los que ya están subidos… editar los `.md`
> de contenido no tiene problema; **donde tenemos problema es en cambios de
> imágenes o cambios de numeración** (en los certificados), porque esas
> ediciones están enlazadas con las imágenes, igual que en projects y
> writeups. Necesitamos un **script especializado, interactivo, que detecte
> todos ellos**. Y para **metadatos**: no es solo alterar la lista de tags sino
> **enlazarlos**. Analízalo: si encuentras más, inclúyelos. Con esto cerramos
> la automatización y la edición de contenidos subidos.

**Alcance elegido por el humano: completo, con rename de slug/mover de plataforma.**

## Análisis: todo lo que es "complicado de cambiar a mano" (los cabos sueltos)

### A. Imágenes y numeración (el dolor principal)
1. **Reemplazar la cover**: el nombre de destino es fijo `media/cover.webp`;
   hay que convertir el origen a webp y sobrescribir (nunca renombrar), y
   refrescar la clave `image:` del frontmatter si aplica.
2. **Reemplazar/agregar/quitar evidencias numeradas** (`01..NN`): el cuerpo
   referencia `![imgN](<sitePath>/media/NN.webp)`. Renumerar **exige**
   reescribir el cuerpo, si no rompe la referencia.
3. **Regla de huérfanos** (`tests/media.test.ts`): todo archivo bajo `media/`
   debe estar referenciado por el cuerpo o por `image:`. Quitar una imagen del
   cuerpo **sin borrar el archivo** deja huérfano y rompe el gate. Agregar un
   archivo sin referenciarlo, igual.
4. **Prefijo obligatorio**: toda referencia debe vivir bajo
   `/<kind-root>/<slug>/media/` (también pineado por `media.test.ts`).
5. **Cover de writeups = `level`** (no hay archivo): cambiar `level` cambia la
   imagen que muestra la UI, no el disco. Cambiar `level` a otro que no sea
   `Easy|Medium|Hard` rompe el índice (validado fail-loud).

### B. Numeración de certificados
6. **`order` debe ser entero ÚNICO** (`generate-index.js` tira
   `Duplicate certificate order` / `Invalid certificate order`). Cambiar el
   orden de un certificado **puede chocar** con otro: el plan debe detectar la
   colisión y resolverla (renumerar el resto en cascada o rechazar).

### C. Metadatos enlazados (no son texto suelto)
7. **`group`**: vocabulario cerrado por kind (`PROJECT_GROUPS`,
   `CERTIFICATE_GROUPS`). Cambiarlo re-clasifica filtros y sellos de la UI.
8. **`tags`**: vocabulario cerrado por kind (`TAGS`, `PROJECT_TAGS`,
   `CERTIFICATE_TAGS`). Editar la lista a mano es fácil; **enlazarla bien**
   (solo valores válidos, ≥1 para project/certificate) es lo que rompe.
9. **`date`**: requerida en writeup/project, opcional en certificate; gobierna
   el orden del índice (fecha primero). Un valor ilegible cae al final.
10. **`draft: true`** oculta la entrada del índice (el generador la saltea):
    cambiarlo altera los conteos públicos.
11. **`platform`** (writeups): no está en el frontmatter, se deriva del
    directorio → moverlo es un cambio de estructura, no de texto.

### D. Renombres (los más peligrosos)
12. **Renombrar slug**: mueve `<root>/<slug>.md` y `<root>/<slug>/`, y hay que
    reescribir `path`, `slug`, la clave `image:` y **todas** las referencias
    del cuerpo al `sitePath` nuevo; si algo queda atrás, la UI enlaza a 404.
13. **Mover de plataforma** (writeups): ídem con `<root>/<platform>/<slug>`.

### E. Validación posterior
14. Tras cualquier cambio hay que **regenerar `public/index.json`**
    (`generate-index.js` es idempotente → sirve de chequeo) y que
    `npm test` siga verde (huérfanos, prefijos, vocabularios, índices).

## Diseño (mismo patrón aprobado que `add-content`: motor puro + CLI)

```
node scripts/edit-content.js <writeup|project|certificate> <slug> [--dry-run]
```

- **`lib/content-edit.js`** (puro, sin I/O — estilo `lib/content-ingest.js`):
  `planContentEdit({ kind, slug, markdown, media, changes })` →
  `{ problems, frontmatter, rewrittenBody, fileOps, imageOps, sitePath,
     targetDir, markdownPath, renamed? }`. Vocabulario **verbatim** de
  `lib/content-kinds.js` / `lib/taxonomy.js` / `WRITEUP_LEVELS`. Sin I/O:
  ni fs, ni path, ni process.
- **`scripts/edit-content.js`** (CLI, estilo `scripts/add-content.js`):
  1. Carga `.md` + lista `media/` + referencias del cuerpo.
  2. **Inventario interactivo**: qué se puede editar en ESTE contenido (detecta
     los casos A–D que aplican), con valores actuales.
  3. Menú TTY: metadatos (con vocabulario cerrado y prompt de opciones),
     imágenes (reemplazar cover / evidencias, con conversión ImageMagick) y
     rename (slug/plataforma) con confirmación explícita.
  4. Imprime el **plan completo** antes de actuar; `--dry-run` no toca el disco
     y es byte-idempotente; problemas → exit 1 sin escribir nada.
  5. Aplica (convert, move, write) y **regenera el índice** (fail-loud).
  6. Sin TTY: imprime el inventario y sale con 1 — nunca se cuelga.
- **Tests** (RED primero): `tests/content-edit.test.ts` (motor) +
  `tests/edit-content.test.ts` (CLI, como `tests/add-content.test.ts`).

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Motor puro `lib/content-edit.js` + `tests/content-edit.test.ts` (RED primero) | pendiente | |
| T2 | CLI `scripts/edit-content.js` + `tests/edit-content.test.ts` (RED primero) | pendiente | |
| T3 | Verificación integral (tsc + build + vitest completo + idempotencia real sobre el contenido existente) | pendiente | |
| T4 | Cierre: doc, memoria, commits por unidad, revisión RDD por rangos chicos | pendiente | |

## Commits

(pendiente)

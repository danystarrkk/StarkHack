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
| T1 | Motor puro `lib/content-edit.js` + `tests/content-edit.test.ts` (RED primero) | ✅ | RED (módulo inexistente) → **GREEN 38/38**; smoke de solo-lectura sobre los 17 documentos publicados: `changes:{}` = no-op byte-idéntico en 17/17 |
| T2 | CLI `scripts/edit-content.js` + `tests/edit-content.test.ts` (RED primero) | ✅ | RED → **GREEN 20/20**; sin TTY imprime inventario (8 aspectos) y sale con 1 sin colgarse (`timeout 15` verificado) |
| T3 | Verificación integral (tsc + build + vitest completo + idempotencia real sobre el contenido existente) | ✅ | `tsc` limpio · `npm test` = **22 archivos / 495 tests verdes** · idempotencia real: certificado y `wave.md` → `problems=0`, cuerpo byte-idéntico, `fileOps` vacío · `git status` sin mutaciones |
| T4 | Cierre: doc, memoria, commits por unidad, revisión RDD por rangos chicos | ✅ | 2 commits de unidad + **waiver de presupuesto** (abajo) |

### Excepción de presupuesto de revisión (decisión humana, verbatim)

> **Waiver documentado** — no se intenta la revisión nativa de `edit-content`.

Justificación medida:
- `edit-content` son **2679 líneas** en 4 archivos (planner 802 + sus tests 782,
  CLI 753 + sus tests 342).
- El techo comprobado en esta sesión: **552 y 845 líneas → aprobadas**;
  **961 líneas → `unachievable_lens_slot`, relay cortado a 980651 ms** de un
  bound de 980646 ms (prompt de 93959 bytes), declarado **determinista** por el
  proveedor.
- La unidad natural mínima (planner con sus tests = 1584 líneas ≈ 155 KB) ya
  triplica lo que pasó y duplica lo que falló → intentarlo sería casi seguro
  otro timeout, contra la instrucción explícita del humano de no intentar
  tamaños que van a fallar.
- Alternativas ofrecidas (4 commits chicos código|tests, subir
  `GENTLE_PI_REVIEW_RELAY_PI_TIMEOUT_MS`, o waiver) → **el humano eligió waiver**.

Lo que sí queda verificado (sustituye al review en esta ocasión):
- **Test-first real** en ambas unidades: RED observado y GREEN en 38 + 20 tests.
- **Suite completa en verde**: 22 archivos / 495 tests, `tsc` limpio, build OK.
- **Idempotencia sobre contenido real**: los 17 documentos publicados pasan
  `planContentEdit(changes:{})` sin problemas ni cambios de byte.
- **Purity**: `lib/content-edit.js` no importa `node:fs|path|child_process` ni
  usa `process` (grep verificado).
- **Safety del CLI**: sin TTY nunca cuelga ni escribe; `--dry-run` no toca el
  disco; confirmación `y/N` antes de aplicar; pre-flight de `magick` y de
  colisión de destino antes de mover; todo movimiento confinado a `public/`.

Estos hallazgos se tratan como **deuda de revisión conocida**, no como aprobación:
cualquier cambio futuro sobre `lib/content-edit.js` o `scripts/edit-content.js`
dispara una revisión nueva sobre su propio candidato.

## Commits

(pendiente)

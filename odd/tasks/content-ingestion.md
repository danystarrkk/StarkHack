# Feature: automatización de creación de contenido (writeups / projects / certificates)

- Rama: `feat/frontend-migration`
- Estado: **Fase ejecutada y cerrada** (T1–T4 hechos, gate en verde)

## Decisiones tomadas por el humano (verbatim / resumen fiel)

1. **Faltantes de frontmatter** → **modo interactivo**: el CLI pregunta campo por
   campo (title, date, group, tags…). Falla igual si se corre sin TTY.
2. **Imágenes sin referenciar en el .md** → **no insertar nada en el cuerpo**.
   Si el .md no trae `[[img.png]]` ni `![](ruta)`, solo va la cover al
   frontmatter y el usuario ubica las evidencias a mano donde corresponda.
3. **Cover**:
   - **Writeups**: NO se elige — está estandarizado por dificultad
     (`level` → `/ui/{easy,medium,hard}.webp`, ya implementado). El CLI solo
     debe exigir/validar `level`.
   - **Projects y certificates**: el usuario **especifica el cover por nombre**
     (`--cover <archivo>`) — porque en la carpeta pasada el cover puede no
     estar, o puede haber varios candidatos ambiguos. Control explícito.
4. **Inputs**: certificates → imagen directa (archivo suelto); writeups y
   projects → carpeta de referencia de la que se mapean las imágenes
   (muchas por writeup).
5. `newImg/` es temporal: se copia a `public/` y el usuario lo borra después.

## Formato del markdown (ya validado por lib/content-kinds.js + generate-index.js)

| Campo | Writeup | Project | Certificate |
|---|---|---|---|
| required | `title`, `date` | `title`, `date`, `image` | `title`, `order` (int único), `image`, `description` |
| clasificación | `platform` ← deriva del directorio (no se escribe) | `group` ∈ PROJECT_GROUPS | `group` ∈ CERTIFICATE_GROUPS |
| tags | ⊆ TAGS (20) | ⊆ PROJECT_TAGS (11) | ⊆ CERTIFICATE_TAGS (8) |
| derivados | `slug` ← filename, `path`, cover ← `level` | `slug`, `path` | `path`, orden de muestra ← `order` |
| opcionales | `description`, `level` (Easy\|Medium\|Hard), `cve`, `draft` | — | — |

**Gap detectado**: `level` NO está validado en el índice → "Medio"/"Easy "
rotos en silencio = tarjeta sin cover. Se agrega validación (ver T4).

## Diseño del CLI (Fase B)

```
node scripts/add-content.js writeup     <archivo.md> --images <carpeta> [--platform X] [--level Medium]
node scripts/add-content.js project     <archivo.md> --images <carpeta> --cover <archivo> [--group scripts]
node scripts/add-content.js certificate <archivo.md> --image <imagen> [--cover <archivo>]   # imagen directa
```

Pipeline (siempre con `--dry-run` primero, idempotente, jamás destructivo
sobre el origen):
1. Lee `.md` de donde esté; valida frontmatter contra `KINDS` (fail-loud con
   path + campos exactos; en TTY, prompts interactivos para completar).
2. Crea `<root>/<platform>/<slug>/` (o plano en project/certificate).
3. Imágenes: png/jpg → **webp** (ImageMagick), numeradas `01..NN` en orden
   alfabético estable dentro de `media/`.
4. Reescribe referencias existentes (`[[img.png]]`, `![](ruta)`) →
   `![imgN](/<root>/.../media/NN.webp)`. Sin referencias → cuerpo intacto.
5. Cover: writeup = `level` (ya resuelto en UI); project/certificate =
   `--cover` copiado como `media/cover.webp`.
6. Ejecuta `generate-index.js` → `public/index.json`.

## Tareas

- [x] T1: `lib/content-ingest.js` — lógica pura (plan de archivos, rewrite de
  referencias, selección de cover, derivación de slug/platform) + TDD
  `tests/content-ingest.test.ts` (RED primero, 37 tests).
- [x] T2: `scripts/add-content.js` — runner CLI (args, prompts interactivos,
  conversión webp vía magick, dry-run, orquestación con generate-index) +
  `tests/add-content.test.ts` (25 tests, RED primero).
- [x] T3: gate + evidencia + commits por tarea (ver abajo).
- [x] T4: validar `level` ∈ Easy|Medium|Hard en `generate-index.js` con error
  fail-loud + tests (3, RED primero); sin cambiar `required` — level sigue
  siendo opcional, pero si está debe ser exacto.

### Fix de integración detectado por el smoke end-to-end

El primer E2E real (sin `--dry-run`) escribió `<slug>/<slug>.md`, pero la
disposición que escanea el indexador es **`<slug>.md` hermano de la carpeta
`media/`** — el writeup quedó invisible (16 en vez de 17). Corregido test-first:
`markdownPath` nuevo en el plan T1, CLI escribe ahí, tests de ambas capas
actualizados al contrato correcto. Verificado: E2E → `Generated index.json
with 17 writeups`, cuerpo reescrito (`[[02.jpg]]` → `![img2](/writeups/…)`),
webp convertidos, fixture limpiado después.

## Evidencia de commits

| Commit | Tarea |
|---|---|
| `09e8237` | T1 — modelo puro de ingesta + 37 tests (RED-first) |
| `219f4f2` | T2 — CLI interactivo + dry-run + 25 tests (RED-first) |
| `d601391` | fix — `.md` hermano de `media/` (descubierto por el E2E) |
| `f0c1002` | T4 — validación de `level` en el indexador + 3 tests (RED-first) |

## Cierre

- Gate: **404/404 (20 archivos)** · `tsc --noEmit` 0 · `npm run build` 0.
- Verificación manual E2E exitosa (writeup con 2 imágenes: conversión webp,
  reescritura de referencias, indexación 17/17, cover por level).
- Flujo de uso (los 3 comandos) documentados arriba; prompts solo en TTY,
  non-TTY falla con los problemas verbatim (nunca cuelga).
- Deuda pendiente conocida: conversión webp y camino de éxito de
  `project`/`certificate` verificados solo en `--dry-run` (el E2E real de
  writeup sí corrió). Probar con contenido real cuando se publique el primer
  project/certificate.

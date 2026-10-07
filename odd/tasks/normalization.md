# Feature: normalización de tags y especialización de imágenes

- Rama: `feat/normalization` (apilada sobre `fix/review-reliability-findings`)
- Estado: en curso
- Diseño aprobado por el humano el turno anterior (lista de 20 tags tal cual).

## Diagnóstico (medido, 16 writeups)

**Tags**: 106 asignaciones, 70 distintos. 58 de 70 se usan **una sola vez** →
los filtros del Directory son inútiles. Duplicados semánticos: `Remote Code
Execution`/`Authenticated RCE`/`Unauthenticated RCE`/`Remote Command
Execution`, `Server-Side Request Forgery`/`…(SSRF)`, `Container Breakout`/
`Container Escape`, `Password Reuse`/`Credential Reuse`, etc. Los CVE están
mezclados como tag.

**Imágenes**: `public/images/` con 788 archivos en una boveda plana.
713 referencias distintas (697 en cuerpos + 16 portadas), **0 rotas**,
**73 huérfanas reales**, **2 assets de UI** (`stark.webp` avatar y
`logo.webp` favicon), **0 compartidas entre writeups**, todas absolutas
(`/images/…`).

Cuatro sitios de código dependían del prefijo `/images/` y entraron en el
alcance (detectados al planificar, no en la primera medición):

| Sitio | Dependencia |
|---|---|
| `index.html:8` | favicon `/images/logo.webp` |
| `pages/Writeup.tsx:44` | `handleError` solo reintenta si `src` empieza con `/images/` |
| `components/Layout.tsx:62` y `pages/About.tsx:11` | avatar `stark.webp` |
| `scripts/markdown.py:69` | genera refs `/images/…` → reintroduciría la boveda |

## Diseño aprobado

### 1. Taxonomía: lista plana cerrada de 20 tags

Fuente única `lib/taxonomy.js` (ESM + JSDoc, como `frontmatter.js`, para que
la consuman Node y el bundler sin loaders):

- `TAGS` — los 20 canónicos ordenados alfabéticamente.
- `assertValidTags(tags, context)` — falla con `filePath` + tag ofensivo.

Los 70 actuales mapean a los 20 con **0 sin mapear**. Resultado: los 4
primeros cubren 51 de 106 asignaciones y cada writeup queda con 4–6 tags.

| Tag | Writeups |
|---|---|
| Privilege Escalation | 16 |
| Information Disclosure | 13 |
| Remote Code Execution | 11 |
| Credential Exposure | 11 |
| Access Control Bypass | 5 |
| Misconfiguration | 4 |
| File Upload, SSRF, Container Escape, Path Traversal, Broken Authentication | 2 c/u |
| SQL Injection, XML External Entity, File Inclusion, JWT Attack, Exposed Service, Business Logic, Buffer Overflow, Vulnerable Component, Pivoting | 1 c/u |

Juicios explícitos aprobados: `Vulnerable Component` absorbe
`WordPress Vulnerability` y es el hogar natural de los CVE; `Pivoting`
absorbe `SSH Port Forwarding`. **Los CVE salen de `tags` a campo propio
`cve:`** (`CVE-2021-4034`, `CVE-2020-35234`, `CVE-2023-5965`).

Aplicación en tres puntos: validación en `generate-index.js` (fail-loud),
test de deriva, y chips del Directory derivados del índice ya validado.

### 2. Imágenes: carpeta `media/` propia de cada writeup

```
public/writeups/hackmyvm/
├── wave.md
└── wave/
    └── media/
        ├── cover.webp        ← portada (frontmatter image:)
        └── 01.webp … NN.webp ← capturas en orden de aparición en el .md
```

- `public/images/` **desaparece**.
- `stark.webp` y `logo.webp` → `public/ui/` (son UI: avatar y favicon).
- Las 73 huérfanas → `public/_archive/unreferenced/` (recuperables).
- Renombrado normalizado `01…NN` (aprobado por el humano).
- Migración por script idempotente con `--dry-run`: mueve y reescribe el
  prefijo de las 713 referencias respetando `%20` codificado, luego
  regenera `public/index.json`.

### Salvaguardas

1. Rama nueva apilada; nada se escribe antes de este documento.
2. Script con `--dry-run` y reporte antes de mover.
3. Tests de deriva: todo tag ∈ `TAGS` · toda referencia de imagen existe ·
   0 huérfanas · toda portada declarada existe.
4. Verificación final: `npm test` + `tsc` + `build` + grep de que no queda
   ni un `/images/` **en código y contenido** (el presente documento cita la
   convención vieja por ser histórico) + preview manual de 3 writeups.
5. Nada se borra: las huérfanas se archivan, no se eliminan.

## Tareas

- [ ] T1. Rama `feat/normalization`, documento de feature, mirror y `todo`.
- [ ] T2. `lib/taxonomy.js` con `TAGS` (20) + `assertValidTags` y su test.
- [ ] T3. Remapear los 70 tags → 20 en los 16 `.md`; mover los 3 CVE a
      `cve:`; regenerar `index.json`; test de deriva de tags en verde.
- [ ] T4. `pages/Directory.tsx`: chips de filtro desde los tags del índice.
- [x] T5. Script de migración de imágenes con `--dry-run` + puerta de 5
      invariantes (`scripts/migrate-images.js`, queda commiteado).
- [x] T6. Migración ejecutada: 713 movidas a `media/`, 731 referencias
      reescritas (697 cuerpo + 16 portada), 2 UI a `public/ui/`, 73 huérfanas
      a `_archive/`, `public/images/` eliminado. Idempotente (2da y 3er run
      = "nothing to migrate"). Los 4 sitios de código actualizados.
- [x] T7. Tests de deriva de imágenes (`tests/media.test.ts`, 6 casos, RED
      previo) + `index.json` regenerado con las portadas nuevas.
- [ ] T8. Verificación final completa.
- [ ] T9. Cierre: commits por unidad de trabajo y evidencia.

## Evidencia de commits

- (pendiente)

## Cierre

- (pendiente)

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
**75 huérfanas**, **0 compartidas entre writeups**, todas absolutas
(`/images/…`). `stark.webp` es de UI (avatar del Layout), no de un writeup.

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
public/writeups/hackmyvm/wave/
├── wave.md
└── media/
    ├── cover.webp        ← portada (frontmatter image:)
    ├── 01.webp … 59.webp ← capturas en orden de aparición en el .md
```

- `public/images/` **desaparece**.
- `stark.webp` → `public/ui/` (es UI, no contenido).
- Las 75 huérfanas → `public/_archive/unreferenced/` (recuperables).
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
   ni un `/images/` + preview manual de 3 writeups.
5. Nada se borra: las huérfanas se archivan, no se eliminan.

## Tareas

- [ ] T1. Rama `feat/normalization`, documento de feature, mirror y `todo`.
- [ ] T2. `lib/taxonomy.js` con `TAGS` (20) + `assertValidTags` y su test.
- [ ] T3. Remapear los 70 tags → 20 en los 16 `.md`; mover los 3 CVE a
      `cve:`; regenerar `index.json`; test de deriva de tags en verde.
- [ ] T4. `pages/Directory.tsx`: chips de filtro desde los tags del índice.
- [ ] T5. Script de migración de imágenes con `--dry-run` + reporte.
- [ ] T6. Ejecutar la migración: mover a `media/`, reescribir 713
      referencias, `stark.webp` → `public/ui/`, huérfanas → `_archive/`.
- [ ] T7. Tests de deriva de imágenes (referencias existentes, 0 huérfanas,
      portadas declaradas) + regenerar `index.json`.
- [ ] T8. Verificación final completa.
- [ ] T9. Cierre: commits por unidad de trabajo y evidencia.

## Evidencia de commits

- (pendiente)

## Cierre

- (pendiente)

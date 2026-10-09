# Feature: la imagen del certificado aparece en su tarjeta (y sin cabos sueltos)

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Problema reportado (verbatim fiel)

> la imagen no aparece en su tarjeta de certificado, eso debería aparecer.
> Además, en la carpeta de certificados tenemos la imagen con el número pero
> también un `cover` que no tiene ningún identificador, como si fuera a
> utilizarse como general, cuando cada certificado lleva su imagen.

Verificación en 3 puntos pedida: (1) el apartado de certificados, (2) la
plantilla cuando se genera, (3) el script de automatización.

## Diagnóstico (evidencia, con path:línea)

**Punto 1 — la tarjeta: la cadena está rota en 2 eslabones**

| Eslabón | Estado | Evidencia |
|---|---|---|
| frontmatter → `public/index.json` | ✅ OK | `public/index.json` trae `"image": "/certificates/certificado/media/cover.webp"` |
| índice → objeto UI | ❌ roto | `src/lib/contentAdapter.ts:126` `toUiCertification` no mapea `image` (writeup/project sí) |
| tipo UI | ❌ roto | `src/types/index.ts:135` `Certification` no declara `image` |
| tarjeta → DOM | ❌ roto | `src/components/CertificationsScreen.tsx` `renderDiplomaThumbnail` nunca renderiza `<img>`: dibuja un diploma sintético con CSS/iconos |

**Punto 2 — la plantilla**

- Frontmatter que genera `add-content.js`: ✅ correcto — `image` es `required`
  del kind `certificate` (`lib/content-kinds.js`) y el motor lo deriva a
  `<sitePath>/media/cover.webp` (`lib/content-ingest.js`).
- Plantilla de la tarjeta: ❌ es ahí donde vive el hueco (tipo + adapter + componente).

**Punto 3 — el script de automatización**

- `cover.webp` **no es una cover general**: vive dentro de la carpeta de cada
  certificado (`public/certificates/<slug>/media/cover.webp`) y cada
  frontmatter apunta a la suya. El nombre es fijo por convención, el archivo
  es por certificado.
- Bug real: para `certificate`, `planContentIngestion` planifica la MISMA
  imagen dos veces (`media/01.webp` + `media/cover.webp`; md5 idéntico
  `93f7ffa…`). Con el cuerpo vacío, nadie referencia `01.webp` → huérfano.
- Tests rojos hoy (2):
  - `tests/media.test.ts` → "no orphans …" falla por `public/certificates/certificado/media/01.webp`.
  - `tests/certifications-model.test.ts:318` → pinea "hoy hay 0 certificados" y ahora hay 1.

## Decisiones tomadas por el humano

1. **Diseño de tarjeta**: la imagen real del cover ocupa el recuadro de la
   miniatura; si un certificado no trae imagen se dibuja el diploma sintético
   como fallback (nunca una imagen inventada).
2. **Duplicado `01.webp`**: corregir el script para que `certificate` no duplique
   la imagen numerada salvo que el cuerpo la referencie, y borrar el huérfano
   actual. El test de huérfanos queda verde sin relajar la convención.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Adaptador + tipo: `toUiCertification` mapea `image`; `Certification.image?` (RED primero) | ✅ | RED 1 falla → GREEN 22 tests; `npx tsc --noEmit` limpio |
| T2 | Tarjeta: `<img>` real como miniatura con fallback al diploma sintético | ✅ | `src/components/CertificationsScreen.tsx` rama `cert.image` + `frameClassName` compartido |
| T3 | Automatización: certificates sin copia numerada huérfana + borrar `01.webp` | ✅ | RED 3 → GREEN 40 (content-ingest); suite media/add-content/content-ingest = 71/71; `01.webp` borrado |
| T4 | Test obsoleto: `certifications-model.test.ts` ya no pinea "0 certificados" | ✅ | contrato pineado contra entrada vacía; 14/14 |
| T5 | Verificación integral (build + vitest completo) con evidencia | ✅ | `npx tsc --noEmit` limpio · `npm test` = **20 archivos / 416 tests en verde** · `dist/certificates/certificado/media/cover.webp` presente y `dist/index.json` con el `image` · `generate-index.js` no-op |
| T6 | Cierre: doc, memoria, revisión nativa, commit (pendiente autorización) | ✅ | revisión nativa **APROBADA** (`review-d3e4736a78113d83`, autoridad quemada); commit de git pendiente de autorización |

### Hallazgo adicional de T5

Un **tercer** test pineado a "hoy hay 0 certificados":
`tests/terminal-data.test.ts:399`. Reescrito para pinear el contrato de
empty-state contra entrada VACÍA y exigir paridad fila/índice en el índice
real (`21/21` en verde).

### Fuera de alcance (follow-ups, no tocados)
- Projects: el mismo duplicado `NN.webp` + `cover.webp` existe en el plan para
  `project` (aún sin contenido real). Misma regla aplicable si se publica uno.
- Verificación visual en navegador: pendiente (`npm run dev` → /certifications);
  aquí solo se verificó estructuralmente (índice + dist + contratos de test).

### Revisión nativa (RDD on)

- Linaje `review-d3e4736a78113d83` · tier **medium** · 13 archivos / 432 líneas ·
  lens `review-reliability` · forecast 1 model run (pi_host_relay).
- Resultado: **APROBADA** → `acknowledge-approved` ejecutado,
  `authority: burned` (`gentle-ai.review-acknowledged/v1`).
- 3 hallazgos **informativos** (no bloqueantes, tratados como trabajo aparte):
  1. `R3-cert-rewrite-idempotency` — `lib/content-ingest.js:362-366` (WARNING)
  2. `R3-img-error-fallback` — `src/components/CertificationsScreen.tsx:108-113` (WARNING): el `<img>` no tiene `onError` de fallback
  3. `R3-nocover-plan-untested` — `tests/content-ingest.test.ts:339-352` (SUGGESTION)

## Commits

Sin commitear a propósito: la entrega (commit/push/PR) queda bajo política
ordinaria del repo y decisión del humano. Mensaje sugerido:

```
feat(certificates): mostrar la cover real en la tarjeta y no duplicar media en la ingesta
```

# Feature: movimiento (motion) sutil en toda la web — sin tocar estructura

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Pedido del humano (verbatim fiel)

> vamos a darle un poco más de dinamismo a la web pero **sin cambiar nada de
> estructura o frontend**: solo animaciones en el fondo, transiciones en las
> tarjetas y presentación al desplazarse. Únicamente darle movimiento al
> contenido para que se sienta más agradable y no tan plano.

**Intensidad elegida por el humano: `sutil y profesional`** — reveals de
400–600 ms, hover lift leve, glow de fondo respirando lento. Se siente vivo sin
distraer.

## Restricciones vinculantes

1. Cero dependencias nuevas (sin framer-motion/locomotive): solo CSS keyframes,
   clases y un observer liviano.
2. Sin cambios de estructura, layout, color ni contenido: solo movimiento sobre
   elementos que ya existen.
3. `tests/styling.test.ts` pinea el encabezado de `src/index.css`
   (`@import "tailwindcss";` línea 1 y `@config "../tailwind.config.js";`, sin
   directivas v3) — debe seguir intacto.
4. Accesibilidad: todo movimiento respeta `prefers-reduced-motion: reduce`.
5. Degradación honesta: sin IntersectionObserver o sin JS el contenido se ve
   **visible**, nunca oculto.

## Diagnóstico (evidencia)

| Punto | Estado actual | Evidencia |
|---|---|---|
| Fondo | 2 blobs de glow + grid **completamente estáticos**; solo existe `@keyframes blink` en todo el CSS | `src/App.tsx` capa `fixed inset-0`, `src/index.css:52` |
| Tarjetas | `transition` de hover básicos, sin lift/entrada | 6 componentes con tarjetas: NewsWriteups, FeaturedProjects, WriteupsScreen, ProjectsScreen, CertificationsScreen, TerminalHero |
| Scroll | **no existe** reveal ni IntersectionObserver en todo `src/` | grep `IntersectionObserver|useScroll|reveal` → 0 |
| Muerto | Los modales declaran `animate-in fade-in` que **no existe** en el CSS compilado → esa entrada animada nunca corrió | `MainframeTerminalModal.tsx:354`, `MarkdownRenderer.tsx:651`, `grep animate-in dist/assets/*.css` → vacío |

## Diseño aprobado (motion core)

- **Primitivas CSS** en `src/index.css` (al final, encabezado intacto):
  `reveal-in` (fade + 18px de subida), `glow-breathe` (los 2 blobs respiran/driftan
  lento, 18 s y 24 s desfasados), `grid-breathe` (grid ±opacidad), `fade-in`
  real para modales.
- **Reveal progresivo**: el estado oculto solo aplica bajo `.reveal-ready` en
  `<html>`, clase que agrega el utilitario SOLO si `IntersectionObserver`
  existe → sin soporte/JS el contenido queda visible. Stagger vía
  `--reveal-delay` (60 ms por hermano, tope 300 ms).
- **Utilitario** `src/lib/reveal.ts`: IntersectionObserver + MutationObserver
  (el contenido llega después del fetch), con cleanup. Un solo `useEffect` en
  `App.tsx`.
- **Guard**: `@media (prefers-reduced-motion: reduce)` anula reveals,
  respirados y transiciones.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Tests de contrato de motion (fuente + CSS compilado) — RED primero | ✅ | 12/12 en `tests/styling.test.ts` |
| T2 | Primitivas CSS en `src/index.css` (reveal, respirado de fondo, guard) | ✅ | keyframes + utilidades `.motion-*` + guard `prefers-reduced-motion` al final del archivo |
| T3 | Utilitario `src/lib/reveal.ts` + cableado único en `App.tsx` (fondo animado) | ✅ | IO + MutationObserver + stagger `--reveal-delay`; `tsc` limpio |
| T4 | Superficie: `data-reveal` + stagger + hover lift en las 6 tarjetas; modales con `fade-in` real | ✅ | 17/17 styling tests; Home + Writeups/Projects/Certifications + About (6 secciones) + 2 modales |
| T4b | Pin de aprobación de tags (bloqueo ajeno detectado en T5) | ✅ | los 9 tags nuevos que agregó el humano en `lib/taxonomy.js` sumados a `APPROVED_CERTIFICATE_TAGS` (decisión humana verificada) |
| T5 | Verificación integral (tsc + build + vitest completo) | ✅ | `tsc` limpio · `npm test` = **20 archivos / 427 tests verdes** · CSS compilado con `reveal-in`/`glow-breathe`/`prefers-reduced-motion` · `animate-in` muerto erradicado de `src/` · 0 dependencias nuevas |
| T6 | Cierre: doc, memoria, revisión nativa, commit (pendiente autorización) | ✅ | revisión nativa **APROBADA** (`review-903eb9662bd9738f`, autoridad quemada); commit de git pendiente de autorización |

### Revisión nativa (RDD on)

- Linaje `review-903eb9662bd9738f` · tier **medium** · 27 archivos / 845 líneas · lens `review-reliability` · forecast 1 model run (pi_host_relay).
- Resultado: **APROBADA** → `acknowledge-approved` ejecutado, `authority: burned` (`gentle-ai.review-acknowledged/v1`).
- Hallazgos **informativos** (no bloqueantes, trabajo aparte):
  1. `R3-img-error-fallback` — `src/components/CertificationsScreen.tsx:108` (WARNING): el `<img>` de la cover sigue sin `onError` (ya reportado en la revisión anterior).
  2. `R3-tracked-set-growth` — `src/lib/reveal.ts:24` (SUGGESTION): el `Set` de elementos observados crece sin darse de baja al hacer `unobserve` (memoria trivial, pero válido).

## Commits

Sin commitear a propósito: la entrega queda bajo política ordinaria del repo y
decisión del humano. Mensaje sugerido:

```
feat(motion): reveals al scroll, respiro del fondo y hover lift sutil
```

# Feature: migración al nuevo frontend (Fase 2)

- Rama: `feat/frontend-migration` (apilada sobre `feat/content-kinds`)
- Estado: Fase 2.0–2.3 ejecutadas y en verde (ver tabla de estado abajo)

## Decisiones tomadas por el humano (verbatim)

1. **Alcance**: «cuando me refiero a nada de lo viejo es **únicamente el
   frontend**… todo lo que no sea frontend queda igual». Se borra el 100% de
   la presentación vieja; **se conservan** router, pipeline de contenido
   (`lib/`, `scripts/`), `public/` (markdown + `media/`) y los 193 tests.
2. **URLs**: el routing actual **se mantiene**; solo crece/ajusta para las
   rutas nuevas o pequeñas alteraciones según la nueva UI.
3. **Campos dinámicos**: se agregan **por page, de a poco** — nada de
   schema-upfront. `ports` queda descartado («es un adorno»).
4. **Estructura**: `newfrontend/` **se fusiona en la raíz** — un solo
   `package.json`, un solo `vite.config`, un solo `index.html`.
5. **Primer page**: **Home**.

## Qué es `newfrontend/` (analizado, no supuesto)

- Plantilla de **Google AI Studio**: README con `GEMINI_API_KEY`,
  `metadata.json` con `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, comentarios
  de AI Studio en `vite.config.ts`, banner de Google.
- 34 archivos / 27 de código · **0 tests** · **sin `node_modules`** · sin trackear.
- **Dependencias muertas (0 usos)**: `@google/genai`, `express`, `dotenv`,
  `esbuild`, `tsx`, `motion`. Se usa `lucide-react` (18 archivos).
- **Sin router**: navegación por `useState` (`activeTab` + selección).
- Contenido **hardcodeado en TS**: 1.930 líneas en `src/data/`.
- Mismos majors que nosotros: React 19, Vite 8, TS 7, Tailwind 4.
- Trae `@types/react` + `@types/react-dom` → desbloquea la deuda `strict`.
- **`tagCategory: 'HERRAMIENTA' | 'SCRIPT' | 'AUTOMATIZACIÓN' | 'EXPLOIT'`**
  → son los 3 grupos aprobados (escritos distinto) + un cuarto `EXPLOIT`
  que no existe en nuestra taxonomía → hay que normalizar.

## Matriz de brecha

| | StarkHack | newfrontend |
|---|---|---|
| URLs profundas | ✅ react-router | ❌ solo estado |
| Contenido validado | ✅ markdown + index.json + 193 tests | ❌ TS hardcodeado, 0 tests |
| Imágenes `media/` | ✅ 713 | ❌ 0 referencias |
| Filtros | tags + plataforma | dificultad + plataforma + búsqueda |
| UI rica (steps, flags, links, specs) | ❌ | ✅ |

**Consecuencia**: no es «cablear». La UI nueva pide campos que nuestro
frontmatter no trae (`difficulty`, `stars`, `steps`, `machineLinks`…) y se
agregan **page por page**, cuando toca reemplazarla.

## Fases

### Fase 2.0 — Andamiaje (esta etapa)
1. Mover `newfrontend/src/` → `./src/`.
2. `index.html` de raíz: contenido del nuevo (meta/OG/`lang="es"`/fuentes
   Inter+JetBrains Mono) **+ conservar el favicon** `/ui/logo.webp`. Sin
   Material Symbols (es del UI viejo).
3. Fusionar `tsconfig.json`: unir `types: ["node"]` (nuestro) + `["vite/client]`
   (suyo); conservar `allowJs`, `paths`, `strict:false`, `noUncheckedSideEffectImports`.
4. Fusionar `package.json`: añadir `lucide-react`, `@types/react`,
   `@types/react-dom`. **NO** añadir las muertas.
5. `vite.config.ts`: se conserva el nuestro (alias `@`, puerto 3000, react)
   y se queda **`@tailwindcss/postcss`**, no `@tailwindcss/vite` — el nuevo UI
   no depende de cómo se integre Tailwind, y cambiarlo rompería el contrato
   que fija `tests/styling.test.ts`.
6. **Voltear la entrada**: `index.html` → `/src/main.tsx`. La UI vieja deja de
   renderizar desde este punto (queda como código muerto hasta la fase 2.3).
7. Limpiar residuos de plantilla: `newfrontend/README.md`,
   `newfrontend/metadata.json`, el `rm -rf` del script `clean`.
8. Gate: `npm test` (193) · `tsc --noEmit` · `npm run build`.

### Fase 2.1 — Reemplazo page por page
`/` Home → `/directory` → `/writeups` → `/writeups/:slug` → `/projects` →
`/certificates` → `/about`. Una page por commit, siempre verde.

### Fase 2.2 — Campos dinámicos
Dentro de cada page, cuando su UI pida un campo que el contenido no trae.

### Fase 2.3 — Cierre
Borrado de `pages/`, `components/`, `index.css` viejo, `index.tsx`,
`react-markdown`. `grep` de cero rastros + 193 tests en verde.

## Evidencia de commits

- `c65fd8e` Home → pipeline · `3bd7e54` docs T3
- `a0d6a2e` react-router + rutas viejas · `134a52a` detalle de writeup real
- `fae5964` listado de writeups · `d3f0f21` docs estado 2.1
- `b546580` Projects · `4bfc206` Certificates · `ab677ef` terminal modal
- `ae1b795` modales huérfanos · `d48c37a` ProjectPage real
- `07e5853` fase 2.3 borrado

## Cierre

- Fase 2 completa: la UI renderiza 100% desde el pipeline de contenido;
  el frontend viejo y `src/data/portfolioData.ts` no existen más.
- Gate: **336/336** · `tsc` 0 · `build` 0 · greps de cero rastros vacíos.
- Quedan como deuda registrada: reviews RDD de esta tanda (pendiente de
  slices dentro de presupuesto) y el churn transitorio del lockfile.

## Estado de ejecución

| Fase | Estado | Evidencia |
|---|---|---|
| 2.0 Andamiaje | ✅ Hecho | `src/` movido (26 archivos), `index.html` volcado al nuevo (favicon conservado), `tsconfig` unido, `lucide-react` + `@types/react*` añadidos, `newfrontend/` borrado, merge de `chore/upgrade-latest`, glob `./src/**` en `tailwind.config.js`. Gate: **193/193 · `tsc` 0 · `build` 0 · styling 6/6 · `index.json` byte idéntico** |
| 2.1 Home | ✅ Hecho | `c65fd8e` (+ docs `3bd7e54`) — `src/lib/contentAdapter.ts` (mappers puros), 207 tests, RED observado |
| 2.1 Router | ✅ Hecho | `a0d6a2e` — `src/lib/router.tsx`, `/directory` y `/machines/:id` redirect a `/writeups`, rutas viejas vivas |
| 2.1 Writeups detalle | ✅ Hecho | `134a52a` — `src/lib/writeupView.ts`, gate `hasTemplateWriteupContent` eliminado, 16 writeups reales |
| 2.1 Writeups listado | ✅ Hecho | `fae5964` — `src/lib/directoryModel.ts`, `?plataforma=` como fuente de verdad, sin campos mock |
| 2.1 Projects | ✅ Hecho | `b546580` — `src/lib/projectsModel.ts` (18 tests RED-first), `getProjects()`, grupos reales, 0 proyectos → vacío honesto |
| 2.1 Certificates | ✅ Hecho | `4bfc206` — `src/lib/certificationsModel.ts` + `toUiCertification` (14 tests), `getCertificates()`, 0 certs → vacío honesto |
| 2.1 Terminal modal | ✅ Hecho | `ab677ef` — `src/lib/terminalData.ts` (21 tests), carga en primer open, sin campos mock (`os`/`difficulty`/`ports`/`stars`/`issuer` eliminados) |
| 2.1 About | ✅ Hecho | `ae1b795` — AboutScreen sin datos mock (contenido editorial estático del autor); borrados 6 modales huérfanos (0 importadores) |
| 2.1 ProjectPage detalle | ✅ Hecho | `d48c37a` — `src/lib/projectView.ts` (25 tests), readme real vía `MarkdownRenderer`, gate `hasTemplateProjectContent` fuera del route (export intacto, pineado por `router.test.ts`) |
| 2.3 Borrado del viejo | ✅ Hecho | `07e5853` — `pages/`, `components/Layout.tsx`, raíz `App.tsx`/`index.tsx`/`index.css`, `src/data/portfolioData.ts`, dep `react-markdown`; -3631/+81; greps de cero rastros vacíos |

### Nota de ejecución (error corregido)

La rama se creó inicialmente desde `feat/content-kinds` en vez de
`chore/upgrade-latest`, así que la primera pasada quedó sobre Vite 6 /
Tailwind 3 / TS 5.8. Se remedió con un merge de `chore/upgrade-latest` y
resolución manual de `package.json` / `package-lock.json` / `tsconfig.json`
(el auto-merge dejó `strict` duplicado y rompía toda la suite). Estado final:
stack unificado en latest estable.

### Reglas acordadas para la Fase 2.1

- Una page por commit, siempre con el gate en verde.
- La UI vieja (`pages/`, `components/`, `App.tsx`, `index.tsx`,
  `index.css` raíz) **ya no se renderiza** desde la fase 2.0: queda como
  código muerto hasta el borrado en 2.3.
- Los campos dinámicos que la UI nueva pida (`difficulty`, `stars`,
  `steps`…) se agregan **a esa page y a su frontmatter** cuando toca.
  `ports` queda descartado por decisión humana.
- `react-router` se conserva; solo se ajustan los elementos que renderiza.

### Registro de reviews (RDD) — fase 2.0 y sus derivados

| Rango (`baseRef`) | Archivos | Resultado |
|---|---|---|
| `8bcadb3` (primer intento) | ~50 | ❌ `lens_context_budget_exceeded` — sin autoridad creada |
| `adf907d` (feature completa) | ~35 | ❌ `lens_context_budget_exceeded` — sin autoridad creada |
| `77e6eaa` (solo `0e9e06c`) | 3 | ✅ **`approved`** — lineage `review-2e026cc9b8068d75`, receipt `gentle-ai.review-acknowledged/v1`, consumed `0b1a7a9` |
| `d9d9915..HEAD` (tanda completa) | ~36 | ❌ `lens_context_budget_exceeded` — sin autoridad creada (×2, reintentos con slices más chicos) |
| `d48c37a..HEAD` (slice 2.3) | 15 | ⚠️ lineage `review-1946460ac68d471e` creado (high, 4 lentes), **abandonado** con `reason: operator_disposition` — `pi-host-relay-timeout` (prompt 117 KB, corte a 1000.6s / límite 1000.6s; 0 resultados admitidos, 0 hallazgos). Registro nativo: `review-reclaim-record/v1` en `.git/gentle-ai/review-transactions/quarantine/review-1946460ac68d471e-4262340504` |

- **Aprobado**: `lib/frontmatter.js` (tolerancia a `---` vacío) + el script
  `test` (build + vitest). 4 hallazgos **informativos** (no bloqueantes):
  acoplamiento al mensaje de error en `frontmatter.js:49`, cobertura de
  directivas y de frontera negativa, y divergencia de `test`/`test:unit`.
- **Cobertura pendiente (no sellada)**: el cuerpo de la fase 2.0 (integración
  de los 26 archivos `src/`, `index.html`, `tailwind.config.js`, `tsconfig.json`,
  `src/index.css` vía `@import "tailwindcss"` + `@config`) y el merge
  `6e9bbff` **no entraron en ningún slice aprobado**: cada intento con un
  rango que los incluía excedió el presupuesto del lente. Queda como deuda de
  cobertura registrada — se revisará por slices más chicos (p. ej. por archivo)
  en la fase 2.1.

#### T3 — Home portado al pipeline ✅ (`c65fd8e`)
- `src/lib/contentAdapter.ts` (nuevo): mappers puros y síncronos
  `toUiWriteup` / `toUiProject`; solo campos reales del pipeline
  (slug→id, title, description→summary, date, platform→platformId,
  tags, image). `iconType` derivado con mapa documentado (platform →
  wave/server/network/database/bug; group → gear/code/scan/shield).
- `src/App.tsx`: Home carga con `getRecentWriteups(3)` + `getProjects()`
  en `useEffect`; estados de carga y vacío honestos. Sin
  `FEATURED_WRITEUPS`/`FEATURED_PROJECTS`.
- `src/types/index.ts`: campos solo-de-plantilla ahora opcionales;
  `NewsWriteups`/`FeaturedProjects` renderizan cada chip condicionalmente.
- TDD: RED observado (`Cannot find module '../src/lib/contentAdapter'`),
  GREEN 12 tests nuevos.
- Gates: build ✓ · **207/207** · `tsc --noEmit` 0.
- Riesgo registrado (T5): `WriteupPage:54` hace spread de
  `vulnerabilities` cuando no hay tags; y la página de detalle consume
  `markdownContent` de datos mock todavía.
  (Ambos resueltos: `134a52a` portó el detalle al markdown real y la fase
  2.3 borró `portfolioData.ts` completo.)

#### Fase 2.1 restante + 2.3 — commits de esta tanda

| Commit | Contenido |
|---|---|
| `d3f0f21` | docs: estado real de la 2.1 (router/detalle/listado ya hechos) |
| `b546580` | ProjectsScreen → pipeline (`projectsModel.ts`, 18 tests, RED `Cannot find module`) |
| `4bfc206` | CertificationsScreen → pipeline (`certificationsModel.ts`, 14 tests, RED `Cannot find module`) |
| `ab677ef` | Terminal modal → pipeline (`terminalData.ts`, 21 tests, carga en primer open) |
| `ae1b795` | -6 modales huérfanos de la plantilla (0 importadores; `CertificationsModal` era el último uso de `portfolioData`) |
| `d48c37a` | ProjectPage renderiza readme real (`projectView.ts`, 25 tests); gate de plantilla fuera del route |
| `07e5853` | Fase 2.3: -3631 líneas, `react-markdown` fuera, greps de cero rastros vacíos |

- **Gate final**: `npm test` (build + vitest) → **336/336 (18 archivos)** ·
  `npx tsc --noEmit` → 0 · `npm run build` → 0 · cero rastros de
  `portfolioData`, `react-markdown`, `pages/`, `components/Layout`,
  `App.tsx` raíz.
- **Decisión de contrato (nord0)**: al borrar el frontend viejo, `nord0`
  (`#2e3440`) perdió su último consumidor y Tailwind 4 ya no lo emite; la
  aserción compilada de `styling.test.ts` se re-apuntó a `#8fbcbb` (nord7,
  sí emitido) conservando la intención de verificar la paleta Nord en el
  CSS construido. Diff: 1 línea + comentario justificativo.
- **Contrato de `styling.test.ts` re-apuntado**: lee ahora `src/index.css`
  (antes `index.css` raíz, borrado) y espera `@config "../tailwind.config.js"`.
- **Deuda abierta conocida**: `package-lock.json` trae churn transitorio
  además del subárbol de `react-markdown` (re-resolución de npm de entradas
  dev); generado por `npm uninstall`, no editado a mano.
- **Waiver de review (autorizado por el humano)**: la tanda completa de la
  2.1 + 2.3 no entró en el presupuesto del lente (`lens_context_budget_exceeded`);
  el slice más fino que aceptó la autoridad (2.3, 15 archivos) murió por
  `pi-host-relay-timeout` y el humano autorizó **abandon** con
  `operator_disposition`. Cobertura queda como deuda registrada, no sellada.
  Para futuras tandas: partir por commit slices menores (cada uno <~1000
  líneas materializadas) o subir `GENTLE_PI_REVIEW_RELAY_PI_TIMEOUT_MS`
  (techo 7200000) al lanzar Pi.
- **Nota About**: `AboutScreen` no consume datos del pipeline; su contenido
  (bio, stats "5+/100%", timeline) es editorial/estático — decisión del
  usuario si algún dato debe derivarse del índice en el futuro.

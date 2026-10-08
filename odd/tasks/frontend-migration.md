# Feature: migración al nuevo frontend (Fase 2)

- Rama: `feat/frontend-migration` (apilada sobre `feat/content-kinds`)
- Estado: plan aprobado, ejecución pendiente

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

- (pendiente)

## Cierre

- (pendiente)

## Estado de ejecución

| Fase | Estado | Evidencia |
|---|---|---|
| 2.0 Andamiaje | ✅ Hecho | `src/` movido (26 archivos), `index.html` volcado al nuevo (favicon conservado), `tsconfig` unido, `lucide-react` + `@types/react*` añadidos, `newfrontend/` borrado, merge de `chore/upgrade-latest`, glob `./src/**` en `tailwind.config.js`. Gate: **193/193 · `tsc` 0 · `build` 0 · styling 6/6 · `index.json` byte idéntico** |
| 2.1 Home | ⬜ pendiente | |
| 2.1 Directory | ⬜ pendiente | |
| 2.1 Writeups listado + detalle | ⬜ pendiente | |
| 2.1 Projects + Certificates | ⬜ pendiente | |
| 2.1 About | ⬜ pendiente | |
| 2.3 Borrado del viejo | ⬜ pendiente | |

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

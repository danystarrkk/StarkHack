# Feature: estelas de acentos y ritmo más rápido en el fondo (cierre del fondo)

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Pedido del humano (verbatim fiel)

> me gustaría que el movimiento fuera **un poco más rápido** y con **estelas de
> los colores de la paleta** que definimos… y con eso terminamos con el fondo.

**Decisiones humanas**: paleta = **acentos del sitio** (`#39bae6` cian,
`#6ad5ff` cian claro, `#7edc73` verde, `#e6b450` ámbar — los tonos con los que
está pintado el sitio: categorías, badges, glows).

## Qué cambia (solo ritmo y una capa nueva, sin estructura)

| Elemento | Hoy | Propuesto |
|---|---|---|
| `.motion-dust-a` | 55 s | **30 s** |
| `.motion-dust-b` | 85 s | **48 s** |
| `.motion-glow-a/b` | 26 s / 34 s | **18 s / 24 s** (misma desfase) |
| Estelas | no existen | **4 bandas diagonal-finísimas** que barren el fondo, una por color de la paleta |

**Diseño de la estela** (elegante, nunca parece fallo):
- Banda delgada (`height: 2px`) con gradiente horizontal `transparent → color → transparent`
  y `filter: blur(1.5px)`; rotación fija dentro del keyframe (el `transform` del
  keyframe incluye `rotate` para no pisarse).
- Recorrido **fuera de pantalla en ambos extremos** del keyframe → el loop salta
  de "fuera" a "fuera": sin corte visible.
- Alfa de pico bajo (≈0.35 cian, ≈0.28 claros, ≈0.22 verde/ámbar) y duraciones
  14 s / 18 s / 22 s / 26 s con delays desfasados → nunca las 4 juntas en el
  mismo punto.
- Guard `prefers-reduced-motion` cubre `.motion-streak-*`.
- **Pin negativo**: las estelas no pueden usar `opacity` como animación (solo
  `transform`), para que nunca se lean como parpadeo.

## Restricciones heredadas
Cero dependencias; sin cambios de layout/color de contenido; encabezado de
`src/index.css` intacto (tests de `styling.test.ts`); degradación honesta.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Tests: pins de estelas + duraciones aceleradas + pin negativo (RED primero) | pendiente | |
| T2 | CSS: `.motion-streak-a/b/c/d` + keyframes + aceleración de dust/glow + guard | pendiente | |
| T3 | `App.tsx`: 4 divs de estela en el contenedor de fondo existente | pendiente | |
| T4 | Verificación integral (tsc + build + vitest) | pendiente | |
| T5 | Cierre: commit de unidad + revisión RDD en rango chico | pendiente | |

## Commits

(pendiente)

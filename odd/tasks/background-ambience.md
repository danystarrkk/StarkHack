# Feature: ambiente del fondo — polvo de datos flotante (fin de sesión de motion)

- Rama: `feat/frontend-migration`
- Estado: **en curso**

## Pedido del humano (verbatim fiel)

> el fondo no tiene ninguna animación, está tal cual quieta y sin nada… aunque si
> tiene un ligero parpadeo de luces, pero más que darle sentido bonito **parece
> que la pantalla estuviera dañada**. Quiero una animación de fondo chevere que
> acompañe elegantemente a la web y no parezca fallo.

**Estilo elegido por el humano: `Polvo de datos flotante`** — dos capas de puntos
diminutos que derivan lento en direcciones opuestas + los glow respirando.
Sin barrido de luz ni parallax.

## Diagnóstico (evidencia, verificado antes de tocar nada)

| Qué existe hoy | Por qué no funciona |
|---|---|
| `.motion-grid` → `@keyframes grid-breathe` = **opacidad 0.5 → 0.75 cada 12 s** sobre TODO el grid | Es un latido global de opacidad: exactamente el "parpadeo que parece pantalla dañada". Es lo único perceptible. |
| `.motion-glow-a/b` → `glow-breathe` = translate de **18 px** con alfa **0.045 / 0.03** | Movimiento real pero invisible: por eso "no tiene nada". |
| No existe ninguna capa de partículas/polvo | — |

Regla: el movimiento del fondo debe ser **intencional y visible pero tranquilo**,
y nunca un cambio global de opacidad (eso se lee como fallo).

## Diseño aprobado

1. **Se elimina `grid-breathe`** (y su latido de opacidad) — el grid queda estático
   en su `opacity-60` actual. Se pinea negativamente en los tests para que no
   vuelva.
2. **Dos capas de polvo** dentro del contenedor de fondo existente
   (`pointer-events-none fixed inset-0 z-0` de `App.tsx`; no se toca ningún otro
   nodo): patrón de puntos por `radial-gradient` con `background-size` distinto
   por capa (tile propio), derivando con `transform` por **exactamente un tile**
   → loop perfectamente continuo, sin salto y sin repaint:
   - `.motion-dust-a`: tile 96 px, alfa ~0.12, deriva en una dirección, ~55 s.
   - `.motion-dust-b`: tile 148 px, alfa ~0.08, dirección opuesta y más lenta, ~85 s.
   - Capa sobredimensionada (`inset` negativo > un tile) para que el
     desplazamiento nunca descubra un borde en móvil.
3. **Glow con recorrido real**: amplitud de `glow-breathe` sube a ~40 px + scale
   1.08, ciclos más lentos (26 s / 34 s desfasados) → se nota, pero es calmado.
   Solo `transform`: jamás parpadea.
4. **Guard**: `.motion-dust-a/b` entran al bloque `prefers-reduced-motion: reduce`.

Restricciones heredadas de la sesión: cero dependencias nuevas, sin cambios de
layout/color/contenido, `tests/styling.test.ts` conserva su contrato sobre el
encabezado de `src/index.css`, degradación honesta.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| T1 | Tests: quitar el pin de `grid-breathe`, pinear polvo + pin negativo del latido (RED primero) | ✅ | RED 6 fallas → GREEN 21/21 styling |
| T2 | CSS: capas `.motion-dust-a/b`, amplitud de glow, guard | ✅ | tiles exactos 96px/55s y 148px/85s; glow transform-only 40px/26s/34s |
| T3 | `App.tsx`: dos capas de polvo dentro del contenedor de fondo existente | ✅ | solo 2 divs añadidos; grid estático en `opacity-60`, sin clase de movimiento |
| T4 | Verificación integral (tsc + build + vitest completo) | ✅ | `tsc` limpio · `npm test` = **20 archivos / 431 tests verdes** · CSS compilado con polvo y **sin** `grid-breathe` · loops estructuralmente correctos (inset > tile) |
| T5 | Cierre: doc, memoria, revisión nativa, commit (pendiente autorización) | ✅ | 3 commits + revisión nativa **APROBADA** (`review-7c481f4747054b9a`, autoridad quemada) |

### Bloqueo original y cómo se resolvió

- El primer intento (linaje `review-2e99354a86906378`) quedó en `stop` con
  `unachievable_lens_slot` / `relay_transport_bound_exceeded`: candidato del
  workspace acumulando **3 features sin commitear** (28 archivos, 961 líneas,
  prompt de 93959 bytes) contra un bound de 980646 ms. El proveedor lo declaró
  determinista.
- **Decisión humana**: commitear los work units y revisar por commit.
- Al inspeccionar con árbol limpio, la ruta por defecto ofreció como base
  `d9d9915` ("Agregando máquina wave") → candidato de **903 archivos / 21421
  líneas** (toda la rama). **No se tomó**: se relanzó START con `baseRef`
  explícito = `a3dbce4…` y `committedOnly: true` → candidato correcto de
  **17 archivos / 552 líneas**.
- Resultado: **APROBADA** → `acknowledge-approved`, `authority: burned`
  (`gentle-ai.review-acknowledged/v1`). 5 hallazgos informativos (no bloqueantes):
  `R3-001` tests/styling.test.ts:135 · `R3-002` src/lib/reveal.ts:22 (Set creciente)
  · `R3-003` src/lib/reveal.ts:41 · `R3-004` src/lib/reveal.ts:72 ·
  `R3-005` tests/styling.test.ts:109.

### Commits

```
a3dbce4 feat(certificates): render the real cover in the card and stop duplicating certificate media
ad57f5a feat(motion): scroll reveals, floating data dust and subtle hover lift
aeb537c test(taxonomy): pin the human-approved certificate tag expansion
```

Los tres quedaron verdes en el mismo estado del árbol: `npm test` →
20 archivos / 431 tests, `git status` limpio.

## Commits

(pendiente)

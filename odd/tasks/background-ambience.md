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
| T5 | Cierre: doc, memoria, revisión nativa, commit (pendiente autorización) | ⛔ | revisión nativa **detenida**: `unachievable_lens_slot` / `relay_transport_bound_exceeded` (timeout 980651 ms vs 980646 ms, prompt 93959 bytes, candidato 28 archivos / 961 líneas). Decisión humana pendiente |

### Bloqueo de la revisión nativa (detalle)

- Linaje `review-2e99354a86906378`, estado nativo `stop`, motivo
  `unachievable_lens_slot`. El fallo se declaró **determinista**: re-lanzar el
  mismo slot con el mismo binding repite el muro.
- Causa: el candidato del workspace acumula **3 features sin commitear** (28
  archivos, 961 líneas, 94 KB materializados), muy por encima de los candidatos
  anteriores que sí pasaron (432 y 845 líneas).
- **Los primeros dos candidatos ya tienen revisión nativa APROBADA y quemada**
  (`review-d3e4736a78113d83` certificado, `review-903eb9662bd9738f` motion). El
  delta sin revisar es **solo el de este fondo (~116 líneas)**.
- Opciones ofrecidas al humano:
  1. Commitear los work units (entrega → decisión humana) y revisar por commit:
     el candidato del fondo queda chico y entra en el bound. **Recomendada.**
  2. Subir `GENTLE_PI_REVIEW_RELAY_PI_TIMEOUT_MS` (techo 7200000 ms) y reintentar
     el mismo slot (requiere relanzar Pi con esa variable).
  3. `withdraw` + reintento tal cual: mismo prompt de 94 KB → alta probabilidad
     de repetir el timeout.

## Commits

(pendiente)

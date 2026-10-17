# Feature: url-scheme-hardening (P0 de la auditoría)

**Goal**: cerrar la única superficie XSS real del sitio (M1+M2) con un validador
compartido de esquemas de URL aplicado en el pipeline Y en el render, y sumar
defensa en profundidad con `public/_headers` (M3).

**Branch**: security/url-hardening · **Started**: 2026-10-16

## Specs

- **S1** (P0 verbatim del reporte, cerrado por el humano con "vamos con los P0"):
  "Validador de esquema de URL compartido (markdown + frontmatter links + img)".
  Evidencia: M1 `MarkdownRenderer.tsx:182` usa `href={linkMatch[2]}` verbatim;
  M2 `WRITEUP_LINK_RULES` (`lib/content-kinds.js:265,276`) solo exige
  non-empty string → `url: "javascript:..."` llega a la UI.
- **S2** (P0 verbatim del reporte): "`public/_headers` con CSP + nosniff +
  frame-ancestors".
- **S3** (alcance técnico acordado): `lib/url-safety.js` exporta
  `isSafeUrl(value)` — true para `http://`, `https://` y rutas relativas al
  sitio (arrancan con `/` simple, `./`, `#` o `?`); false para cualquier otro
  esquema (`javascript:`, `data:`, `vbscript:`, `file:`), `//host` (relative
  de esquema) y no-strings. Se aplica en: reglas `url` de
  `assertValidWriteupLinks`; `indexEntryProblems` para `image`, `imageHires`,
  `githubUrl`, `pdfUrl` presentes; href y src del `MarkdownRenderer`; y los
  anchors de frontmatter de `WriteupPage`, `ProjectPage` y
  `CertificationsScreen` (tarjeta/anchor insegura → no se renderiza).
- **S4**: test-first obligatorio con RED observado por regla; gate final
  `npm test` + `tsc --noUnusedLocals` en 0; sin dependencias nuevas.

## Tasks

- **T1** · S1 · doc ODD + espejo Engram + rama `security/url-hardening` · commit doc
- **T2** · S1,S3 · RED `tests/url-safety.test.ts` (tabla de verdad del validador) → implementar `lib/url-safety.js` → GREEN
- **T3** · S1,S3 · RED: esquema `javascript:` rechazado en `assertValidWriteupLinks` (extiende el describe de `tests/generate-index.test.ts:539`) + `indexEntryProblems` rechaza `image`/`githubUrl`/`pdfUrl` con esquema inseguro → cablear `url-safety` en `lib/content-kinds.js` → GREEN
- **T4** · S1,S3 · RED: render de `WriteupPage` con `[x](javascript:…)` e imagen `data:` no emite href/src inseguros → guard en `MarkdownRenderer` (link :182 + img :448/:662) → GREEN
- **T5** · S1,S3 · guard en anchors de frontmatter: `WriteupPage` (machineLinks/toolLinks), `ProjectPage` (repoUrl/projectLinks/toolLinks), `CertificationsScreen` (pdfUrl) — anchor/tarjeta con URL insegura no se renderiza + pin de render en `tests/writeup-view.test.ts`
- **T6** · S2 · `public/_headers`: CSP (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` ( atributos style de React), `img-src 'self' data: https:`, `font-src 'self' https://fonts.gstatic.com`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`) + `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` + `X-Frame-Options: DENY`. Documentar en el doc que es formato Netlify/Cloudflare Pages y se porta a vercel.json si el host cambia.
- **T7** · S4 · gate final: `npm test` verde, `tsc` 0, árbol limpio; commits work-unit; Risk line

## Log

- **L1** · S1-S2 · pedido del humano verbatim: "vamos con los P0" (tras el
  reporte de auditoría con M1/M2/M3 en la fila P0).
- **L2** · evidencia · `npm audit` 0 vulns; sin `dangerouslySetInnerHTML`;
  guardas de render nuevas son defensa en profundidad (el pipeline ya rechaza
  en escritura con add-content/generate-index).

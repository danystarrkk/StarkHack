// Shared URL-scheme allowlist for every content-supplied URL.
//
// (url-scheme-hardening S3.) The site renders URLs that come from untrusted-by-
// convention content: markdown bodies (links and images), frontmatter link
// blocks (machineLinks/toolLinks/projectLinks), and index fields (image,
// imageHires, githubUrl, pdfUrl). Only two location classes are allowed to
// reach an href/src:
//
//   - absolute http(s) URLs:   https://example.com/path
//   - same-origin locations:   /ruta, ./relativa, #ancla, ?query, relativa
//                               bare ("sibling.md") — no scheme, so it can
//                               only resolve against this origin
//
// Everything else is rejected: executable schemes (javascript:, data:,
// vbscript:, blob:, file:), unknown schemes (mailto:, tel:), and
// scheme-relative "//host" URLs (they escape the site origin). Rejection is
// silent-by-contract: callers decide whether to fail loud (pipeline
// validation) or to hide the element (render-time guards).

const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/;

// Los browsers normalizan las URLs antes de resolver el esquema: quitan
// tab/newline/CR en cualquier posición y caracteres de control al inicio/fin
// (WHATWG URL parser), y tratan las barras invertidas iniciales como slashes
// (`\\host` equivale a `//host`). Un esquema ofuscado ("java\tscript:")
// sobreviviría a un chequeo ingenuo, así que cualquier control char en la
// cadena se rechaza antes de mirar el esquema (ninguna URL legítima lo lleva).
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * True when `value` is a string that only points at http(s) or a same-origin
 * location. Non-strings, empty/whitespace strings, and every other scheme are
 * unsafe.
 *
 * @param {unknown} value candidate URL from content (markdown, frontmatter or index)
 * @returns {boolean} whether the URL may be used in an href/src
 */
export function isSafeUrl(value) {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  if (url === '') return false;
  // Browsers strip these from URLs: they can hide a scheme or an origin
  // escape, so an URL carrying them is never safe.
  if (CONTROL_CHARS.test(url)) return false;
  const lower = url.toLowerCase();
  // Scheme-relative URLs (//host/…) — and their backslash disguise — resolve
  // against any origin: rejected.
  if (lower.startsWith('//') || lower.startsWith('\\')) return false;
  const scheme = lower.match(SCHEME_PATTERN);
  if (scheme !== null) return lower.startsWith('https://') || lower.startsWith('http://');
  // No scheme: same-origin relative location by definition.
  return true;
}

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
  const lower = url.toLowerCase();
  // Scheme-relative URLs (//host/…) resolve against any origin — rejected.
  if (lower.startsWith('//')) return false;
  const scheme = lower.match(SCHEME_PATTERN);
  if (scheme !== null) return lower.startsWith('https://') || lower.startsWith('http://');
  // No scheme: same-origin relative location by definition.
  return true;
}

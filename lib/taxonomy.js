// Lista canónica cerrada de tags para writeups: exactamente estos 20, sin
// excepciones. Compartida por el indexador de build (Node) y la app (Vite/TS),
// igual que lib/frontmatter.js.
//
// Orden: alfabético con `localeCompare("en")`. La lista aprobada mostraba
// "Buffer Overflow" antes de "Broken Authentication", pero en orden alfabético
// "Broken Authentication" va primero ("Bro" < "Buf"); aquí se guarda el orden
// alfabético real. tests/taxonomy.test.ts fija esta decisión.

/**
 * The closed canonical tag taxonomy: exactly 20 alphabetically sorted tags.
 *
 * @type {readonly string[]}
 */
export const TAGS = Object.freeze([
  "Access Control Bypass",
  "Broken Authentication",
  "Buffer Overflow",
  "Business Logic",
  "Container Escape",
  "Credential Exposure",
  "Exposed Service",
  "File Inclusion",
  "File Upload",
  "Information Disclosure",
  "JWT Attack",
  "Misconfiguration",
  "Path Traversal",
  "Pivoting",
  "Privilege Escalation",
  "Remote Code Execution",
  "Server-Side Request Forgery",
  "SQL Injection",
  "Vulnerable Component",
  "XML External Entity",
]);

const TAG_SET = new Set(TAGS);

/**
 * Assert that `tags` is an array of canonical taxonomy tags.
 *
 * `undefined`/`null` tags are allowed (a writeup may omit the key); anything
 * else must be an array whose every entry is a member of {@link TAGS}.
 * On failure this throws an `Error` naming `context` (e.g. the writeup file
 * path) and the offending tag value(s), so index-generation failures are
 * actionable.
 *
 * @param {unknown} tags value of the `tags` frontmatter key
 * @param {string} context where the tags came from, e.g. the writeup file path
 * @returns {void}
 */
export function assertValidTags(tags, context) {
  if (tags === undefined || tags === null) return;

  if (!Array.isArray(tags)) {
    throw new Error(
      `Invalid tags in ${context}: expected an array of canonical tags, got ${JSON.stringify(tags)}.`
    );
  }

  const invalid = tags.filter((tag) => typeof tag !== "string" || !TAG_SET.has(tag));
  if (invalid.length > 0) {
    const listed = invalid.map((tag) => JSON.stringify(tag)).join(", ");
    throw new Error(
      `Invalid tag(s) in ${context}: ${listed}. ` +
        `Tags must come from the canonical taxonomy in lib/taxonomy.js.`
    );
  }
}

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

// Vocabularios cerrados de tags para los otros kinds (aprobados verbatim, en
// orden aprobado — NO alfabético). Cada kind declara su propia lista: las tres
// vocabularías son independientes (PROJECT_TAGS y CERTIFICATE_TAGS comparten a
// propósito las palabras "Networking" y "Cryptography", pero no la lista).

/**
 * The closed canonical tag vocabulary for projects (approved order).
 *
 * @type {readonly string[]}
 */
export const PROJECT_TAGS = Object.freeze([
  "CLI Utilities",
  "Recon",
  "OSINT",
  "Scanning",
  "Networking",
  "Web",
  "Cryptography",
  "Parsers",
  "Integrations",
  "Reporting",
  "Databases",
]);

/**
 * The closed canonical tag vocabulary for certificates (approved order).
 *
 * @type {readonly string[]}
 */
export const CERTIFICATE_TAGS = Object.freeze([
  "Networking",
  "Cloud",
  "Forensics",
  "Web Security",
  "Cryptography",
  "Systems",
  "Incident Response",
  "Auditing",
]);

// Vocabularías con tags obligatorios (project, certificate), por kind.
const REQUIRED_TAG_SETS = Object.freeze({
  project: new Set(PROJECT_TAGS),
  certificate: new Set(CERTIFICATE_TAGS),
});

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

/**
 * Assert that `tags` is a non-empty array of `kind`'s canonical tags.
 *
 * Unlike {@link assertValidTags} (writeups, tags optional), project and
 * certificate entries must carry at least one tag, every one from that kind's
 * own vocabulary. On failure this throws an `Error` naming `context` (e.g. the
 * content file path) and the offending value(s).
 *
 * @param {unknown} tags value of the `tags` frontmatter key
 * @param {'project' | 'certificate'} kind content kind owning the vocabulary
 * @param {string} context where the tags came from, e.g. the content file path
 * @returns {void}
 */
export function assertRequiredTags(tags, kind, context) {
  const vocabulary = REQUIRED_TAG_SETS[kind];
  if (!vocabulary) {
    throw new Error(`Unknown required-tag kind: ${JSON.stringify(kind)}`);
  }

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error(
      `Invalid tags in ${context}: ${kind} requires a non-empty array of canonical tags, ` +
        `got ${JSON.stringify(tags)}.`
    );
  }

  const invalid = tags.filter((tag) => typeof tag !== "string" || !vocabulary.has(tag));
  if (invalid.length > 0) {
    const listed = invalid.map((tag) => JSON.stringify(tag)).join(", ");
    throw new Error(
      `Invalid tag(s) in ${context}: ${listed}. ` +
        `Tags must come from the ${kind} tag vocabulary in lib/taxonomy.js.`
    );
  }
}

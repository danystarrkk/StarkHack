// Registro canónico de tipos de contenido: una sola fuente de verdad para el
// indexador de build (Node), los tests de drift y la app (Vite/TS), al estilo de
// lib/frontmatter.js y lib/taxonomy.js. Fase 1: writeup, project y certificate.
//
// - `root` es la ruta relativa al repo que contiene los markdown del tipo.
// - `platformed: true` significa que los archivos viven un nivel más abajo:
//   <root>/<platform>/*.md (solo los writeups). El resto es plano: <root>/*.md.
// - `required` lista las claves de frontmatter obligatorias; `missingFields`
//   aplica las reglas de presencia documentadas en su JSDoc.
// - `groups` es la lista cerrada de clasificadores (`group`) del kind —
//   estructura del kind, por eso vive aquí y no en lib/taxonomy.js. Los
//   writeups no la necesitan (usan `platform`): su valor es `null`.
// - `tags` es el vocabulario cerrado de etiquetas del kind, importado desde
//   lib/taxonomy.js. Ninguna lista se comparte entre kinds.

import { CERTIFICATE_TAGS, PROJECT_TAGS, TAGS } from './taxonomy.js';

// Clasificadores (`group`) de los kinds planos, en orden canónico (aprobados
// verbatim). El orden importa: la API los devuelve así, incluidos los vacíos.

/**
 * The closed canonical project groups (approved order).
 *
 * @type {readonly string[]}
 */
export const PROJECT_GROUPS = Object.freeze(['scripts', 'automatizaciones', 'herramientas']);

/**
 * The closed canonical certificate groups (approved order): issuer/platform.
 *
 * @type {readonly string[]}
 */
export const CERTIFICATE_GROUPS = Object.freeze(['universidad', 'hack4u', 'cisco', 'hacker-mentor']);

/**
 * @typedef {object} KindSpec
 * @property {string} root repository-relative content root, e.g. 'public/writeups'
 * @property {boolean} platformed whether files live one level deeper, under <root>/<platform>/
 * @property {string[]} required frontmatter keys that must be present and non-empty
 * @property {readonly string[] | null} groups closed `group` list (null when the kind has no groups)
 * @property {readonly string[]} tags closed tag vocabulary of the kind
 */

/**
 * Recursively freeze an object graph so no nested structure stays mutable.
 *
 * `Object.freeze` alone only protects one level: KINDS' nested `groups`,
 * `tags` and `required` structures must be frozen too, or callers could still
 * e.g. `KINDS.project.required.push('x')` and silently mutate the vocabulary
 * shared by the indexer, the drift tests and the app (R3-kinds-shallow-frozen).
 * Already-frozen shared lists (TAGS, PROJECT_GROUPS…) short-circuit safely.
 *
 * @template T
 * @param {T} value object or array to freeze in depth
 * @returns {T} the same value, frozen together with everything reachable from it
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/**
 * The supported content kinds, keyed by kind name.
 *
 * writeups are the only platformed kind: their files live under
 * `public/writeups/<platform>/`. Projects and certificates are flat
 * (`public/projects/*.md`, `public/certificates/*.md`). Certificates do not
 * require `date`; their `order` drives the public display order instead.
 *
 * Deep-frozen: the specs and every nested list are immutable, so the canonical
 * vocabulary cannot be mutated at runtime (R3-kinds-shallow-frozen).
 *
 * @type {{ readonly writeup: KindSpec, readonly project: KindSpec, readonly certificate: KindSpec }}
 */
export const KINDS = deepFreeze({
  writeup: {
    root: 'public/writeups',
    platformed: true,
    required: ['title', 'date'],
    groups: null, // writeups clasifican por `platform`, no por `group`
    tags: TAGS,
  },
  project: {
    root: 'public/projects',
    platformed: false,
    required: ['title', 'date', 'image'],
    groups: PROJECT_GROUPS,
    tags: PROJECT_TAGS,
  },
  certificate: {
    root: 'public/certificates',
    platformed: false,
    required: ['title', 'order', 'image', 'description'],
    groups: CERTIFICATE_GROUPS,
    tags: CERTIFICATE_TAGS,
  },
});

/**
 * Assert that `group` is a member of `kind`'s closed group list.
 *
 * Fail-loud: the thrown `Error` names the content file path, the offending
 * value and every valid option, in the same wording family as the generator's
 * other metadata errors.
 *
 * @param {unknown} group value of the `group` frontmatter key
 * @param {'project' | 'certificate'} kind content kind owning the group list
 * @param {string} filePath content file the group came from
 * @returns {void}
 */
export function assertValidGroup(group, kind, filePath) {
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }
  const groups = spec.groups;
  if (!groups) {
    throw new Error(`Content kind ${JSON.stringify(kind)} has no group list`);
  }

  if (typeof group !== 'string' || !groups.includes(group)) {
    const listed = groups.map((entry) => JSON.stringify(entry)).join(', ');
    const shown = typeof group === 'string' ? JSON.stringify(group) : String(group);
    throw new Error(
      `Invalid ${kind} group in ${filePath}: expected one of ${listed}, got ${shown}.`
    );
  }
}

/**
 * Required frontmatter fields that are absent or empty in `data`.
 *
 * Presence rules: a field is missing when it is absent, `null`, not a string,
 * or a whitespace-only string — EXCEPT `order`, which must be a real integer
 * and is therefore only "missing" when absent or `null`. A present-but-invalid
 * `order` (a string like "3", a float, NaN…) is NOT missing here: the generator
 * rejects it with its own "Invalid certificate order" error instead.
 *
 * @param {Record<string, unknown>} data parsed frontmatter
 * @param {string} kind key of {@link KINDS}
 * @returns {string[]} missing required field names, in `required` order
 */
export function missingFields(data, kind) {
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }

  return spec.required.filter((field) => {
    if (field === 'order') return data.order === undefined || data.order === null;
    const value = data[field];
    return typeof value !== 'string' || value.trim() === '';
  });
}

/**
 * Shape problems of one raw entry of the generated index (public/index.json).
 *
 * The single entry-shape validator used at the index boundary
 * (R3-array-entry-shape-unvalidated): a JSON array of corrupt entries must fail
 * loudly there instead of passing a cast and silently degrading into "no
 * content" (or a bare TypeError on `item.platform`). Rules, per entry:
 *
 * - it is a non-null plain object (not a number, string, array or null);
 * - `kind` is one of {@link KINDS};
 * - the kind's required frontmatter fields are present and non-empty, via
 *   {@link missingFields} — the single source of that vocabulary;
 * - index-level `slug` and `path` are present non-empty strings;
 * - platformed kinds (writeups) carry a present non-empty `platform`.
 *
 * Lives here, not in lib/content.ts, because it speaks the KINDS vocabulary:
 * content.ts only turns these problems into a ContentIndexError with the entry
 * index and the generator hint.
 *
 * @param {unknown} entry one raw JSON entry of the generated index
 * @returns {string[]} human-readable problems; empty when the entry is valid
 */
export function indexEntryProblems(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    const got = entry === null ? 'null' : Array.isArray(entry) ? 'array' : typeof entry;
    return [`expected a plain object entry, got ${got}`];
  }

  const data = /** @type {Record<string, unknown>} */ (entry);
  /** @type {string[]} */
  const problems = [];

  const kind = data.kind;
  const knownKind = typeof kind === 'string' && Object.prototype.hasOwnProperty.call(KINDS, kind);
  if (!knownKind) {
    const listed = Object.keys(KINDS).map((name) => JSON.stringify(name)).join(', ');
    problems.push(`unknown kind ${JSON.stringify(kind)} (expected one of ${listed})`);
  } else {
    const spec = KINDS[/** @type {'writeup' | 'project' | 'certificate'} */ (kind)];
    const missing = missingFields(data, /** @type {string} */ (kind));
    if (missing.length > 0) {
      problems.push(`missing required fields: ${missing.join(', ')}`);
    }
    if (spec.platformed && (typeof data.platform !== 'string' || data.platform.trim() === '')) {
      problems.push(`missing or empty platform for kind ${JSON.stringify(kind)}`);
    }
    // `group` no está en `required`: el generador lo valida aparte con
    // assertValidGroup, así que hay que checarlo acá también o un proyecto sin
    // grupo pasa el borde y la UI no puede seccionarlo.
    if (spec.groups !== null) {
      const group = data.group;
      const listed = spec.groups.map((g) => JSON.stringify(g)).join(', ');
      if (typeof group !== 'string' || group.trim() === '') {
        problems.push(`missing group (expected one of ${listed})`);
      } else if (!spec.groups.includes(group)) {
        problems.push(`unknown group ${JSON.stringify(group)} (expected one of ${listed})`);
      }
    }
  }

  // Campos de nivel índice: presentes en toda entrada, sin importar el kind.
  const badIndexFields = ['slug', 'path'].filter(
    (field) => typeof data[field] !== 'string' || data[field].trim() === ''
  );
  if (badIndexFields.length > 0) {
    problems.push(`missing or empty index fields: ${badIndexFields.join(', ')}`);
  }

  return problems;
}

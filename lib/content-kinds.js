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

// --- writeup link sections (machineLinks / toolLinks) ------------------------
//
// El contrato aprobado (odd/tasks/writeup-links.md) de las secciones de enlaces
// del frontmatter de un writeup, camelCase y round-trip js-yaml como `tags`:
//   machineLinks: [{title*, url*, badge?, type?}]  type ∈ platform|download|ip|cve
//   toolLinks:    [{name*, url*, description?, developedByAuthor?, githubStars?, badge?}]
// Las claves ausentes o null son VÁLIDAS: la sección queda vacía y no se
// inventan defaults. Un bloque presente tiene que ser correcto.

// Tipos cerrados de `machineLinks[].type` (aprobados verbatim). Se listan en
// los mensajes exactamente como assertValidGroup lista las opciones de group.
const MACHINE_LINK_TYPES = Object.freeze(['platform', 'download', 'ip', 'cve']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Mismo formato "got" de assertValidGroup para los mensajes.
function shownValue(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

const nonEmptyStringRule = Object.freeze({
  test: isNonEmptyString,
  expected: () => 'a non-empty string',
});

// Reglas de campos por sección de enlaces. `required` debe ser string no
// vacío; `optional` solo se valida cuando está presente (undefined o null
// cuenta como ausente — nunca se inventan defaults). `expected` describe la
// expectativa en el mensaje de error.
const WRITEUP_LINK_RULES = deepFreeze({
  machineLinks: {
    required: { title: nonEmptyStringRule, url: nonEmptyStringRule },
    optional: {
      badge: nonEmptyStringRule,
      type: {
        test: (value) => typeof value === 'string' && MACHINE_LINK_TYPES.includes(value),
        expected: () =>
          `one of ${MACHINE_LINK_TYPES.map((entry) => JSON.stringify(entry)).join(', ')}`,
      },
    },
  },
  toolLinks: {
    required: { name: nonEmptyStringRule, url: nonEmptyStringRule },
    optional: {
      description: { test: (value) => typeof value === 'string', expected: () => 'a string' },
      developedByAuthor: { test: (value) => typeof value === 'boolean', expected: () => 'a boolean' },
      githubStars: {
        test: (value) => typeof value === 'string' || typeof value === 'number',
        expected: () => 'a string or a number',
      },
      badge: { test: (value) => typeof value === 'string', expected: () => 'a string' },
    },
  },
});

/**
 * Assert that the `machineLinks` / `toolLinks` sections of a writeup follow the
 * approved frontmatter contract (writeup link sections).
 *
 * Absent (or `null`) keys are VALID: a writeup without links keeps empty
 * sections and nothing is invented. A present key must be an array of plain
 * objects (not arrays, not null); `machineLinks` entries require non-empty
 * string `title` and `url` and may carry a non-empty string `badge` and a
 * `type` of exactly `platform` | `download` | `ip` | `cve`; `toolLinks` entries
 * require non-empty string `name` and `url` and may carry string `description`,
 * boolean `developedByAuthor`, string-or-number `githubStars` and string
 * `badge`.
 *
 * Fail-loud and collecting: every problem is gathered in one pass and thrown as
 * a single `Error` (one line per problem) in the wording family of
 * {@link assertValidGroup} and {@link missingFields} — each line names the
 * content file path, the offending entry index, the field and the offending
 * value, and the closed `type` vocabulary is listed exactly like the group
 * options.
 *
 * @param {Record<string, unknown>} data parsed writeup frontmatter
 * @param {string} filePath content file the frontmatter came from
 * @returns {void}
 */
export function assertValidWriteupLinks(data, filePath) {
  /** @type {string[]} */
  const problems = [];

  for (const [key, rules] of Object.entries(WRITEUP_LINK_RULES)) {
    const links = data[key];
    // Ausente o null = válido: la sección queda vacía, sin defaults.
    if (links === undefined || links === null) continue;

    if (!Array.isArray(links)) {
      problems.push(
        `Invalid writeup ${key} in ${filePath}: expected an array of link objects, got ${shownValue(links)}.`
      );
      continue;
    }

    links.forEach((entry, index) => {
      const where = `Invalid writeup ${key} entry #${index} in ${filePath}`;
      if (!isPlainObject(entry)) {
        problems.push(`${where}: expected a plain object, got ${shownValue(entry)}.`);
        return;
      }
      for (const [field, rule] of Object.entries(rules.required)) {
        if (!rule.test(entry[field])) {
          problems.push(
            `${where}: "${field}" must be ${rule.expected()}, got ${shownValue(entry[field])}.`
          );
        }
      }
      for (const [field, rule] of Object.entries(rules.optional)) {
        const value = entry[field];
        if (value === undefined || value === null) continue;
        if (!rule.test(value)) {
          problems.push(
            `${where}: "${field}" must be ${rule.expected()} when present, got ${shownValue(value)}.`
          );
        }
      }
    });
  }

  if (problems.length > 0) {
    throw new Error(problems.join('\n'));
  }
}

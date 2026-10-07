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
export const CERTIFICATE_GROUPS = Object.freeze(['universidad', 'hack4u', 'cisco']);

/**
 * @typedef {object} KindSpec
 * @property {string} root repository-relative content root, e.g. 'public/writeups'
 * @property {boolean} platformed whether files live one level deeper, under <root>/<platform>/
 * @property {string[]} required frontmatter keys that must be present and non-empty
 * @property {readonly string[] | null} groups closed `group` list (null when the kind has no groups)
 * @property {readonly string[]} tags closed tag vocabulary of the kind
 */

/**
 * The supported content kinds, keyed by kind name.
 *
 * writeups are the only platformed kind: their files live under
 * `public/writeups/<platform>/`. Projects and certificates are flat
 * (`public/projects/*.md`, `public/certificates/*.md`). Certificates do not
 * require `date`; their `order` drives the public display order instead.
 *
 * @type {{ readonly writeup: KindSpec, readonly project: KindSpec, readonly certificate: KindSpec }}
 */
export const KINDS = Object.freeze({
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

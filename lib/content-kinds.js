// Registro canónico de tipos de contenido: una sola fuente de verdad para el
// indexador de build (Node), los tests de drift y la app (Vite/TS), al estilo de
// lib/frontmatter.js y lib/taxonomy.js. Fase 1: writeup, project y certificate.
//
// - `root` es la ruta relativa al repo que contiene los markdown del tipo.
// - `platformed: true` significa que los archivos viven un nivel más abajo:
//   <root>/<platform>/*.md (solo los writeups). El resto es plano: <root>/*.md.
// - `required` lista las claves de frontmatter obligatorias; `missingFields`
//   aplica las reglas de presencia documentadas en su JSDoc.

/**
 * @typedef {object} KindSpec
 * @property {string} root repository-relative content root, e.g. 'public/writeups'
 * @property {boolean} platformed whether files live one level deeper, under <root>/<platform>/
 * @property {string[]} required frontmatter keys that must be present and non-empty
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
  writeup:     { root: 'public/writeups',     platformed: true,  required: ['title', 'date'] },
  project:     { root: 'public/projects',     platformed: false, required: ['title', 'date', 'image'] },
  certificate: { root: 'public/certificates', platformed: false, required: ['title', 'order', 'image', 'description'] },
});

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

// Modelo puro de EDICIÓN de contenido ya publicado (edit-content T1): el plan
// determinista y completo que consumirá el CLI interactivo
// scripts/edit-content.js (T2). Sin I/O — ni acceso a disco, ni módulos del
// sistema, ni variables del entorno — igual que lib/content-ingest.js: solo
// datos planos de entrada (identidad actual, markdown crudo del documento,
// nombres de archivo dentro de media/ y un objeto `changes` declarativo) y un
// plan de salida. Los tests en tests/content-edit.test.ts fijan el contrato
// (RED primero, TDD).
//
// Reglas aprobadas (odd/tasks/edit-content.md + contrato del padre):
//   - La validación de frontmatter es VERBATIM al pipeline y a la ingesta:
//     mensajes de missingFields / assertValidGroup / assertValidTags /
//     assertRequiredTags (lib/content-kinds.js, lib/taxonomy.js) y los
//     mensajes de `level` de lib/content-ingest.js. El contexto <file> es el
//     nombre del markdown actual (`<slug>.md`), igual que el sourceFileName de
//     la ingesta.
//   - `order` de certificados: entero (mensaje verbatim del generador, sin
//     punto final) y único frente a siblings.certificateOrders (familia del
//     generador: `Duplicate certificate order in <slug>: N is already used by
//     <other>`). Los mensajes NUEVOS de este módulo llevan <slug> (sin .md),
//     los reutilizados conservan <file>.
//   - Agregar/quitar evidencia numerada RENUMERA los supervivientes
//     ascendente desde 01 y reescribe las referencias del cuerpo al nuevo
//     número bajo el sitePath FINAL. Una referencia del cuerpo NUNCA apunta a
//     un archivo que el plan no produce: la referencia de un archivo quitado
//     se retira del cuerpo Y empuja problema (nunca se pierde evidencia en
//     silencio).
//   - Renombrar slug/plataforma actualiza las rutas finales, reescribe TODA
//     referencia del cuerpo que vivía bajo el sitePath previo y refresca la
//     clave `image:` del frontmatter; fileOps.move lleva el .md Y el media/.
//   - Cover: siempre termina en media/cover.webp y, cuando el plan refresca
//     `image:`, su valor es <sitePath final>/media/cover.webp. La cover de un
//     writeup puede omitirse en el CLI (su UI la deriva de `level`), pero si
//     se entrega igual se planea el archivo.
//   - Sin huérfanos ni referencias colgantes (espejo de tests/media.test.ts):
//     todo archivo resultante en media/ debe estar referenciado por el cuerpo
//     reescrito o por `image:`; toda referencia de imagen del cuerpo debe
//     resolver a un archivo planeado bajo <sitePath final>/media/.
//   - changes vacío ⇒ plan que no reescribe nada: mismo frontmatter, mismo
//     cuerpo, mismas rutas y fileOps vacío. Entradas intactas, síncrono y
//     determinista (misma entrada ⇒ misma salida).
//
// Derivaciones espejo de lib/content-ingest.js (entryPath de
// scripts/generate-index.js se reimplmenta igual que allí):
//   - la ruta de sitio espeja la raíz del kind ('public/writeups' → '/writeups')
//     y el nivel de plataforma de los writeups;
//   - la normalización de nombres nuevos es la de la ingesta: minúsculas,
//     espacios → '-', y el sufijo .md se strippea (solo para slugs nuevos).
import { parseFrontmatter } from './frontmatter.js';
import { assertRequiredTags, assertValidTags } from './taxonomy.js';
import { KINDS, assertValidGroup, missingFields } from './content-kinds.js';
import { WRITEUP_LEVELS } from './content-ingest.js';

/**
 * The current state of one published document, as the interactive CLI
 * inventoried it. `slug` and `platform` are optional identity hints (the
 * directory-derived values) used only to fill `current` values of the
 * rename/platform aspects; every decision derives from `frontmatter`, `media`
 * and `bodyHasImages`.
 *
 * @typedef {object} ContentEditState
 * @property {Record<string, unknown>} frontmatter parsed frontmatter of the current document
 * @property {string[]} media file names currently inside media/
 * @property {boolean} bodyHasImages whether the body references image files
 * @property {string} [slug] current content slug (identity hint)
 * @property {string} [platform] current writeup platform (identity hint)
 */

/**
 * One editable aspect the CLI offers, in inventory order. `derived: true`
 * marks a directory-derived field (writeup `platform`); `editable: false`
 * marks a display-only aspect the CLI may omit (a writeup's cover, whose UI
 * image derives from `level`). `current` is `undefined` when the aspect has
 * no value yet.
 *
 * @typedef {object} EditableAspect
 * @property {string} field aspect key, e.g. 'title' or 'evidence'
 * @property {string} label human-readable label for the CLI menu
 * @property {unknown} current current value
 * @property {boolean} editable whether the CLI may change it
 * @property {boolean} [derived] directory-derived field
 */

/**
 * Declarative edits. Every field is optional; `changes: {}` plans nothing.
 *
 * @typedef {object} ContentEditChanges
 * @property {Record<string, unknown>} [fields] frontmatter keys to set;
 *   `null`/`undefined` REMOVES the key. `platform` and `slug` are ignored
 *   (directory-derived, never written). The `image` key is owned by `cover`
 *   and the rename refresh: those win over a `fields` value.
 * @property {{ source: string }} [cover] new cover image source name →
 *   planned as media/cover.webp
 * @property {{ add?: string[], remove?: string[] }} [images] numbered
 *   evidence edits: `add` lists NEW source file names (converted into the
 *   next free numbers), `remove` lists CURRENT media file names (numbered
 *   evidence only)
 * @property {{ slug?: string, platform?: string }} [rename] identity change;
 *   `platform` only applies to writeups and is ignored for flat kinds
 */

/**
 * The planner input: current identity + current bytes + planned changes.
 *
 * @typedef {object} ContentEditInput
 * @property {'writeup' | 'project' | 'certificate'} kind content kind
 * @property {string} slug current content slug
 * @property {string} [platform] current writeup platform (writeups carry it)
 * @property {string} markdown raw current `.md` (frontmatter + body)
 * @property {string[]} media current file names inside media/
 * @property {ContentEditChanges} [changes] declarative edits (see typedef)
 * @property {{ certificateOrders?: { order: unknown, slug: string }[] }} [siblings]
 *   neighbouring certificates for `order` collision detection
 */

/**
 * One planned media conversion: `source` is the plain file name given by the
 * caller, `target` is the destination RELATIVE to the final `targetDir`
 * (always under `media/`, converted to .webp by the CLI). Only NEW/replaced
 * sources appear here — surviving files that only change their number travel
 * as `fileOps.move` entries.
 *
 * @typedef {{ source: string, target: string }} ImagePlanEntry
 */

/**
 * The file operations the CLI applies, in this order: DELETEs first (current
 * locations), then MOVEs in array order (the per-file renumbering entries are
 * listed after the media-directory move and reference the FINAL media
 * directory), then the imagePlan conversions into the final `targetDir`, then
 * WRITEs of the final markdown path.
 *
 * @typedef {object} ContentEditFileOps
 * @property {string[]} write final markdown paths whose content changed
 * @property {string[]} delete removed media files (current locations)
 * @property {{ from: string, to: string }[]} move ordered moves: the `.md`
 *   and the `media/` directory when renamed, then the surviving evidence
 *   files whose number changed
 */

/**
 * The complete deterministic edit plan.
 *
 * @typedef {object} ContentEditPlan
 * @property {string[]} problems every validation problem of the RESULTING
 *   document, in the documented order: missing required fields, group, tags,
 *   level, platform, certificate order, media-op problems, body reference
 *   problems (first-occurrence order, deduped), then orphan problems. Empty
 *   when the resulting document is pipeline-ready. Reused vocabulary is
 *   verbatim (missingFields / assertValidGroup / assertValidTags /
 *   assertRequiredTags / content-ingest level wordings / the generator's
 *   "Invalid certificate order"); this module's own messages follow the same
 *   families and are pinned verbatim by the tests.
 * @property {Record<string, unknown>} frontmatter the resulting frontmatter
 *   object: original keys kept as parsed, `fields` applied (null/undefined
 *   removes), `image` refreshed to `<sitePath>/media/cover.webp` when a cover
 *   was planned or when a rename moved it away from the old sitePath.
 *   `platform` and `slug` are NEVER written (derived from the directory).
 * @property {string} rewrittenBody the resulting body: relative/wikilink
 *   references and references under the old sitePath rewritten to
 *   `![…](<sitePath final>/media/NN.webp)` with the NEW numbering (an `imgN`
 *   alt that matched the old number follows the new one; any other alt is the
 *   author's text and is preserved, so a plan without media changes rewrites
 *   the body byte for byte); references to removed files are dropped AND reported; unmatched references stay untouched AND
 *   push a problem; added evidence appends its reference at the end of the
 *   body. Absolute foreign paths and URLs are never rewritten (they push the
 *   unmatched problem like any other unresolvable image reference).
 * @property {string} sitePath FINAL site path (after rename)
 * @property {string} targetDir FINAL repository-relative content directory
 * @property {string} markdownPath FINAL repository-relative markdown path
 * @property {{ sitePath: string, targetDir: string, markdownPath: string }} previous
 *   the locations BEFORE the edit (what exists on disk today)
 * @property {ImagePlanEntry[]} imagePlan sources to convert into media/
 *   targets: the added evidence images (in add order, numbered after the
 *   survivors) and the cover, appended last, as `media/cover.webp`
 * @property {ContentEditFileOps} fileOps the file operations (see typedef);
 *   EMPTY ({ write: [], delete: [], move: [] }) when `changes` rewrites nothing
 * @property {boolean} isDraft whether the resulting frontmatter says `draft: true`
 */

// Extensiones que convierten una wikilink [[…]] en referencia de imagen.
// Espejo de lib/content-ingest.js.
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

// Referencia "no relativa": URL con esquema (http, https, data, …) o camino
// absoluto /… — jamás se reescriben salvo que vivan bajo el sitePath del
// propio contenido (regla de rename: TODO lo que vivía bajo el sitePath viejo
// se mueve al nuevo).
const NON_RELATIVE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;

// Ambas formas de referencia de imagen en una sola pasada determinista
// (espejo de lib/content-ingest.js):
//   grupo 1/2 → wikilink (!?[[nombre|alias]]), grupo 2 = destino;
//   grupo 3/4 → imagen markdown ![alt](ruta "título"?), grupo 4 = ruta.
const IMAGE_REF_RE =
  /(!?\[\[([^\[\]\n]+)\]\])|(!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\))/g;

// Un nombre de evidencia numerada: '01.webp', '2.png'… (el dígito es su número).
const NUMBERED_NAME_RE = /^\d+\.[A-Za-z0-9]+$/;

// Destino fijo de la cover (regla 5): siempre media/cover.webp.
const COVER_NAME = 'cover.webp';

/** `1` → '01' (NN de media/NN.webp; a partir de 100 crece solo). */
function nn(sequence) {
  return String(sequence).padStart(2, '0');
}

// Mismo formato "got" de assertValidGroup / generate-index.js para los
// mensajes reutilizados.
function shown(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** Objeto plano (no array, no null): contenedor tipico de opciones. */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** El nombre del archivo de imagen de una ruta (lo que vive en media/). */
function baseName(pathish) {
  return pathish.slice(pathish.lastIndexOf('/') + 1);
}

/**
 * Igualdad profunda para datos planos (YAML): primitivos, Date, arrays y
 * objetos. Solo se usa para detectar si el plan cambió el contenido.
 */
function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => sameValue(entry, b[index]));
  }
  if (
    a instanceof Date ||
    b instanceof Date ||
    Array.isArray(a) ||
    Array.isArray(b) ||
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        sameValue(
          /** @type {Record<string, unknown>} */ (a)[key],
          /** @type {Record<string, unknown>} */ (b)[key]
        )
    )
  );
}

/**
 * Nombres de evidencia numerada de una lista de media, ordenados por número
 * actual ascendente (y luego por nombre, para ser byte-estables). El número
 * actual es semántico (el cuerpo lo referencia), así que se ordena por valor
 * numérico del stem, no lexicográficamente.
 *
 * @param {string[]} names file names inside media/
 * @returns {string[]} numbered names in ascending numeric order
 */
function numberedNames(names) {
  return names
    .filter((name) => NUMBERED_NAME_RE.test(name))
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA !== numB ? numA - numB : (a < b ? -1 : a > b ? 1 : 0);
    });
}

/**
 * Coincidencia por nombre: primero exacta (case-sensitive) y luego
 * insensible a mayúsculas — el mismo orden que usa la ingesta.
 *
 * @param {string[]} names candidate names
 * @param {string} name name to look for
 * @returns {string | null} the matched name, or null
 */
function findName(names, name) {
  const exact = names.find((candidate) => candidate === name);
  if (exact !== undefined) return exact;
  const lower = name.toLowerCase();
  return names.find((candidate) => candidate.toLowerCase() === lower) ?? null;
}

/**
 * Normaliza un slug nuevo con la regla documentada de la ingesta: strip del
 * sufijo .md (case-sensitive), minúsculas, espacios → '-'. Un valor vacío o
 * no-string significa "sin cambio".
 *
 * @param {unknown} value requested new slug
 * @returns {string | null} the normalized slug, or null to keep the current one
 */
function normalizeSlug(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.replace(/\.md$/, '').toLowerCase().replace(/ /g, '-');
}

/**
 * Normaliza una plataforma nueva como la ingesta: trim + minúsculas (es el
 * nombre de directorio que creó add-content). Vacío o no-string ⇒ sin cambio.
 *
 * @param {unknown} value requested new platform
 * @returns {string | null} the normalized platform, or null to keep the current one
 */
function normalizePlatform(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.toLowerCase();
}

/**
 * The interactive inventory of editable aspects, derived from the REAL state
 * (never from the kind alone): what this document carries, what it lacks and
 * what its media/body actually contain decide what the CLI offers.
 *
 * Pure and synchronous. Aspect order is fixed: title, description, tags,
 * draft, the kind-specific metadata (date/level/platform for writeups,
 * date/group for projects, order/group/date for certificates), then the image
 * aspects (cover always, evidence only when the body references images or
 * media carries numbered files) and finally the rename aspect.
 *
 * @param {'writeup' | 'project' | 'certificate'} kind content kind
 * @param {ContentEditState} state current document state (see typedef)
 * @returns {EditableAspect[]} ordered aspect descriptors
 */
export function describeEditable(kind, state) {
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }
  const frontmatter = isPlainObject(state.frontmatter) ? state.frontmatter : {};
  const media = Array.isArray(state.media) ? state.media : [];
  const bodyHasImages = state.bodyHasImages === true;

  /** @type {EditableAspect[]} */
  const aspects = [];
  const push = (field, label, current, editable, derived) => {
    /** @type {EditableAspect} */
    const aspect = { field, label, current, editable };
    if (derived === true) aspect.derived = true;
    aspects.push(aspect);
  };

  // Base: todos los kinds.
  push('title', 'Title', frontmatter.title, true);
  push('description', 'Description', frontmatter.description, true);
  push('tags', 'Tags', frontmatter.tags, true);
  push('draft', 'Draft', frontmatter.draft === true, true);

  // Específicos por kind (solo los que aplican).
  if (kind === 'writeup') {
    push('date', 'Date', frontmatter.date, true);
    push('level', 'Level', frontmatter.level, true);
    push('platform', 'Platform', state.platform, true, true); // derivado del directorio
  } else if (kind === 'project') {
    push('date', 'Date', frontmatter.date, true);
    push('group', 'Group', frontmatter.group, true);
  } else {
    push('order', 'Order', frontmatter.order, true);
    push('group', 'Group', frontmatter.group, true);
    // `date` es opcional en certificates: solo se ofrece si existe.
    if (frontmatter.date !== undefined && frontmatter.date !== null) {
      push('date', 'Date', frontmatter.date, true);
    }
  }

  // Imágenes: cover siempre (no editable en writeups — su UI la deriva de
  // `level`, el CLI puede omitirla), evidencia solo cuando hay qué editar.
  const cover = media.find((name) => name.replace(/\.[^.]*$/, '') === 'cover');
  push('cover', 'Cover image', cover, kind !== 'writeup');
  const numbered = numberedNames(media);
  if (bodyHasImages || numbered.length > 0) {
    push('evidence', 'Evidence images', numbered, true);
  }
  push('rename', kind === 'writeup' ? 'Rename slug / platform' : 'Rename slug', state.slug, true);

  return aspects;
}

/**
 * Build the complete deterministic edit plan from plain inputs.
 *
 * Pure and synchronous: same inputs → same output, inputs untouched. Throws
 * only for two hard input errors, mirroring planContentIngestion: an unknown
 * `kind`, or YAML frontmatter that does not parse
 * (`Failed to parse <slug>.md: …`). Every SEMANTIC problem is collected into
 * `problems` instead — the CLI renders them all and refuses to apply while
 * the list is non-empty.
 *
 * @param {ContentEditInput} input current identity, bytes, media and changes
 * @returns {ContentEditPlan} the full plan (every field documented above)
 */
export function planContentEdit(input) {
  const { kind, slug, markdown, media, changes = {}, siblings = {} } = input;
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }
  const file = `${slug}.md`;

  let parsed;
  try {
    parsed = parseFrontmatter(markdown);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${file}: ${reason}`);
  }
  const data = parsed.data;
  const body = parsed.content;

  const problems = [];

  // --- frontmatter resultante ---------------------------------------------

  // `fields` setea/elimina claves (null | undefined elimina). `platform` y
  // `slug` nunca se escriben (derivados del directorio). `image` es propiedad
  // de `cover`/rename: esos refrescos ganan y se aplican más abajo.
  /** @type {Record<string, unknown>} */
  const frontmatter = { ...data };
  const fields = isPlainObject(changes.fields) ? changes.fields : {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'platform' || key === 'slug') continue;
    if (value === undefined || value === null) delete frontmatter[key];
    else frontmatter[key] = value;
  }

  // 1. Campos requeridos sobre el frontmatter RESULTANTE (verbatim de
  //    missingFields/generate-index: los valores derivados no borran problemas).
  const missing = missingFields(frontmatter, kind);
  if (missing.length > 0) {
    problems.push(`Missing required frontmatter field(s) in ${file}: ${missing.join(', ')}`);
  }

  // 2. `group` (project/certificate): assertValidGroup verbatim.
  if (spec.groups !== null) {
    try {
      assertValidGroup(frontmatter.group, /** @type {'project' | 'certificate'} */ (kind), file);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  // 3. `tags`: assertValidTags para writeups, assertRequiredTags para
  //    project/certificate — espejo exacto del pipeline y de la ingesta.
  try {
    if (kind === 'writeup') {
      assertValidTags(frontmatter.tags, file);
    } else {
      assertRequiredTags(frontmatter.tags, kind, file);
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  // 4. `level` (writeup): obligatorio y exactamente 'Easy' | 'Medium' |
  //    'Hard' — los mensajes son verbatim de lib/content-ingest.js.
  if (kind === 'writeup') {
    const effectiveLevel = frontmatter.level;
    const listedLevels = WRITEUP_LEVELS.map((entry) => JSON.stringify(entry)).join(', ');
    if (effectiveLevel === undefined || effectiveLevel === null) {
      problems.push(`Missing writeup level in ${file}: expected one of ${listedLevels}.`);
    } else if (typeof effectiveLevel !== 'string' || !WRITEUP_LEVELS.includes(effectiveLevel)) {
      problems.push(
        `Invalid writeup level in ${file}: expected one of ${listedLevels}, got ${shown(effectiveLevel)}.`
      );
    }
  }

  // 5. `platform` (writeup): identidad de directorio con la derivación de la
  //    ingesta como respaldo (opción → categories[0] en minúsculas). Sin
  //    plataforma derivable hay problema y el plan degrada a la forma plana.
  let platform;
  if (kind === 'writeup') {
    const fromInput = typeof input.platform === 'string' ? input.platform.trim() : '';
    const categories = Array.isArray(frontmatter.categories) ? frontmatter.categories : [];
    const first = categories[0];
    const fromCategory = typeof first === 'string' ? first.trim() : '';
    const raw = fromInput !== '' ? fromInput : fromCategory;
    if (raw !== '') {
      platform = raw.toLowerCase();
    } else {
      problems.push(
        `Missing writeup platform in ${file}: expected the platform option or categories[0] in the frontmatter.`
      );
    }
  }

  // 6. `order` (certificate): entero (verbatim del generador, que NO cierra
  //    con punto) y único frente a siblings.certificateOrders (familia del
  //    generador; la entrada propia nunca choca consigo misma). Un order
  //    ausente ya lo reportó missingFields — el generador tampoco llegaría a
  //    validar el order después de un campo requerido ausente.
  const effectiveOrder = frontmatter.order;
  if (kind === 'certificate' && effectiveOrder !== undefined && effectiveOrder !== null) {
    if (!Number.isInteger(effectiveOrder)) {
      problems.push(
        `Invalid certificate order in ${file}: expected an integer, got ${shown(effectiveOrder)}`
      );
    } else {
      const owners = Array.isArray(siblings.certificateOrders) ? siblings.certificateOrders : [];
      const clash = owners.find(
        (entry) => isPlainObject(entry) && entry.slug !== slug && entry.order === effectiveOrder
      );
      if (clash !== undefined) {
        problems.push(
          `Duplicate certificate order in ${slug}: ${effectiveOrder} is already used by ${clash.slug}`
        );
      }
    }
  }

  // --- identidad: rutas previas y finales ---------------------------------

  // Espejo de entryPath de scripts/generate-index.js (ver lib/content-ingest.js):
  // 'public/<root>' → '/<root>', más el nivel de plataforma de los writeups.
  const urlRoot = '/' + spec.root.replace(/^public\//, '');
  const previousSegment = spec.platformed && platform !== undefined ? `/${platform}` : '';
  const previous = {
    sitePath: `${urlRoot}${previousSegment}/${slug}`,
    targetDir: `${spec.root}${previousSegment}/${slug}`,
    markdownPath: `${spec.root}${previousSegment}/${slug}.md`,
  };

  const rename = isPlainObject(changes.rename) ? changes.rename : {};
  const newSlug = normalizeSlug(rename.slug) ?? slug;
  const newPlatform =
    kind === 'writeup' ? normalizePlatform(rename.platform) ?? platform : platform;
  const finalSegment = spec.platformed && newPlatform !== undefined ? `/${newPlatform}` : '';
  const sitePath = `${urlRoot}${finalSegment}/${newSlug}`;
  const targetDir = `${spec.root}${finalSegment}/${newSlug}`;
  const markdownPath = `${spec.root}${finalSegment}/${newSlug}.md`;
  const identityChanged = sitePath !== previous.sitePath;

  // --- operaciones sobre media/ -------------------------------------------

  const currentNumbered = numberedNames(media);
  const currentOther = media.filter((name) => !NUMBERED_NAME_RE.test(name));

  const imageChanges = isPlainObject(changes.images) ? changes.images : {};
  const removeRequests = Array.isArray(imageChanges.remove) ? imageChanges.remove : [];
  /** @type {Set<string>} */
  const removeSet = new Set();
  const seenUnknownRemove = new Set();
  for (const entry of removeRequests) {
    const name = typeof entry === 'string' ? entry : '';
    const match = findName(currentNumbered, name);
    if (match === null) {
      // Fail-loud: pedir borrar algo inexistente nunca se ignora en silencio.
      if (!seenUnknownRemove.has(name)) {
        seenUnknownRemove.add(name);
        problems.push(
          `Cannot remove unknown evidence image in ${slug}: ${JSON.stringify(name)} is not a numbered media file.`
        );
      }
      continue;
    }
    removeSet.add(match);
  }

  // Secuencia final de evidencia: supervivientes en su orden numérico actual
  // (el plan es minimalista: solo cambia de número lo que debe) y luego las
  // altas, en el orden declarado por `changes.images.add`.
  const survivors = currentNumbered.filter((name) => !removeSet.has(name));
  const seenAdds = new Set();
  const addNames = (Array.isArray(imageChanges.add) ? imageChanges.add : [])
    .filter((entry) => typeof entry === 'string' && entry !== '')
    .filter((name) => (seenAdds.has(name) ? false : (seenAdds.add(name), true)));
  const sequence = [...survivors, ...addNames];
  const newNumberOf = new Map(survivors.map((name, index) => [name, index + 1]));

  const coverPlanned =
    isPlainObject(changes.cover) &&
    typeof changes.cover.source === 'string' &&
    changes.cover.source.trim() !== '';
  const currentCover = currentOther.find((name) => name.replace(/\.[^.]*$/, '') === 'cover');
  // La cover siempre termina como media/cover.webp (regla 5); sin cover nueva
  // el archivo existente conserva su nombre (idempotencia byte a byte).
  const resultCoverName = coverPlanned ? COVER_NAME : currentCover;

  // --- cuerpo: resolver, renumerar, retirar, reportar ---------------------

  // URLs del sitePath final ya referenciadas (cuerpo + `image:`): la regla de
  // huérfanos exige que TODO archivo resultante esté en este conjunto.
  /** @type {Set<string>} */
  const referencedUrls = new Set();
  const seenUnmatched = new Set();
  const seenRemoved = new Set();
  /** @type {string[]} */
  const bodyProblems = [];

  const unmatchedMessage = (name) =>
    `Unmatched image reference in ${file}: ${JSON.stringify(name)} has no file in the images list.`;

  const walkedBody = body.replace(
    IMAGE_REF_RE,
    (match, wikiFull, wikiTarget, mdFull, mdTarget) => {
      let isWiki = false;
      let name; // nombre que resuelve contra media/
      let shownName; // nombre mostrado en el mensaje de problema

      if (wikiFull !== undefined) {
        isWiki = true;
        name = String(wikiTarget).split('|')[0].trim();
        // Wikilink sin extensión de imagen = enlace normal, no referencia.
        if (!IMAGE_EXT_RE.test(name)) return match;
        shownName = name;
      } else {
        void mdFull;
        const raw = String(mdTarget);
        if (NON_RELATIVE_RE.test(raw)) {
          // Camino absoluto del propio contenido: vive bajo el sitePath y se
          // resuelve por nombre (regla de rename). URL o camino ajeno: jamás
          // se reescribe… pero tampoco resuelve bajo el media/ final, así que
          // empuja problema (la convención de tests/media.test.ts aplica a
          // TODA referencia de imagen del cuerpo).
          const previousPrefix = `${previous.sitePath}/media/`;
          const finalPrefix = `${sitePath}/media/`;
          if (raw.startsWith(previousPrefix) || raw.startsWith(finalPrefix)) {
            name = baseName(raw);
            shownName = raw;
          } else {
            if (!seenUnmatched.has(raw)) {
              seenUnmatched.add(raw);
              bodyProblems.push(unmatchedMessage(raw));
            }
            return match;
          }
        } else {
          name = raw.replace(/^(?:\.\/)+/, '');
          shownName = name;
        }
      }

      const numberedHit = findName(currentNumbered, name);
      if (numberedHit !== null) {
        if (removeSet.has(numberedHit)) {
          // Regla 3/6: la referencia se RETIRA (nunca apunta a un archivo que
          // el plan no produce) y el problema es fail-loud — no se pierde
          // evidencia en silencio.
          if (!seenRemoved.has(numberedHit)) {
            seenRemoved.add(numberedHit);
            bodyProblems.push(
              `Cannot remove referenced media file in ${slug}: ${JSON.stringify(numberedHit)} is still referenced by the body.`
            );
          }
          return '';
        }
        const newNumber = newNumberOf.get(numberedHit);
        const target = `${sitePath}/media/${nn(newNumber)}.webp`;
        referencedUrls.add(target);
        if (isWiki) return `![img${newNumber}](${target})`;
        return `![${altOf(mdFull, parseInt(numberedHit, 10), newNumber)}](${target})`;
      }

      const otherHit = findName(currentOther, name);
      if (otherHit !== null) {
        // Archivo no numerado (la cover): se normaliza al sitePath final
        // conservando el nombre y el alt.
        const target = `${sitePath}/media/${otherHit}`;
        referencedUrls.add(target);
        if (isWiki) return `![${otherHit}](${target})`;
        return `![${altOf(mdFull, null, null)}](${target})`;
      }

      if (!seenUnmatched.has(shownName)) {
        seenUnmatched.add(shownName);
        bodyProblems.push(unmatchedMessage(shownName));
      }
      return match;
    }
  );
  problems.push(...bodyProblems);

  // Las altas de evidencia agregan su referencia al FINAL del cuerpo: el
  // archivo nuevo nunca queda huérfano y el texto existente no se reordena.
  /** @type {string[]} */
  const appendedRefs = [];
  addNames.forEach((source, index) => {
    const newNumber = survivors.length + index + 1;
    const target = `${sitePath}/media/${nn(newNumber)}.webp`;
    referencedUrls.add(target);
    appendedRefs.push(`![img${newNumber}](${target})`);
  });
  let rewrittenBody = walkedBody;
  if (appendedRefs.length > 0) {
    const separator = rewrittenBody === '' ? '' : rewrittenBody.endsWith('\n') ? '\n' : '\n\n';
    rewrittenBody = rewrittenBody + separator + appendedRefs.join('\n');
  }

  // --- refresco de `image:` ----------------------------------------------

  if (coverPlanned) {
    frontmatter.image = `${sitePath}/media/cover.webp`;
  } else if (
    identityChanged &&
    typeof frontmatter.image === 'string' &&
    frontmatter.image.startsWith(`${previous.sitePath}/media/`)
  ) {
    // Vivió bajo el sitePath viejo y el plan la refresca: el valor refrescado
    // es siempre la cover bajo el sitePath final (regla 5).
    frontmatter.image = `${sitePath}/media/cover.webp`;
  }
  if (typeof frontmatter.image === 'string') {
    referencedUrls.add(frontmatter.image);
  }

  // --- regla de huérfanos (espejo de tests/media.test.ts) ----------------

  /** @type {string[]} */
  const resultNames = [
    ...sequence.map((_, index) => `${nn(index + 1)}.webp`),
    ...currentOther.filter((name) => name !== resultCoverName),
  ];
  if (resultCoverName !== undefined) resultNames.push(resultCoverName);
  for (const name of resultNames) {
    if (!referencedUrls.has(`${sitePath}/media/${name}`)) {
      problems.push(`Unreferenced media file in ${slug}: ${JSON.stringify(name)} would become an orphan.`);
    }
  }

  // --- imagePlan y fileOps ----------------------------------------------

  // Solo fuentes NUEVAS/reemplazadas se convierten; los supervivientes que
  // solo cambian de número viajan como `move` (ya son .webp).
  /** @type {ImagePlanEntry[]} */
  const imagePlan = [];
  addNames.forEach((source, index) => {
    imagePlan.push({ source, target: `media/${nn(survivors.length + index + 1)}.webp` });
  });
  if (coverPlanned) {
    imagePlan.push({ source: changes.cover.source.trim(), target: `media/${COVER_NAME}` });
  }

  const contentChanged = !sameValue(frontmatter, data) || rewrittenBody !== body;
  const deletePaths = currentNumbered
    .filter((name) => removeSet.has(name))
    .map((name) => `${previous.targetDir}/media/${name}`);
  /** @type {{ from: string, to: string }[]} */
  const move = [];
  if (identityChanged) {
    // Regla 4: el move lleva el .md Y el directorio media/.
    move.push({ from: previous.markdownPath, to: markdownPath });
    move.push({ from: `${previous.targetDir}/media`, to: `${targetDir}/media` });
  }
  survivors.forEach((oldName, index) => {
    const newName = `${nn(index + 1)}.webp`;
    if (oldName !== newName) {
      // Los renombres por renumeración viajan DESPUÉS del move del directorio
      // y por eso declaran rutas bajo el media/ FINAL.
      move.push({ from: `${targetDir}/media/${oldName}`, to: `${targetDir}/media/${newName}` });
    }
  });

  return {
    problems,
    frontmatter,
    rewrittenBody,
    sitePath,
    targetDir,
    markdownPath,
    previous,
    imagePlan,
    fileOps: {
      write: contentChanged ? [markdownPath] : [],
      delete: deletePaths,
      move,
    },
    isDraft: frontmatter.draft === true,
  };
}

/**
 * Alt de una referencia markdown tras su reescritura: el alt canónico `imgN`
 * que emparejaba el número VIEJO sigue al número nuevo (la convención del
 * repo los empareja con media/NN.webp); cualquier otro alt — incluidos `imgN`
 * desincronizados ya presentes en el documento — es texto del autor y se
 * conserva. Así un plan sin cambios de media reescribe el cuerpo byte a byte.
 *
 * @param {string} mdFull full markdown image match `![alt](target)`
 * @param {number | null} oldNumber previous evidence number, or null for non-numbered files
 * @param {number | null} newNumber new evidence number, or null for non-numbered files
 * @returns {string} the alt text to write back
 */
function altOf(mdFull, oldNumber, newNumber) {
  const alt = mdFull.slice(2, mdFull.indexOf(']'));
  if (oldNumber !== null && newNumber !== null && alt === `img${oldNumber}`) return `img${newNumber}`;
  return alt;
}

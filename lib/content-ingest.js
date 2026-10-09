// Modelo puro de ingesta de contenido (T1): el plan determinista y completo que
// consumirá el CLI scripts/add-content.js (T2). Sin I/O — ni fs, ni path, ni
// process — igual que src/lib/projectsModel.ts: solo datos planos de entrada
// (markdown crudo, nombre del archivo, lista de nombres de imagen y opciones)
// y un plan de salida. Los tests en tests/content-ingest.test.ts fijan el
// contrato (RED primero, TDD).
//
// Reglas aprobadas (odd/tasks/content-ingestion.md, decisiones humanas):
//   - Todos los problemas de frontmatter se acumulan en un solo paso (nunca se
//     tira en el primero) y reutilizan EL vocabulario del pipeline: mensajes
//     verbatim de missingFields / assertValidGroup / assertValidTags /
//     assertRequiredTags (lib/content-kinds.js, lib/taxonomy.js).
//   - `level` es OBLIGATORIO para writeups (su cover está estandarizado por
//     dificultad) y debe ser exactamente 'Easy' | 'Medium' | 'Hard'.
//   - Writeups NUNCA llevan cover (la UI la deriva de `level`): la opción
//     `cover` se ignora para ellos. Projects/certificates la exigen.
//   - Las referencias de imagen del cuerpo ([[name.png]], ![alt](name.png),
//     ![alt](./name.png)) se reescriben a ![imgN](<sitePath>/media/NN.webp);
//     las URLs absolutas /... y http(s):// NUNCA se tocan; las referencias sin
//     archivo coincidente quedan intactas Y empujan un problema (fail-loud,
//     nunca se pierde evidencia en silencio); sin referencias el cuerpo queda
//     intacto (nunca se inventan inserciones).
//   - `platform` nunca se escribe en el frontmatter (deriva del directorio);
//     `image` solo se agrega/refresca para project/certificate.
//   - Para certificates la imagen numerada solo se planea si el cuerpo
//     reescrito la referencia (decisión humana): writeups y projects mantienen
//     el plan completo de la carpeta aunque no referencien la imagen.
//
// Derivaciones espejo del pipeline (scripts/generate-index.js es la fuente de
// verdad; entryPath NO está exportado, así que se reimplmenta aquí):
//   - la ruta de sitio espeja la raíz del kind ('public/writeups' → '/writeups')
//     y el nivel de plataforma de los writeups;
//   - el slug viene del nombre de archivo, con la normalización de la ingesta
//     (minúsculas, espacios → '-') documentada en planContentIngestion.
import { parseFrontmatter } from './frontmatter.js';
import { assertRequiredTags, assertValidTags } from './taxonomy.js';
import { KINDS, assertValidGroup, missingFields } from './content-kinds.js';

/**
 * The verbatim writeup level vocabulary (approved): exactly these three
 * values, case-sensitive. Same vocabulary the UI renders
 * (src/lib/directoryModel.ts DIRECTORY_LEVELS) and the cover map keys on
 * (src/lib/contentAdapter.ts WRITEUP_COVER_BY_LEVEL).
 *
 * @type {readonly string[]}
 */
export const WRITEUP_LEVELS = Object.freeze(['Easy', 'Medium', 'Hard']);

/**
 * One planned media file: `source` is the plain file name as given by the
 * caller, `target` is the destination path RELATIVE to `targetDir`
 * (always under `media/`, converted to .webp by the CLI).
 *
 * @typedef {{ source: string, target: string }} ImagePlanEntry
 */

/**
 * CLI options accepted by the builder. Every field is optional; the options
 * win over the frontmatter for the field they name (explicit caller intent).
 *
 * @typedef {object} ContentIngestionOptions
 * @property {string} [platform] writeup platform (else categories[0]); ignored for flat kinds
 * @property {string} [level] writeup level (else frontmatter `level`); ignored for flat kinds
 * @property {string} [cover] cover file name; REQUIRED for project/certificate, ignored for writeups
 * @property {string} [group] project/certificate group (else frontmatter `group`)
 */

/**
 * The complete deterministic ingestion plan.
 *
 * @typedef {object} ContentIngestionPlan
 * @property {string[]} problems every frontmatter/body validation problem, in
 *   the documented order: missing required fields, group, tags, level,
 *   platform, cover, then unmatched body references (first-occurrence order,
 *   deduped by name). Empty when the content is pipeline-ready. Exact
 *   pipeline wording: `Missing required frontmatter field(s) in <file>: …`
 *   (generate-index.js), the thrown messages of assertValidGroup /
 *   assertValidTags / assertRequiredTags, and the level/platform/cover/
 *   reference wordings of this module (pinned verbatim by the tests).
 * @property {string} slug from `sourceFileName`: strip the `.md` extension
 *   (case-sensitive, mirroring generate-index.js), lowercase, then each space
 *   → '-'. E.g. 'Wave Test.md' → 'wave-test'.
 * @property {string} sitePath site path of the content directory, mirroring
 *   the KINDS root like generate-index.js `entryPath` ('public/writeups' →
 *   '/writeups'): platformed kinds get `/writeups/<platform>/<slug>`, flat
 *   kinds `/<kind-root>/<slug>`. When a writeup's platform is underivable the
 *   plan degrades deterministically to the flat form and reports the problem.
 * @property {string} targetDir repository-relative content directory
 *   (`public/writeups/<platform>/<slug>`, `public/projects/<slug>`, …): the
 *   parent of `media/` and the base of every `imagePlan` target.
 * @property {string} markdownPath repository-relative destination of the
 *   content `.md` — ALWAYS a sibling of `targetDir`, never inside it:
 *   `public/writeups/<platform>/<slug>.md`, `public/projects/<slug>.md`, …
 *   This is the layout generate-index.js scans (platformedFiles/flatFiles
 *   read `<root>/<platform>/*.md` and `<root>/*.md`); writing the file at
 *   `targetDir/<slug>.md` would hide it from the index and from the site.
 * @property {ImagePlanEntry[]} imagePlan the numbered media first. For
 *   writeup/project: EVERY source image, sorted ascending by name with the
 *   default Array#sort lexicographic order (UTF-16 code units, like
 *   generate-index.js file scans), so the plan is byte-stable across machines
 *   and input order never matters — mapped to `media/01.webp`…`media/NN.webp`
 *   (zero-padded, 1-based sequence); unreferenced images are planned too (the
 *   folder plan is complete, documented human decision). For certificate:
 *   ONLY a source image the rewritten body actually references is planned as
 *   a numbered file — a certificate image that is neither referenced nor the
 *   cover is NOT planned (never write the same image twice as an unreferenced
 *   numbered copy plus the cover: that duplicate is an orphan). The target
 *   name always derives from the position in the FULL sorted image list, so a
 *   rewritten reference never points at a renumbered file. Then the cover
 *   entry `{ source: cover, target: 'media/cover.webp' }` appended for
 *   project/certificate. Writeups get NO cover entry ever (their cover is
 *   standardized by `level` in the UI and the `cover` option is ignored). A
 *   project cover must be one of `images` (it comes from the same folder) or
 *   the entry is not planned; a certificate cover may name a file outside the
 *   folder (path-ish name) and is planned as given. A cover that is also in
 *   `images` (and, for certificates, referenced by the body) is planned twice
 *   on purpose: as its numbered evidence image and as `media/cover.webp`.
 * @property {string} rewrittenBody the markdown body (after the frontmatter)
 *   with relative image references rewritten to `![imgN](<sitePath>/media/NN.webp)`
 *   where N is the 1-based position of the matched file in the FULL sorted
 *   image list (the same sequence the numbered target derives from, so the
 *   rewritten reference never points at a renumbered file). Rewritten forms: `[[name.png]]` / `![[name.png]]`
 *   (Obsidian) and `![alt](name.png)` / `![alt](./name.png)` (relative only —
 *   absolute `/…` and `http(s)://` URLs are NEVER touched, silently or not).
 *   Matching is by file name: exact (case-sensitive) first, then
 *   case-insensitive. A relative reference with no matching file is left
 *   untouched AND pushes a problem; a wikilink without an image extension is
 *   not an image reference and is left alone silently. With no references at
 *   all the body is returned unchanged (never invent insertions).
 * @property {Record<string, unknown>} frontmatter the YAML-ready data object
 *   the CLI writes back: the original keys kept as parsed, `image` added or
 *   refreshed to `<sitePath>/media/cover.webp` ONLY for project/certificate
 *   (and only when the cover was actually planned; writeups keep any existing
 *   `image` untouched), `level`/`group` written when the effective value is
 *   valid (so option-provided values persist into the file). `platform` and
 *   `slug` are NEVER written (derived from the directory/file name).
 * @property {boolean} isDraft whether the frontmatter said `draft: true`.
 *   Reported as a flag only — never a problem — so the CLI decides whether to
 *   ingest; validation still runs for drafts so the plan stays complete.
 */

// Extensiones que convierten una wikilink [[…]] en referencia de imagen.
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

// Referencia "no relativa": URL con esquema (http, https, data, …) o camino
// absoluto /… — jamás se reescriben.
const NON_RELATIVE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;

// Ambas formas de referencia de imagen en una sola pasada determinista:
//   grupo 1/2 → wikilink (!?[[nombre|alias]]), grupo 2 = destino;
//   grupo 3/4 → imagen markdown ![alt](ruta "título"?), grupo 4 = ruta.
const IMAGE_REF_RE =
  /(!?\[\[([^\[\]\n]+)\]\])|(!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\))/g;

/** `1` → '01' (NN de media/NN.webp; a partir de 100 crece solo). */
function nn(sequence) {
  return String(sequence).padStart(2, '0');
}

// Mismo formato "got" de assertValidGroup para los mensajes nuevos.
function shown(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/**
 * Build the complete deterministic ingestion plan from plain inputs.
 *
 * Pure and synchronous: same inputs → same output, inputs untouched. Throws
 * only for two hard input errors, mirroring generate-index.js fail-loud
 * behavior: an unknown `kind`, or YAML frontmatter that does not parse
 * (`Failed to parse <sourceFileName>: …`). Every SEMANTIC problem is
 * collected into `problems` instead — the CLI renders them all.
 *
 * @param {'writeup' | 'project' | 'certificate'} kind content kind
 * @param {string} markdown raw `.md` file content (frontmatter + body)
 * @param {string} sourceFileName original file name, e.g. 'wave.md'
 * @param {string[]} images image file names available in the source folder
 *   (plain names, no directories); certificates pass the single image name
 * @param {ContentIngestionOptions} [options] CLI options (see typedef)
 * @returns {ContentIngestionPlan} the full plan (every field documented above)
 */
export function planContentIngestion(kind, markdown, sourceFileName, images, options = {}) {
  const spec = KINDS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }

  let parsed;
  try {
    parsed = parseFrontmatter(markdown);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${sourceFileName}: ${reason}`);
  }
  const data = parsed.data;
  const body = parsed.content;

  const problems = [];

  // 1. Campos requeridos: missingFields es la única fuente de ese vocabulario
  //    (mensaje verbatim de generate-index.js, sobre el frontmatter FUENTE tal
  //    como lo leería el pipeline — los valores derivados no borran problemas).
  const missing = missingFields(data, kind);
  if (missing.length > 0) {
    problems.push(`Missing required frontmatter field(s) in ${sourceFileName}: ${missing.join(', ')}`);
  }

  // 2. `group` (project/certificate): assertValidGroup verbatim. La opción del
  //    CLI gana sobre el frontmatter.
  const effectiveGroup = options.group !== undefined ? options.group : data.group;
  if (spec.groups !== null) {
    try {
      assertValidGroup(effectiveGroup, /** @type {'project' | 'certificate'} */ (kind), sourceFileName);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  // 3. `tags`: el pipeline usa assertValidTags para writeups (vocabulario
  //    TAGS, opcional) y assertRequiredTags para project/certificate
  //    (vocabulario propio del kind, ≥1) — espejo exacto de generate-index.js.
  try {
    if (kind === 'writeup') {
      assertValidTags(data.tags, sourceFileName);
    } else {
      assertRequiredTags(data.tags, kind, sourceFileName);
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  // 4. `level` (writeup): obligatorio — su cover está estandarizado por
  //    dificultad — y exactamente 'Easy' | 'Medium' | 'Hard'. La opción gana.
  const effectiveLevel = options.level !== undefined ? options.level : data.level;
  let levelValid = false;
  if (kind === 'writeup') {
    const listedLevels = WRITEUP_LEVELS.map((entry) => JSON.stringify(entry)).join(', ');
    if (effectiveLevel === undefined || effectiveLevel === null) {
      problems.push(
        `Missing writeup level in ${sourceFileName}: expected one of ${listedLevels}.`
      );
    } else if (typeof effectiveLevel !== 'string' || !WRITEUP_LEVELS.includes(effectiveLevel)) {
      problems.push(
        `Invalid writeup level in ${sourceFileName}: expected one of ${listedLevels}, got ${shown(effectiveLevel)}.`
      );
    } else {
      levelValid = true;
    }
  }

  // 5. `platform` (writeup): la opción gana; si no, categories[0] en
  //    minúsculas (la convención del repo: public/writeups/hackmyvm). Sin
  //    plataforma derivable hay problema y el plan degrada a la forma plana.
  let platform;
  if (kind === 'writeup') {
    const fromOption = typeof options.platform === 'string' ? options.platform.trim() : '';
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const first = categories[0];
    const fromCategory = typeof first === 'string' ? first.trim() : '';
    const raw = fromOption !== '' ? fromOption : fromCategory;
    if (raw !== '') {
      platform = raw.toLowerCase();
    } else {
      problems.push(
        `Missing writeup platform in ${sourceFileName}: expected the platform option or categories[0] in the frontmatter.`
      );
    }
  }

  // Rutas derivadas (espejo de entryPath de scripts/generate-index.js, que no
  // está exportado: la raíz del kind se reimplmenta aquí con la misma regla
  // 'public/<root>' → '/<root>' y el mismo nivel de plataforma).
  const urlRoot = '/' + spec.root.replace(/^public\//, '');
  const platformSegment = spec.platformed && platform !== undefined ? `/${platform}` : '';
  const slug = sourceFileName.replace(/\.md$/, '').toLowerCase().replace(/ /g, '-');
  const sitePath = `${urlRoot}${platformSegment}/${slug}`;
  const targetDir = `${spec.root}${platformSegment}/${slug}`;
  // El .md vive AL LADO de la carpeta de contenido (misma regla que lee el
  // indexador: <root>/<platform>/<slug>.md y <root>/<slug>.md).
  const markdownPath = `${spec.root}${platformSegment}/${slug}.md`;

  // 6. Cover (project/certificate): obligatoria por decisión aprobada. Para
  //    projects debe venir del folder de imágenes; para certificates se acepta
  //    cualquier nombre (puede estar fuera del folder). Para writeups la
  //    opción `cover` se ignora por completo (no hay cover que planear).
  const cover = typeof options.cover === 'string' ? options.cover.trim() : '';
  let coverPlanned = false;
  if (kind !== 'writeup') {
    if (cover === '') {
      problems.push(
        `Missing ${kind} cover in ${sourceFileName}: expected the cover option naming an image file.`
      );
    } else if (kind === 'project' && !images.includes(cover)) {
      problems.push(
        `Invalid project cover in ${sourceFileName}: ${JSON.stringify(cover)} is not among the source images.`
      );
    } else {
      coverPlanned = true;
    }
  }

  // Fuentes ordenadas ascendente por nombre (Array#sort lexicográfico por
  // unidades UTF-16 — el mismo criterio byte-estable de los barridos de
  // generate-index.js). El número de media/NN.webp sale SIEMPRE de la posición
  // en esta lista completa, incluso para certificates donde algunas fuentes no
  // se planean: así una referencia reescrita jamás apunta a un archivo
  // renumerado.
  const sortedImages = [...images].sort();

  // Reescritura del cuerpo: coincidencia por nombre de archivo, primero exacta
  // (case-sensitive) y luego insensible a mayúsculas. Las referencias sin
  // archivo quedan intactas Y empujan un problema por nombre (dedupe,
  // primera aparición): nunca se pierde evidencia en silencio. Se registran
  // los índices de las fuentes realmente referenciadas: para certificates
  // deciden qué imágenes numeradas entran al plan (ver más abajo).
  const referencedIndexes = new Set();
  const unmatched = [];
  const unmatchedSeen = new Set();
  const rewrittenBody = body.replace(
    IMAGE_REF_RE,
    (match, wikiFull, wikiTarget, mdFull, mdTarget) => {
      let name;
      if (wikiFull !== undefined) {
        name = String(wikiTarget).split('|')[0].trim();
        // Wikilink sin extensión de imagen = enlace normal, no referencia.
        if (!IMAGE_EXT_RE.test(name)) return match;
      } else {
        void mdFull;
        const raw = String(mdTarget);
        if (NON_RELATIVE_RE.test(raw)) return match; // absoluto/URL: jamás se toca
        name = raw.replace(/^(?:\.\/)+/, '');
      }

      let index = sortedImages.indexOf(name);
      if (index < 0) {
        const lower = name.toLowerCase();
        index = sortedImages.findIndex((candidate) => candidate.toLowerCase() === lower);
      }
      if (index < 0) {
        if (!unmatchedSeen.has(name)) {
          unmatchedSeen.add(name);
          unmatched.push(
            `Unmatched image reference in ${sourceFileName}: ${JSON.stringify(name)} has no file in the images list.`
          );
        }
        return match;
      }
      referencedIndexes.add(index);
      return `![img${index + 1}](${sitePath}/media/${nn(index + 1)}.webp)`;
    }
  );
  problems.push(...unmatched);

  // Plan de imágenes: TODAS las fuentes → media/01..NN.webp para writeup/
  // project (decisión documentada: las no referenciadas también van al plan).
  // Para certificate SOLO se planea la imagen numerada si el cuerpo reescrito
  // la referencia: nunca duplicar la misma imagen como media/01.webp además de
  // media/cover.webp cuando nada referencia la copia numerada (ese duplicado
  // era un huérfano). El target numerado conserva su posición en la lista
  // completa. La cover, si está planeada, se añade al final siempre.
  /** @type {ImagePlanEntry[]} */
  const imagePlan = [];
  sortedImages.forEach((source, index) => {
    if (kind === 'certificate' && !referencedIndexes.has(index)) return;
    imagePlan.push({ source, target: `media/${nn(index + 1)}.webp` });
  });
  if (coverPlanned) {
    imagePlan.push({ source: cover, target: 'media/cover.webp' });
  }

  // Frontmatter normalizado a escribir de vuelta: claves originales intactas;
  // `image` solo para project/certificate (y solo si la cover quedó planeada);
  // `level`/`group` cuando el valor efectivo es válido (así los valores dados
  // por opción persisten en el archivo). `platform`/`slug` nunca se escriben.
  /** @type {Record<string, unknown>} */
  const frontmatter = { ...data };
  if (coverPlanned) {
    frontmatter.image = `${sitePath}/media/cover.webp`;
  }
  if (kind === 'writeup' && levelValid) {
    frontmatter.level = effectiveLevel;
  }
  if (spec.groups !== null && typeof effectiveGroup === 'string' && spec.groups.includes(effectiveGroup)) {
    frontmatter.group = effectiveGroup;
  }

  return {
    problems,
    slug,
    sitePath,
    targetDir,
    markdownPath,
    imagePlan,
    rewrittenBody,
    frontmatter,
    isDraft: data.draft === true,
  };
}

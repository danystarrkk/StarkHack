#!/usr/bin/env node
/**
 * Runner CLI de EDICIÓN de contenido ya publicado (edit-content T2) sobre el
 * motor puro de lib/content-edit.js (B1/T1): `describeEditable` inventaría los
 * aspectos editables del documento REAL y `planContentEdit` decide TODO el plan
 * (problemas, rutas finales, renumeración, cuerpo reescrito, operaciones de
 * archivo); este script solo orquesta entradas/salidas y respeta el contrato
 * verbatim de sus problemas.
 *
 * Uso (contrato vinculante):
 *
 *   node scripts/edit-content.js <writeup|project|certificate> <slug> [--platform <p>] [--dry-run]
 *
 * Decisiones que gobiernan este runner:
 *   1. La identidad actual viene del DISCO, nunca del flag: el slug de un
 *      writeup se localiza escaneando public/writeups/<platform>/<slug>.md
 *      (0 o 2+ coincidencias fallan claro). `--platform` es la plataforma
 *      DESTINO al mover (solo writeups); si no hay rename, no hay move.
 *   2. Sin TTY se imprime el inventario y se sale con 1 con un mensaje claro
 *      de "interactive TTY required" — nunca se cuelga (mismo criterio honesto
 *      que scripts/add-content.js).
 *   3. El plan se imprime completo antes de actuar; problemas → exit 1 SIN
 *      tocar nada; --dry-run se detiene tras el plan con exit 0 y sin
 *      escribir nada (byte-idempotente).
 *   4. La confirmación es un prompt explícito y/N: un rename/move es
 *      destructivo y jamás se aplica en silencio.
 *   5. Orden de aplicación: deletes → moves (.md y media/ juntos, luego
 *      renumeraciones) → conversiones (imagePlan, con pre-flight de
 *      ImageMagick ANTES de escribir) → escritura del .md final →
 *      regeneración del índice (fail-loud).
 *   6. Nada que se borra o mueve puede salir de public/; las fuentes de
 *      conversión pueden vivir fuera del repo pero jamás se tocan (solo COPY
 *      vía `magick`).
 *
 * El núcleo testeable vive junto a un main() protegido por el guard de
 * import.meta.url (mismo patrón que scripts/add-content.js): parseArgs,
 * formatInventory y formatPlan — los dos formateadores son puros y
 * deterministas (sin timestamps): dos llamadas con la misma entrada imprimen
 * los mismos bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dump } from 'js-yaml';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { WRITEUP_LEVELS } from '../lib/content-ingest.js';
import { KINDS } from '../lib/content-kinds.js';
import { describeEditable, planContentEdit } from '../lib/content-edit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const INDEX_SCRIPT = path.join(__dirname, 'generate-index.js');

const USAGE = `Usage:
  node scripts/edit-content.js <writeup|project|certificate> <slug> [--platform <p>] [--dry-run]

Notes:
  --platform only for writeup: target platform when MOVING (the current one is located on disk).
  --dry-run prints the full plan and writes nothing (byte-idempotent).
  Interactive TTY required: without a TTY the inventory prints and the run exits 1.`;

/** Error de uso del CLI: siempre se acompaña del texto de USAGE. */
class UsageError extends Error {}

// Flags con valor, por kind. --platform solo aplica a writeups: es la
// plataforma destino al mover (decisión 1), nunca un selector del documento.
const KIND_VALUE_FLAGS = {
  writeup: ['--platform'],
  project: [],
  certificate: [],
};

// Nombre de campo interno por flag.
const FLAG_KEYS = {
  '--platform': 'platform',
};

/**
 * Parse the CLI argv into plain data (the three approved command shapes).
 *
 * Pure and synchronous: only reads `argv`, never the filesystem. Throws
 * {@link UsageError} for every shape problem (unknown kind, missing/empty
 * slug, unknown flag, kind-inapplicable flag, missing flag value, stray
 * positional) with the scripts/add-content.js message style.
 *
 * @param {string[]} argv arguments after the script name, e.g. process.argv.slice(2)
 * @returns {{ kind: string, slug: string, platform?: string, dryRun: boolean }}
 */
export function parseArgs(argv) {
  const [kind, slug, ...rest] = argv;
  if (kind === undefined) throw new UsageError('missing content kind');
  if (!Object.prototype.hasOwnProperty.call(KIND_VALUE_FLAGS, kind)) {
    const listed = Object.keys(KIND_VALUE_FLAGS)
      .map((name) => JSON.stringify(name))
      .join(', ');
    throw new UsageError(`unknown content kind: ${JSON.stringify(kind)} (expected one of ${listed})`);
  }
  if (slug === undefined || slug.trim() === '') throw new UsageError(`missing <slug> for ${kind}`);

  const args = { kind, slug, dryRun: false };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (!token.startsWith('--')) throw new UsageError(`unexpected argument: ${JSON.stringify(token)}`);
    if (!Object.prototype.hasOwnProperty.call(FLAG_KEYS, token)) {
      throw new UsageError(`unknown option: ${token}`);
    }
    if (!KIND_VALUE_FLAGS[kind].includes(token)) {
      throw new UsageError(`option ${token} is not valid for ${kind}`);
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`option ${token} requires a value`);
    }
    args[FLAG_KEYS[token]] = value;
    i += 1;
  }
  return args;
}

/**
 * Serialize a frontmatter data object back to a fenced YAML block.
 *
 * The exact mirror of scripts/add-content.js (the inverse of
 * `parseFrontmatter`, lib/frontmatter.js): js-yaml `dump` with the repo
 * convention of leading `---` fences; key order is preserved.
 *
 * @param {Record<string, unknown>} data frontmatter data
 * @returns {string} `---\n<yaml>---\n`
 */
function buildFrontmatterText(data) {
  const keys = Object.keys(data ?? {});
  if (keys.length === 0) return '---\n\n---\n';
  return `---\n${dump(data)}---\n`;
}

/**
 * Render one identity (current or resulting) for the inventory/plan headers:
 * `kind "slug" @ platform (file)` — the platform level only for writeups.
 *
 * @param {{ kind: string, slug: string, platform?: string, file?: string }} identity
 * @returns {string} the printable identity
 */
function showIdentity(identity) {
  const platform = typeof identity.platform === 'string' && identity.platform !== '' ? ` @ ${identity.platform}` : '';
  const file = typeof identity.file === 'string' && identity.file !== '' ? ` (${identity.file})` : '';
  return `${identity.kind} ${JSON.stringify(identity.slug)}${platform}${file}`;
}

/**
 * Render one current value deterministically: `(none)` for absent values, a
 * bare date for Date values (NEVER a timestamp — output stays byte-stable),
 * `[a, b]` for arrays and the literal text for strings.
 *
 * @param {unknown} value the aspect's current value
 * @returns {string} the printable value
 */
function showValue(value) {
  if (value === undefined || value === null) return '(none)';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return `[${value.map((entry) => showValue(entry)).join(', ')}]`;
  return String(value);
}

/**
 * Render the interactive inventory: who the document is (identity + file) and
 * every editable aspect with its label and current value. Aspects that the CLI
 * may not change are marked `(read-only)` and directory-derived ones
 * `(derived)` so the listing never promises an edit that cannot happen.
 *
 * Deterministic on purpose (byte-idempotent output): no timestamps, no
 * randomness — the same inventory renders the same bytes every time.
 *
 * @param {import('../lib/content-edit.js').EditableAspect[]} inventory the
 *   aspects returned by describeEditable
 * @param {{ kind: string, slug: string, platform?: string, file?: string }} current
 *   the current identity of the document being edited
 * @returns {string} the printable inventory
 */
export function formatInventory(inventory, current) {
  const lines = [];
  lines.push('=== edit-content inventory ===');
  lines.push(`content: ${showIdentity(current)}`);
  lines.push('');
  lines.push('editable aspects:');
  if (inventory.length === 0) lines.push('  (none)');
  inventory.forEach((aspect, index) => {
    const markers = [];
    if (aspect.editable === false) markers.push('read-only');
    if (aspect.derived === true) markers.push('derived');
    const suffix = markers.length > 0 ? `   (${markers.join(', ')})` : '';
    lines.push(`  ${index + 1}. ${aspect.label} = ${showValue(aspect.current)}${suffix}`);
  });
  return lines.join('\n') + '\n';
}

/**
 * Render the full edit plan: identity before/after (the rename is the
 * dangerous part, always visible), the file operations in apply order
 * (deletes, then moves, then the markdown write), the image mapping table
 * (planned source -> final target, cover flagged `(cover)` like add-content),
 * the resulting frontmatter and every problem VERBATIM.
 *
 * Deterministic on purpose (byte-idempotent dry-run): no timestamps, no
 * randomness — the same plan renders the same bytes every time.
 *
 * @param {import('../lib/content-edit.js').ContentEditPlan} plan the plan
 *   returned by planContentEdit
 * @param {{ kind: string, slug: string, platform?: string }} identity the
 *   CURRENT identity (before); the resulting one derives from the plan's
 *   final paths
 * @returns {string} the printable plan
 */
export function formatPlan(plan, identity) {
  const previousFile = plan.previous.markdownPath;
  const afterFile = plan.markdownPath;
  const afterSlug = afterFile.slice(afterFile.lastIndexOf('/') + 1).replace(/\.md$/, '');
  // Solo los writeups viven un nivel de plataforma: public/writeups/<p>/<slug>
  const afterPlatform =
    identity.kind === 'writeup' ? plan.targetDir.split('/').slice(2, 3)[0] : undefined;

  const lines = [];
  lines.push('=== edit-content plan ===');
  lines.push(`identity before: ${showIdentity({ ...identity, file: previousFile })}`);
  lines.push(`identity after:  ${showIdentity({ kind: identity.kind, slug: afterSlug, platform: afterPlatform, file: afterFile })}`);
  lines.push('');
  lines.push('file operations:');
  const opLines = [
    ...plan.fileOps.delete.map((entry) => `  delete ${entry}`),
    ...plan.fileOps.move.map((entry) => `  move   ${entry.from} -> ${entry.to}`),
    ...plan.fileOps.write.map((entry) => `  write  ${entry}`),
  ];
  if (opLines.length === 0) opLines.push('  (none)');
  lines.push(...opLines);
  lines.push('');
  lines.push('image mapping:');
  if (plan.imagePlan.length === 0) {
    lines.push('  (no images)');
  }
  for (const entry of plan.imagePlan) {
    const coverMark = entry.target === 'media/cover.webp'
      ? '   (cover)'
      : entry.target === 'media/hires.webp'
        ? '   (hires)'
        : '';
    lines.push(`  ${entry.source} -> ${plan.targetDir}/${entry.target}${coverMark}`);
  }
  lines.push('');
  lines.push('frontmatter to write:');
  lines.push(buildFrontmatterText(plan.frontmatter).trimEnd());
  lines.push('');
  if (plan.problems.length === 0) {
    lines.push('problems: none');
  } else {
    lines.push(`problems (${plan.problems.length}):`);
    for (const problem of plan.problems) lines.push(`  ${problem}`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Entradas de archivos (lo único que este runner "sabe" leer)
// ---------------------------------------------------------------------------

/**
 * Resolve a planned image `source` name to a real file. A path-ish name
 * (absolute or with a separator) is resolved as given from the cwd — the
 * escape hatch for sources living anywhere on disk; a plain name lives in the
 * current directory. Espejo de scripts/add-content.js.
 */
function resolveSourceFile(name, baseDir) {
  if (path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
    return path.resolve(name);
  }
  return path.join(baseDir, name);
}

/**
 * Safety guard: every path this runner DELETES or MOVES must live inside
 * public/ (the repo content roots). Image conversion SOURCES may live outside
 * the repo — they are only read by `magick`, never touched.
 *
 * @param {string} repoRelative repository-relative path from the plan
 * @returns {string} the resolved absolute path
 */
function assertInsidePublic(repoRelative) {
  const resolved = path.resolve(REPO_ROOT, repoRelative);
  const publicRoot = path.join(REPO_ROOT, 'public');
  if (resolved !== publicRoot && !resolved.startsWith(publicRoot + path.sep)) {
    throw new Error(`refusing to touch a path outside public/: ${repoRelative}`);
  }
  return resolved;
}

/**
 * Map one image-plan `convert` hint to the extra magick argv (pure,
 * deterministic documented order, certificate-hires B4): `-resize <width>x`
 * first (when `width` present), then `-quality <q>` (when `quality` present),
 * always BEFORE the target path. No hint ⇒ NO extra args — the
 * byte-identical invocation projects/writeups have always used. Espejo de
 * scripts/add-content.js magickArgs.
 *
 * @param {{ width?: number, quality?: number } | undefined} convert the entry's convert hint
 * @returns {string[]} the extra magick args, in the documented order
 */
export function magickArgs(convert) {
  const args = [];
  if (convert !== undefined && convert !== null) {
    if (typeof convert.width === 'number') args.push('-resize', `${convert.width}x`);
    if (typeof convert.quality === 'number') args.push('-quality', String(convert.quality));
  }
  return args;
}

/**
 * Run the planned image conversions through `magick` (COPY, never move),
 * honoring each entry's `convert` hint via magickArgs. Stops at the first
 * failure (fail-loud) and returns its verbatim message; returns null when
 * every entry converted. Espejo de scripts/add-content.js convertImagePlan.
 *
 * @param {object} plan the plan returned by planContentEdit
 * @param {Function} [run] spawnSync-compatible runner (test seam; defaults to spawnSync)
 * @returns {string | null} the first failure message, or null on success
 */
export function convertImagePlan(plan, run = spawnSync) {
  for (const entry of plan.imagePlan) {
    const sourceAbs = resolveSourceFile(entry.source, process.cwd());
    const targetAbs = assertInsidePublic(`${plan.targetDir}/${entry.target}`);
    const result = run('magick', [sourceAbs, ...magickArgs(entry.convert), targetAbs], { encoding: 'utf8' });
    if (result.error !== undefined || result.status !== 0) {
      const reason = result.error !== undefined ? result.error.message : result.stderr.trim();
      return `failed to convert ${entry.source} -> ${plan.targetDir}/${entry.target}: ${reason}`;
    }
    console.log(`converted ${entry.source} -> ${plan.targetDir}/${entry.target}`);
  }
  return null;
}

// Escaneo de referencias de imagen del cuerpo, misma familia que
// tests/media.test.ts: ![alt](ruta).
const BODY_IMAGE_REF_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

/** List the file names inside a media/ folder (sorted for stability). */
function listMedia(mediaDirAbs) {
  if (!fs.existsSync(mediaDirAbs) || !fs.statSync(mediaDirAbs).isDirectory()) return [];
  return fs
    .readdirSync(mediaDirAbs)
    .filter((entry) => fs.statSync(path.join(mediaDirAbs, entry)).isFile())
    .sort();
}

// ---------------------------------------------------------------------------
// Modo interactivo: menú de aspectos y prompts por tipo de campo
// ---------------------------------------------------------------------------

// Tope de reintentos por prompt: un stdin roto no puede dejar al CLI en bucle
// infinito (también protege contra EOF en un pseudo-TTY).
const MAX_ATTEMPTS = 5;

async function askText(rl, label) {
  return (await rl.question(label)).trim();
}

async function askChoice(rl, field, choices) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const answer = (await rl.question(`${field} (${choices.join(' | ')}): `)).trim();
    if (choices.includes(answer)) return answer;
    console.log(`  ${field} must be exactly one of: ${choices.join(', ')}`);
  }
  throw new Error(`no valid ${field} after ${MAX_ATTEMPTS} attempts`);
}

async function askInteger(rl, field) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const answer = (await rl.question(`${field}: `)).trim();
    const value = Number(answer);
    if (answer !== '' && Number.isInteger(value)) return value;
    console.log(`  ${field} must be an integer`);
  }
  throw new Error(`no valid ${field} after ${MAX_ATTEMPTS} attempts`);
}

/** Ask for a menu pick in 0..max (0 = finish/cancel), with retries. */
async function askPick(rl, label, max) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const answer = (await rl.question(`${label} (0-${max}): `)).trim();
    const value = Number(answer);
    if (answer !== '' && Number.isInteger(value) && value >= 0 && value <= max) return value;
    console.log(`  ${label} must be an integer between 0 and ${max}`);
  }
  throw new Error(`no valid ${label} after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Prompt one aspect and record the requested edit into `changes` (the
 * declarative object planContentEdit consumes). Closed vocabularies go through
 * a choice prompt; `tags` is comma-separated (the PLANNER validates the
 * vocabulary); `order` is an integer; cover/evidence sources are file paths
 * resolved like add-content's resolveSourceFile; the rename asks for the new
 * slug (and the new platform for writeups) and the planner normalizes both.
 */
async function promptAspect(rl, aspect, args, changes) {
  switch (aspect.field) {
    case 'title':
    case 'description':
    case 'date': {
      const value = await askText(rl, `${aspect.label}: `);
      changes.fields[aspect.field] = value;
      break;
    }
    case 'draft': {
      changes.fields.draft = (await askChoice(rl, 'draft', ['true', 'false'])) === 'true';
      break;
    }
    case 'tags': {
      const answer = await askText(rl, 'tags (comma-separated): ');
      changes.fields.tags = answer.split(',').map((tag) => tag.trim()).filter((tag) => tag !== '');
      break;
    }
    case 'level': {
      changes.fields.level = await askChoice(rl, 'level', [...WRITEUP_LEVELS]);
      break;
    }
    case 'group': {
      changes.fields.group = await askChoice(rl, 'group', [...KINDS[args.kind].groups]);
      break;
    }
    case 'order': {
      changes.fields.order = await askInteger(rl, 'order');
      break;
    }
    case 'platform': {
      // Identidad derivada del directorio: cambiarla ES mover de plataforma.
      changes.rename.platform = await askText(rl, 'target platform: ');
      break;
    }
    case 'cover': {
      const name = await askText(rl, 'cover image (file path): ');
      if (name !== '') changes.cover = { source: name };
      break;
    }
    case 'evidence': {
      const action = await askChoice(rl, 'evidence action', ['add', 'remove']);
      if (action === 'add') {
        const name = await askText(rl, 'evidence image (file path): ');
        if (name !== '') changes.images.add.push(name);
      } else {
        const current = Array.isArray(aspect.current) ? aspect.current : [];
        if (current.length === 0) {
          console.log('  no numbered evidence files to remove');
          break;
        }
        current.forEach((name, index) => console.log(`  ${index + 1}. ${name}`));
        const pick = await askPick(rl, 'remove which one', current.length);
        if (pick > 0) changes.images.remove.push(current[pick - 1]);
      }
      break;
    }
    case 'rename': {
      const newSlug = await askText(rl, 'new slug: ');
      if (newSlug !== '') changes.rename.slug = newSlug;
      if (args.kind === 'writeup') {
        const newPlatform = await askText(rl, 'new platform: ');
        if (newPlatform !== '') changes.rename.platform = newPlatform;
      }
      break;
    }
    default: {
      console.log(`  (info) aspect ${aspect.field} has no prompt — ignored`);
    }
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run the CLI. Returns the process exit code; never throws for expected
 * failures (they print one clear message and map to exit 1).
 *
 * @param {string[]} [argv] arguments after the script name
 * @returns {Promise<number>} exit code
 */
export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(USAGE);
    return 1;
  }
  const spec = KINDS[args.kind];

  // --- 1. localizar y cargar el documento actual ---------------------------
  // La identidad viene del DISCO (decisión 1): el platform de un writeup es el
  // directorio donde vive su .md, nunca el flag (--platform es el DESTINO al
  // mover). 0 o 2+ coincidencias fallan claro: no se adivina el documento.
  let markdownPath;
  let platform;
  if (spec.platformed) {
    const rootAbs = path.join(REPO_ROOT, spec.root);
    const matches = fs.existsSync(rootAbs)
      ? fs
          .readdirSync(rootAbs, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => fs.existsSync(path.join(rootAbs, name, `${args.slug}.md`)))
          .sort()
      : [];
    if (matches.length === 0) {
      console.error(`${args.kind} not found: ${args.slug} (no ${spec.root}/*/${args.slug}.md)`);
      return 1;
    }
    if (matches.length > 1) {
      console.error(
        `${args.kind} ${JSON.stringify(args.slug)} exists in ${matches.length} platforms: ${matches.join(', ')} — remove the duplicates before editing.`,
      );
      return 1;
    }
    platform = matches[0];
    markdownPath = `${spec.root}/${platform}/${args.slug}.md`;
  } else {
    markdownPath = `${spec.root}/${args.slug}.md`;
    const abs = path.join(REPO_ROOT, markdownPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      console.error(`${args.kind} not found: ${args.slug} (no ${markdownPath})`);
      return 1;
    }
  }
  const markdown = fs.readFileSync(path.join(REPO_ROOT, markdownPath), 'utf8');

  let parsed;
  try {
    parsed = parseFrontmatter(markdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  // --- 2. media/ + referencias del cuerpo ---------------------------------
  const mediaDirAbs = path.join(REPO_ROOT, markdownPath.replace(/\.md$/, ''), 'media');
  const media = listMedia(mediaDirAbs);
  const bodyHasImages = [...parsed.content.matchAll(BODY_IMAGE_REF_RE)].length > 0;

  // --- 3. hermanos para el order de certificados --------------------------
  let siblings = {};
  if (args.kind === 'certificate') {
    const certRootAbs = path.join(REPO_ROOT, spec.root);
    const certificateOrders = [];
    if (fs.existsSync(certRootAbs)) {
      const files = fs
        .readdirSync(certRootAbs, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name)
        .sort();
      for (const name of files) {
        const slug = name.replace(/\.md$/, '');
        try {
          const data = parseFrontmatter(fs.readFileSync(path.join(certRootAbs, name), 'utf8')).data;
          certificateOrders.push({ order: data.order, slug });
        } catch (error) {
          // Sin frontmatter legible no hay order verificable: se registra sin
          // order y se avisa (el documento roto no se calla en silencio).
          const reason = error instanceof Error ? error.message : String(error);
          console.error(`(warning) cannot read the order of ${spec.root}/${name}: ${reason}`);
          certificateOrders.push({ order: undefined, slug });
        }
      }
    }
    siblings = { certificateOrders };
  }

  // --- 4. inventario ------------------------------------------------------
  const identity = { kind: args.kind, slug: args.slug, platform, file: markdownPath };
  const inventory = describeEditable(args.kind, {
    frontmatter: parsed.data,
    media,
    bodyHasImages,
    slug: args.slug,
    platform,
  });
  process.stdout.write(formatInventory(inventory, identity));

  // --- 5. sin TTY: inventario + error claro, nunca un bucle esperando -------
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('interactive TTY required — this editor asks questions; run it in a terminal.');
    return 1;
  }

  // --- 6. menú TTY: recoger los cambios ------------------------------------
  const changes = { fields: {}, images: { add: [], remove: [] }, rename: {} };
  if (args.platform !== undefined) changes.rename.platform = args.platform;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    // Solo aspectos editables: los read-only (cover de writeup) se listan en
    // el inventario pero no son editables.
    const editable = inventory.filter((aspect) => aspect.editable !== false);
    for (;;) {
      console.log('');
      console.log('editable aspects:');
      editable.forEach((aspect, index) => console.log(`  ${index + 1}. ${aspect.label}`));
      console.log('  0. Finish and print the plan');
      const pick = await askPick(rl, 'choice', editable.length);
      if (pick === 0) break;
      await promptAspect(rl, editable[pick - 1], args, changes);
    }
  } finally {
    rl.close();
  }

  // --- 7-8. plan completo (formatPlan) + problemas ------------------------

  /** Arma el `changes` declarativo SOLO con lo pedido (vacío = no-op). */
  function buildChanges() {
    const out = {};
    if (Object.keys(changes.fields).length > 0) out.fields = changes.fields;
    if (changes.cover !== undefined) out.cover = changes.cover;
    if (changes.images.add.length > 0 || changes.images.remove.length > 0) {
      out.images = { add: [...changes.images.add], remove: [...changes.images.remove] };
    }
    if (Object.keys(changes.rename).length > 0) out.rename = { ...changes.rename };
    return out;
  }

  // Fuentes de imagen: se resuelven como add-content (absolutas/rutas desde el
  // cwd, nombres simples desde el directorio actual) y deben existir antes de
  // planear — el plan es puro y no ve el disco.
  const imageSources = [];
  if (changes.cover !== undefined) imageSources.push(changes.cover.source);
  imageSources.push(...changes.images.add);
  for (const source of imageSources) {
    const resolved = resolveSourceFile(source, process.cwd());
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      console.error(`image source not found: ${source}`);
      return 1;
    }
  }

  let plan;
  try {
    plan = planContentEdit({
      kind: args.kind,
      slug: args.slug,
      platform,
      markdown,
      media,
      changes: buildChanges(),
      siblings,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  process.stdout.write(formatPlan(plan, identity));

  if (plan.problems.length > 0) {
    console.error(`cannot edit ${markdownPath}:`);
    for (const problem of plan.problems) console.error(problem);
    return 1;
  }

  if (args.dryRun) {
    console.log('');
    console.log('Dry run: nothing written, index not regenerated.');
    return 0;
  }

  // --- 10. confirmación explícita + aplicación ---------------------------
  const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
  let confirmed;
  try {
    confirmed = await askText(confirmRl, 'apply this plan? [y/N]: ');
  } finally {
    confirmRl.close();
  }
  if (!/^y(es)?$/i.test(confirmed)) {
    console.log('aborted — nothing written.');
    return 0;
  }

  // Pre-flight de ImageMagick ANTES de escribir nada, solo si hay conversiones
  // prometidas: sin `magick` no se puede cumplir el plan (fail-loud).
  if (plan.imagePlan.length > 0) {
    const probe = spawnSync('magick', ['-version'], { encoding: 'utf8' });
    if (probe.error !== undefined || probe.status !== 0) {
      console.error(
        "ImageMagick (`magick`) is not available on PATH — install ImageMagick 7 to convert images (https://imagemagick.org). Nothing was written.",
      );
      return 1;
    }
  }

  // Simulación de movimientos ANTES de tocar el disco: rutas dentro de
  // public/ (decisión 6) y ningún destino ya ocupado (falla con mensaje
  // claro). Los deletes vacían primero y los moves se encadenan, igual que en
  // la aplicación real (una renumeración puede apoyarse en un hueco previo).
  try {
    for (const entry of [
      ...plan.fileOps.delete,
      ...plan.fileOps.move.flatMap((entry) => [entry.from, entry.to]),
    ]) {
      assertInsidePublic(entry);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const gone = new Set(plan.fileOps.delete);
  const consumed = new Set();
  const produced = new Set();
  for (const { from, to } of plan.fileOps.move) {
    const destBlocked =
      produced.has(to) ||
      (!consumed.has(to) && !gone.has(to) && fs.existsSync(path.resolve(REPO_ROOT, to)));
    if (destBlocked) {
      console.error(`destination already exists: ${to} — nothing was written.`);
      return 1;
    }
    consumed.add(from);
    produced.add(to);
  }

  // Orden de aplicación (decisión 5): deletes → moves → conversiones → write.
  for (const entry of plan.fileOps.delete) {
    const abs = assertInsidePublic(entry);
    if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    console.log(`deleted ${entry}`);
  }

  for (const { from, to } of plan.fileOps.move) {
    const fromAbs = path.resolve(REPO_ROOT, from);
    const toAbs = assertInsidePublic(to);
    if (!fs.existsSync(fromAbs)) {
      // Un media/ inexistente no impide un rename (decisión 5): nada que mover.
      console.log(`(info) skip move, source missing: ${from}`);
      continue;
    }
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    fs.renameSync(fromAbs, toAbs);
    console.log(`moved ${from} -> ${to}`);
  }

  if (plan.imagePlan.length > 0) {
    fs.mkdirSync(path.join(REPO_ROOT, plan.targetDir, 'media'), { recursive: true });
    const convertFailure = convertImagePlan(plan);
    if (convertFailure !== null) {
      console.error(convertFailure);
      return 1;
    }
  }

  for (const entry of plan.fileOps.write) {
    const abs = assertInsidePublic(entry);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buildFrontmatterText(plan.frontmatter) + plan.rewrittenBody);
    console.log(`wrote ${entry}`);
  }

  // Regeneración del índice (fail-loud): generate-index.js se invoca tal cual
  // para que public/index.json refleje el resultado de la edición.
  const indexRun = spawnSync(process.execPath, [INDEX_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (indexRun.status !== 0) {
    console.error((indexRun.stderr || '').trim() || `index generation failed (exit ${indexRun.status})`);
    return 1;
  }
  if (indexRun.stdout.trim() !== '') console.log(indexRun.stdout.trim());

  const opCount = plan.fileOps.delete.length + plan.fileOps.move.length + plan.fileOps.write.length;
  console.log(
    `[+] edited ${args.kind} ${JSON.stringify(args.slug)} -> ${plan.sitePath} (${opCount} file ops, ${plan.imagePlan.length} images converted)`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

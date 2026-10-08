#!/usr/bin/env node
/**
 * Runner CLI de ingesta de contenido (T2) sobre el motor puro de
 * lib/content-ingest.js (T1): `planContentIngestion` decide TODO el plan
 * (problemas, rutas, orden de imágenes, cuerpo reescrito, frontmatter
 * normalizado); este script solo orquesta entradas/salidas y respeta el
 * contrato verbatim de sus problemas.
 *
 * Uso (aprobado en odd/tasks/content-ingestion.md):
 *
 *   node scripts/add-content.js writeup     <archivo.md> --images <dir> [--platform <p>] [--level <Easy|Medium|Hard>] [--dry-run]
 *   node scripts/add-content.js project     <archivo.md> --images <dir> [--cover <archivo>] [--group <g>] [--dry-run]
 *   node scripts/add-content.js certificate <archivo.md> --image <archivo> [--cover <archivo>] [--dry-run]
 *
 * Decisiones humanas que gobiernan este runner:
 *   1. Faltantes de frontmatter → modo interactivo (TTY): se pregunta campo por
 *      campo con node:readline/promises; sin TTY se imprimen TODOS los problemas
 *      del plan (verbatim) y se sale con 1 — nunca se cuelga.
 *   2. Imágenes sin referenciar en el .md → solo van al plan de medios; el
 *      cuerpo no recibe inserciones (eso ya lo decide el motor).
 *   3. Cover: writeups NO llevan cover (deriva de `level`); projects y
 *      certificates la piden por nombre (--cover) y si falta se INTERROGA
 *      (para certificates el default del prompt es el --image, porque
 *      normalmente esa imagen ES la cover — pero igual se confirma).
 *   4. certificates → imagen directa (--image); writeups/projects → carpeta
 *      (--images) cuyos archivos se copian convertidos, jamás se mueven.
 *
 * Idempotencia y honestidad (al estilo scripts/migrate-images.js): el plan se
 * imprime completo antes de actuar, --dry-run no toca el disco y es
 * byte-idempotente, los problemas fallan con exit 1 sin escribir nada, y un
 * .md ya colocado en su destino se reescribe en lugar (re-ejecución limpia).
 *
 * El núcleo testeable vive junto a un main() protegido por el guard de
 * import.meta.url (mismo patrón que scripts/generate-index.js exporta
 * generateIndex/runCli): parseArgs, formatPlan y buildFrontmatterText.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dump } from 'js-yaml';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { WRITEUP_LEVELS, planContentIngestion } from '../lib/content-ingest.js';
import { KINDS, missingFields } from '../lib/content-kinds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const INDEX_SCRIPT = path.join(__dirname, 'generate-index.js');

// Extensiones que el runner acepta como imagen de origen (mismo vocabulario que
// lib/content-ingest.js trata como referencias de imagen). Un .md u otro archivo
// suelto en la carpeta de imágenes se ignora con aviso, jamás se convierte.
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

const USAGE = `Usage:
  node scripts/add-content.js writeup     <archivo.md> --images <dir> [--platform <p>] [--level <Easy|Medium|Hard>] [--dry-run]
  node scripts/add-content.js project     <archivo.md> --images <dir> [--cover <archivo>] [--group <g>] [--dry-run]
  node scripts/add-content.js certificate <archivo.md> --image <archivo> [--cover <archivo>] [--dry-run]

Notes:
  --cover omitted for project/certificate  -> interactive prompt (TTY), else plan problem (exit 1).
  --dry-run prints the full plan and writes nothing (byte-idempotent).`;

/** Error de uso del CLI: siempre se acompaña del texto de USAGE. */
class UsageError extends Error {}

// Flags con valor por comando. --cover es AUSENCIA tolerable en
// project/certificate a propósito (decisión humana 3: se pregunta); --images y
// --image son obligatorios porque sin ellos no hay fuente que planear.
const COMMANDS = {
  writeup: {
    valueFlags: ['--images', '--platform', '--level'],
    requiredFlags: { '--images': 'dir' },
  },
  project: {
    valueFlags: ['--images', '--cover', '--group'],
    requiredFlags: { '--images': 'dir' },
  },
  certificate: {
    valueFlags: ['--image', '--cover'],
    requiredFlags: { '--image': 'archivo' },
  },
};

// Nombre de campo interno por flag.
const FLAG_KEYS = {
  '--images': 'images',
  '--image': 'image',
  '--cover': 'cover',
  '--platform': 'platform',
  '--level': 'level',
  '--group': 'group',
};

/**
 * Parse the CLI argv into plain data (the three approved command shapes).
 *
 * Pure and synchronous: only reads `argv`, never the filesystem. Throws
 * {@link UsageError} for every shape problem (unknown kind, missing source
 * argument, unknown/kind-inapplicable flag, missing flag value, missing
 * required flag, stray positional). An omitted `--cover` for project/
 * certificate is intentionally NOT an error: human decision 3 routes it to the
 * interactive prompt (TTY) or to the plan's own "Missing <kind> cover …"
 * problem (non-TTY).
 *
 * @param {string[]} argv arguments after the script name, e.g. process.argv.slice(2)
 * @returns {{ kind: string, sourcePath: string, images?: string, image?: string,
 *   cover?: string, platform?: string, level?: string, group?: string, dryRun: boolean }}
 */
export function parseArgs(argv) {
  const [kind, sourcePath, ...rest] = argv;
  if (kind === undefined) throw new UsageError('missing content kind');
  const command = COMMANDS[kind];
  if (!command) {
    const listed = Object.keys(COMMANDS).map((name) => JSON.stringify(name)).join(', ');
    throw new UsageError(`unknown content kind: ${JSON.stringify(kind)} (expected one of ${listed})`);
  }
  if (sourcePath === undefined) throw new UsageError(`missing <archivo.md> for ${kind}`);

  const args = { kind, sourcePath, dryRun: false };
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
    if (!command.valueFlags.includes(token)) {
      throw new UsageError(`option ${token} is not valid for ${kind}`);
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`option ${token} requires a value`);
    }
    args[FLAG_KEYS[token]] = value;
    i += 1;
  }

  for (const [flag, metavar] of Object.entries(command.requiredFlags)) {
    const value = args[FLAG_KEYS[flag]];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new UsageError(`${kind} requires ${flag} <${metavar}>`);
    }
  }
  return args;
}

/**
 * Serialize a frontmatter data object back to a fenced YAML block.
 *
 * The exact inverse of `parseFrontmatter` (lib/frontmatter.js): round-trips to
 * the same data object. js-yaml `dump` with the repo convention of leading
 * `---` fences; key order is preserved (source order, then derived keys).
 *
 * @param {Record<string, unknown>} data frontmatter data
 * @returns {string} `---\n<yaml>---\n`
 */
export function buildFrontmatterText(data) {
  const keys = Object.keys(data ?? {});
  if (keys.length === 0) return '---\n\n---\n';
  return `---\n${dump(data)}---\n`;
}

/**
 * Render the full dry-run plan: source path, derived paths, files to create,
 * the image mapping table (source → planned target, cover flagged), the
 * resulting frontmatter and every problem VERBATIM.
 *
 * Deterministic on purpose (byte-idempotent dry-run): no timestamps, no
 * randomness — the same plan renders the same bytes every time.
 *
 * @param {object} plan the plan returned by planContentIngestion
 * @param {string} sourcePath the source `.md` path as the user gave it
 * @returns {string} the printable plan
 */
export function formatPlan(plan, sourcePath) {
  const destName = `${plan.slug}.md`;
  const destPath = path.resolve(REPO_ROOT, plan.targetDir, destName);
  const inPlace = path.resolve(sourcePath) === destPath;

  const lines = [];
  lines.push('=== add-content plan ===');
  lines.push(`source:     ${sourcePath}`);
  lines.push(`site path:  ${plan.sitePath}`);
  lines.push(`target dir: ${plan.targetDir}`);
  lines.push('');
  lines.push('files to create:');
  lines.push(`  ${plan.targetDir}/${destName}${inPlace ? '   (rewrite in place)' : ''}`);
  for (const entry of plan.imagePlan) {
    lines.push(`  ${plan.targetDir}/${entry.target}`);
  }
  lines.push('');
  lines.push('image mapping:');
  if (plan.imagePlan.length === 0) {
    lines.push('  (no images)');
  }
  for (const entry of plan.imagePlan) {
    const coverMark = entry.target === 'media/cover.webp' ? '   (cover)' : '';
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
 * Resolve a planned `source` name to a real file. A plain name lives in the
 * source folder (`baseDir`); a path-ish name (absolute or with a separator) is
 * resolved as given from the cwd — the escape hatch for a certificate cover
 * living outside the folder (T1 plans it "as given").
 */
function resolveSourceFile(name, baseDir) {
  if (path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
    return path.resolve(name);
  }
  return path.join(baseDir, name);
}

/** List the image files of a source folder (plain names, sorted for stability). */
function listImages(imagesDir, shownDir) {
  const all = fs.readdirSync(imagesDir).filter((entry) => fs.statSync(path.join(imagesDir, entry)).isFile()).sort();
  const skipped = all.filter((name) => !IMAGE_EXT_RE.test(name));
  if (skipped.length > 0) {
    console.log(`ignoring non-image files in ${shownDir}: ${skipped.join(', ')}`);
  }
  return all.filter((name) => IMAGE_EXT_RE.test(name));
}

// ---------------------------------------------------------------------------
// Modo interactivo (decisión humana 1): completar faltantes campo por campo
// ---------------------------------------------------------------------------

// Tope de reintentos por campo con vocabulario cerrado: un stdin roto no puede
// dejar al CLI en bucle infinito (también protege contra EOF en un pseudo-TTY).
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

  const sourcePath = path.resolve(args.sourcePath);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    console.error(`source file not found: ${args.sourcePath}`);
    return 1;
  }
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const sourceFileName = path.basename(sourcePath);

  // Fuentes de imagen: --images (carpeta) para writeup/project, --image
  // (archivo directo) para certificate. Los originales NUNCA se mueven.
  let images;
  let imagesDir;
  if (args.kind === 'certificate') {
    const imagePath = path.resolve(args.image);
    if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
      console.error(`image file not found: ${args.image}`);
      return 1;
    }
    imagesDir = path.dirname(imagePath);
    images = [path.basename(imagePath)];
  } else {
    imagesDir = path.resolve(args.images);
    if (!fs.existsSync(imagesDir) || !fs.statSync(imagesDir).isDirectory()) {
      console.error(`images folder not found: ${args.images}`);
      return 1;
    }
    images = listImages(imagesDir, args.images);
  }

  const parsed = parseFrontmatter(markdown);
  const body = parsed.content;
  let data = parsed.data;

  const options = {};
  if (args.platform !== undefined) options.platform = args.platform;
  if (args.level !== undefined) options.level = args.level;
  if (args.cover !== undefined) options.cover = args.cover;
  if (args.group !== undefined) options.group = args.group;

  // El plan se reconstruye desde los datos YA completados (js-yaml round-trip
  // exacto vía buildFrontmatterText): el motor de T1 sigue siendo la única
  // fuente de problemas, rutas y normalización.
  let plan;
  const rebuild = (text) => {
    try {
      plan = planContentIngestion(args.kind, text, sourceFileName, images, options);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  };
  rebuild(markdown);

  // Drafts: se rechazan de inmediato con el mensaje aprobado — nada que
  // completar ni convertir para un contenido que no se va a ingerir.
  if (plan.isDraft) {
    console.error(`draft: true — not ingesting ${args.sourcePath}`);
    return 1;
  }

  // Completado interactivo (solo TTY). La cover va primero porque de ella se
  // deriva la clave `image` que exige el frontmatter de project/certificate.
  if (process.stdout.isTTY && args.kind !== 'writeup' && !('cover' in options)) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const defaultCover = args.kind === 'certificate' ? path.basename(args.image) : undefined;
      if (images.length > 0 && images.length <= 30) {
        console.log(`available images: ${images.join(', ')}`);
      }
      const answer = await askText(rl, defaultCover ? `cover [${defaultCover}]: ` : 'cover (image file name): ');
      const cover = answer !== '' ? answer : defaultCover;
      if (cover !== undefined) options.cover = cover;
    } finally {
      rl.close();
    }
    rebuild(buildFrontmatterText(data) + body);
  }

  // `image` (project/certificate) es derivado, no una elección humana: el plan
  // ya refresca esa clave a <sitePath>/media/cover.webp cuando la cover está
  // planeada, así que el runner completa el faltante con EL valor que se va a
  // escribir (pedirlo sería teatro: el motor lo sobrescribe igual). Sin cover
  // planeada no hay derivación y el problema del plan sigue en pie.
  if (
    args.kind !== 'writeup' &&
    missingFields(data, args.kind).includes('image') &&
    typeof plan.frontmatter.image === 'string'
  ) {
    data = { ...data, image: plan.frontmatter.image };
    console.log(`(info) image -> ${plan.frontmatter.image} (derived from the cover)`);
    rebuild(buildFrontmatterText(data) + body);
  }

  // Resto de faltantes, campo por campo (decisión humana 1). Solo FALTANTES:
  // un valor presente pero inválido es trabajo del motor reportarlo verbatim.
  if (process.stdout.isTTY) {
    const gaps = [];
    for (const field of missingFields(data, args.kind)) {
      if (field !== 'image') gaps.push(field); // title | date | order | description
    }
    if (args.kind !== 'writeup') {
      const group = options.group !== undefined ? options.group : data.group;
      if (typeof group !== 'string' || group.trim() === '') gaps.push('group');
      if (!Array.isArray(data.tags) || data.tags.length === 0) gaps.push('tags');
    } else {
      const level = options.level !== undefined ? options.level : data.level;
      if (level === undefined || level === null || level === '') gaps.push('level');
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const hasPlatform =
        (typeof options.platform === 'string' && options.platform.trim() !== '') ||
        (typeof categories[0] === 'string' && categories[0].trim() !== '');
      if (!hasPlatform) gaps.push('platform');
    }

    if (gaps.length > 0) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        for (const field of gaps) {
          if (field === 'group') {
            options.group = await askChoice(rl, 'group', [...KINDS[args.kind].groups]);
          } else if (field === 'level') {
            options.level = await askChoice(rl, 'level', [...WRITEUP_LEVELS]);
          } else if (field === 'tags') {
            const answer = await askText(rl, 'tags (comma-separated): ');
            data = { ...data, tags: answer.split(',').map((tag) => tag.trim()).filter((tag) => tag !== '') };
          } else if (field === 'order') {
            data = { ...data, order: await askInteger(rl, 'order') };
          } else if (field === 'platform') {
            options.platform = await askText(rl, 'platform: ');
          } else {
            data = { ...data, [field]: await askText(rl, `${field}: `) };
          }
        }
      } finally {
        rl.close();
      }
      rebuild(buildFrontmatterText(data) + body);
    }
  }

  // Validación final: cualquier problema del plan (verbatim) → exit 1 sin
  // tocar nada. En --dry-run el plan completo también se imprime, problemas
  // incluidos (la validación gana: fallar es el comportamiento honesto).
  if (plan.problems.length > 0) {
    if (args.dryRun) {
      process.stdout.write(formatPlan(plan, args.sourcePath));
    }
    console.error(`cannot ingest ${args.sourcePath}:`);
    for (const problem of plan.problems) console.error(problem);
    return 1;
  }

  if (args.dryRun) {
    process.stdout.write(formatPlan(plan, args.sourcePath));
    console.log('');
    console.log('Dry run: nothing written, no images converted, index not regenerated.');
    return 0;
  }

  // --- ejecución: convertir (COPY, jamás move), escribir, indexar -----------

  // Pre-flight de ImageMagick ANTES de crear cualquier archivo: sin `magick` no
  // se puede prometer el plan, así que se falla con un mensaje accionable.
  const probe = spawnSync('magick', ['-version'], { encoding: 'utf8' });
  if (probe.error !== undefined || probe.status !== 0) {
    console.error(
      "ImageMagick (`magick`) is not available on PATH — install ImageMagick 7 to convert images (https://imagemagick.org). Nothing was written.",
    );
    return 1;
  }

  const targetAbs = path.join(REPO_ROOT, plan.targetDir);
  fs.mkdirSync(path.join(targetAbs, 'media'), { recursive: true });
  for (const entry of plan.imagePlan) {
    const sourceAbs = resolveSourceFile(entry.source, imagesDir);
    const targetAbsFile = path.join(targetAbs, entry.target);
    const result = spawnSync('magick', [sourceAbs, targetAbsFile], { encoding: 'utf8' });
    if (result.error !== undefined || result.status !== 0) {
      const reason = result.error !== undefined ? result.error.message : result.stderr.trim();
      console.error(`failed to convert ${sourceAbs} -> ${targetAbsFile}: ${reason}`);
      return 1;
    }
    console.log(`converted ${entry.source} -> ${plan.targetDir}/${entry.target}`);
  }

  const destMd = path.join(targetAbs, `${plan.slug}.md`);
  const inPlace = path.resolve(sourcePath) === destMd;
  fs.writeFileSync(destMd, buildFrontmatterText(plan.frontmatter) + plan.rewrittenBody);
  console.log(`${inPlace ? 'rewrote' : 'wrote'} ${plan.targetDir}/${plan.slug}.md`);

  // generate-index.js no tiene script npm que encadenar: se invoca tal cual
  // para que public/index.json refleje la entrada nueva (fail-loud si no).
  const indexRun = spawnSync(process.execPath, [INDEX_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (indexRun.status !== 0) {
    console.error((indexRun.stderr || '').trim() || `index generation failed (exit ${indexRun.status})`);
    return 1;
  }
  if (indexRun.stdout.trim() !== '') console.log(indexRun.stdout.trim());

  const imageCount = plan.imagePlan.filter((entry) => entry.target !== 'media/cover.webp').length;
  const coverEntry = plan.imagePlan.find((entry) => entry.target === 'media/cover.webp');
  const coverLabel = args.kind === 'writeup' ? 'cover=level' : `cover=${coverEntry.source}`;
  console.log(`[+] ${args.kind} '${plan.slug}' → ${plan.sitePath} (${imageCount} images, ${coverLabel})`);
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

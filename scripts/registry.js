#!/usr/bin/env node
/**
 * Runner CLI de REGISTROS CERRADOS (registry R2) sobre el motor puro de
 * lib/registry.js (R1): `planTagAddition`/`planPlatformAddition`/
 * `planGroupAddition` deciden TODO el plan (problemas, archivos completos,
 * notas) y `auditGroupUi` reporta los huecos de UI; este script solo
 * orquesta entradas/salidas y aplica el patrón del repo: la implementación y
 * su pin de aprobación se escriben JUNTOS, en un solo paso.
 *
 * Uso (contrato vinculante, odd/tasks/registry.md):
 *
 *   node scripts/registry.js list
 *   node scripts/registry.js platform <name> [--icon <wave|server|network|database|bug>] [--dry-run]
 *   node scripts/registry.js tag <tag> [--kind writeup|project|certificate] [--dry-run]
 *   node scripts/registry.js group <slug> --kind project|certificate [--label <LABEL>] [--dry-run]
 *
 * Decisiones que gobiernan este runner (mismo patrón que scripts/add-content.js
 * y scripts/edit-content.js):
 *   1. El plan se imprime COMPLETO antes de actuar: archivos destino, la línea
 *      exacta que se inserta (`+ <line>`), notas no bloqueantes, pendientes de
 *      UI y los problemas verbatim al final.
 *   2. `problems` ⇒ exit 1 sin escribir nada (fail-loud, jamás medio plan).
 *   3. `--dry-run` ⇒ imprime y sale 0 sin escribir (la salida headless: anda
 *      sin TTY).
 *   4. Sin TTY ⇒ imprime el plan y sale 1 con un mensaje explícito (nunca
 *      cuelga esperando confirmación).
 *   5. Con TTY ⇒ confirmación explícita `y/N`, se escriben SOLO los archivos
 *      del plan (lib + pin) y al final se indican los tests a correr. Este
 *      script NO corre vitest y NO regenera el índice (los registros no
 *      tocan public/).
 *
 * Seguridad: ninguna ruta de usuario llega a `fs`. Las fuentes se leen por un
 * mapeo fijo (SOURCE_FILES) y antes de escribir se comprueba que cada archivo
 * del plan sea exactamente una de las fuentes leídas — solo entonces se
 * escribe el archivo completo (read → plan → confirm → write, sin escrituras
 * parciales).
 *
 * El núcleo testeable vive junto a un main() protegido por el guard de
 * import.meta.url (mismo patrón que add-content/edit-content): parseArgs,
 * formatPlan y formatList — puros y deterministas (sin timestamps ni
 * aleatoriedad).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { auditGroupUi, planGroupAddition, planGroupWiring, planPlatformAddition, planTagAddition } from '../lib/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

const USAGE = `Usage:
  node scripts/registry.js list
  node scripts/registry.js platform <name> [--icon <wave|server|network|database|bug>] [--dry-run] [--yes]
  node scripts/registry.js tag <tag> [--kind writeup|project|certificate] [--dry-run] [--yes]
  node scripts/registry.js group <slug> --kind project|certificate [--label <LABEL>] [--icon <code|gear|kernel|scan|shield>] [--dry-run] [--yes]

Notes:
  Every addition writes the implementation AND its approval pin in ONE step;
  'group' also writes the UI wiring (types, model, filter button, test pins)
  and, with --icon for project groups, the project icon map (PROJECT_ICON_BY_GROUP) and its pin.
  --icon is required without a TTY (in a terminal it is prompted with the closed vocabulary).
  --dry-run prints the full plan and writes nothing (works headless).
  --yes: for automation: implies the y/N confirmation (applies without a TTY).
  Without --yes and without a TTY the plan prints and the run exits 1 (never hangs, never writes).
  'list' is read-only and works headless.`;

/** Error de uso del CLI: siempre se acompaña del texto de USAGE. */
class UsageError extends Error {}

// Vocabulario cerrado de iconos de plataforma (Writeup['iconType'] del front;
// `bug` es el fallback documentado — el motor lo permite con nota).
const PLATFORM_ICONS = Object.freeze(['wave', 'server', 'network', 'database', 'bug']);

// Flags con valor por operación y su nombre de campo interno.
const FLAG_KEYS = Object.freeze({
  '--icon': 'icon',
  '--kind': 'kind',
  '--label': 'label',
});

const OP_FLAGS = Object.freeze({
  list: [],
  platform: ['--icon'],
  tag: ['--kind'],
  group: ['--kind', '--label', '--icon'],
});

// Kinds aceptados por --kind según operación (los grupos solo project/certificate).
const OP_KINDS = Object.freeze({
  tag: Object.freeze(['writeup', 'project', 'certificate']),
  group: Object.freeze(['project', 'certificate']),
});

/**
 * Parse the CLI argv into plain data (the four approved command shapes).
 *
 * Pure and synchronous: only reads `argv`, never the filesystem. Throws
 * {@link UsageError} for every shape problem (missing/unknown operation,
 * missing name/tag/slug, unknown flag, operation-inapplicable flag, missing
 * flag value, missing/invalid --kind, stray positional) with the
 * scripts/add-content.js message style. Defaults applied here: `tag --kind` →
 * `writeup`. An omitted `platform --icon` is intentionally NOT an error: it is
 * prompted with the closed vocabulary in a TTY and required without one.
 * `--yes` (any operation) is the automation switch: it implies the y/N
 * confirmation and permits applying WITHOUT a TTY; `group --icon` is valid for
 * project groups only.
 *
 * @param {string[]} argv arguments after the script name, e.g. process.argv.slice(2)
 * @returns {{ op: string, dryRun: boolean, yes?: boolean, name?: string, icon?: string,
 *   tag?: string, kind?: string, slug?: string, label?: string }}
 */
export function parseArgs(argv) {
  const [op, ...tail] = argv;
  if (op === undefined) throw new UsageError('missing operation');
  if (!Object.prototype.hasOwnProperty.call(OP_FLAGS, op)) {
    const listed = Object.keys(OP_FLAGS)
      .map((name) => JSON.stringify(name))
      .join(', ');
    throw new UsageError(`unknown operation: ${JSON.stringify(op)} (expected one of ${listed})`);
  }

  // Operando posicional solo cuando el siguiente token NO es un flag (así
  // `list --dry-run` y `tag --kind writeup` no tragan el flag como operand).
  let tokens = tail;
  let operand;
  if (op !== 'list' && tokens.length > 0 && !tokens[0].startsWith('--')) {
    operand = tokens[0];
    tokens = tokens.slice(1);
  }
  const operandMeta = { platform: 'name', tag: 'tag', group: 'slug' }[op];
  if (op !== 'list' && (operand === undefined || operand.trim() === '')) {
    throw new UsageError(`missing <${operandMeta}> for ${op}`);
  }

  const args = { op, dryRun: false };
  if (op === 'platform') args.name = operand;
  if (op === 'tag') {
    args.tag = operand;
    args.kind = 'writeup'; // default aprobado: --kind → writeup
  }
  if (op === 'group') args.slug = operand;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--yes') {
      args.yes = true;
      continue;
    }
    if (!token.startsWith('--')) throw new UsageError(`unexpected argument: ${JSON.stringify(token)}`);
    if (!Object.prototype.hasOwnProperty.call(FLAG_KEYS, token)) {
      throw new UsageError(`unknown option: ${token}`);
    }
    if (!OP_FLAGS[op].includes(token)) {
      throw new UsageError(`option ${token} is not valid for ${op}`);
    }
    const value = tokens[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`option ${token} requires a value`);
    }
    args[FLAG_KEYS[token]] = value;
    i += 1;
  }

  if (op === 'group' && args.kind === undefined) {
    throw new UsageError('group requires --kind <project|certificate>');
  }
  if (args.kind !== undefined) {
    const kinds = OP_KINDS[op === 'group' ? 'group' : 'tag'];
    if (!kinds.includes(args.kind)) {
      const listed = kinds.map((name) => JSON.stringify(name)).join(', ');
      throw new UsageError(`invalid --kind value: ${JSON.stringify(args.kind)} (expected one of ${listed})`);
    }
  }
  if (op === 'group' && args.icon !== undefined && args.kind !== 'project') {
    throw new UsageError('option --icon is only valid for --kind project (the icon map is project-only)');
  }
  return args;
}

/**
 * The pure write gate of main(): what to do AFTER a clean plan was printed.
 * `--dry-run` always wins (exit 0, nothing written); `--yes` permits applying
 * WITHOUT a TTY (for automation: it implies the y/N confirmation); without
 * `--yes` the behaviour is exactly as today — `confirm` on a TTY, `refuse`
 * headless (exit 1, nothing written).
 *
 * @param {{ dryRun: boolean, yes: boolean, isTTY: boolean }} gate
 * @returns {'dry-run' | 'apply' | 'confirm' | 'refuse'}
 */
export function applyMode({ dryRun, yes, isTTY }) {
  if (dryRun) return 'dry-run';
  if (yes) return 'apply';
  return isTTY ? 'confirm' : 'refuse';
}

// ---------------------------------------------------------------------------
// Formatters puros y deterministas (sin timestamps ni aleatoriedad)
// ---------------------------------------------------------------------------

/** Human identity of the requested change, e.g. `tag "Exposure" (kind: writeup)`. */
function showIdentity(identity) {
  if (identity.op === 'tag') return `tag ${JSON.stringify(identity.tag)} (kind: ${identity.kind})`;
  if (identity.op === 'platform') return `platform ${JSON.stringify(identity.name)} (icon: ${identity.icon})`;
  if (identity.op === 'group') return `group ${JSON.stringify(identity.slug)} (kind: ${identity.kind})`;
  return String(identity.op);
}

/**
 * The text a single contiguous character-splice added to a string. Every
 * motor edit is one pure splice, so this recovers the inserted fragment — but
 * ONLY for strings whose neighbours do not share its edges (see
 * {@link previewRows}: whole-line insertions are diffed line-wise and inline
 * token splices token-wise, which cannot blur).
 */
function insertedFragment(before, after) {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  return after.slice(start, endAfter);
}

/** Quoted tokens of one source line ({value, quote}), quote-aware. */
function scanQuoteTokens(line) {
  const tokens = [];
  for (let i = 0; i < line.length; i += 1) {
    const quote = line[i];
    if (quote !== "'" && quote !== '"') continue;
    let j = i + 1;
    while (j < line.length && line[j] !== quote) {
      if (line[j] === '\\') j += 1;
      j += 1;
    }
    tokens.push({ value: line.slice(i + 1, j), quote });
    i = j;
  }
  return tokens;
}

/** The quoted tokens a single-line splice inserted (token-granular diff). */
function insertedTokens(beforeLine, afterLine) {
  const before = scanQuoteTokens(beforeLine);
  const after = scanQuoteTokens(afterLine);
  const same = (a, b) => a.quote === b.quote && a.value === b.value;
  let pre = 0;
  while (pre < before.length && pre < after.length && same(before[pre], after[pre])) pre += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > pre && endAfter > pre && same(before[endBefore - 1], after[endAfter - 1])) {
    endBefore -= 1;
    endAfter -= 1;
  }
  return after.slice(pre, endAfter);
}

/**
 * The new-side lines a line-granular diff adds (LCS by exact line equality):
 * inserted lines AND the new halves of changed lines, in order. The region
 * between two separate splices can hold UNCHANGED lines (a tag plan edits the
 * count and the intersection pins far from the inserted entry) and those must
 * never render as preview rows.
 */
function addedByLineDiff(oldRegion, newRegion) {
  const n = oldRegion.length;
  const m = newRegion.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = oldRegion[i] === newRegion[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const added = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldRegion[i] === newRegion[j]) {
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i += 1;
    } else {
      added.push(newRegion[j]);
      j += 1;
    }
  }
  while (j < m) {
    added.push(newRegion[j]);
    j += 1;
  }
  return added;
}

/**
 * The `+ <line>` preview rows for one planned file: one row per inserted line
 * or inserted quoted token — the REAL bytes that will be written.
 *
 * Diffing is done at the right granularity so a value sharing an edge with its
 * neighbour ('Exposure' next to 'Exposed Service') still previews whole:
 *   - whole-line insertions and rewrites (tag lists, map entry, pin lines,
 *     count/intersection rewrites) → line diff, ONLY the new bytes;
 *   - a single changed line (the inline group lists) → quoted-token diff;
 *   - a leading inline-append separator (`, `) is folded away so the row reads
 *     as the inserted entry itself.
 */
function previewRows(before, after) {
  const rows = [];
  const push = (text) => {
    for (const line of text.split('\n')) {
      const row = line.trim().replace(/^,\s*/, '');
      if (row !== '') rows.push(row);
    }
  };

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const max = Math.min(beforeLines.length, afterLines.length);
  let start = 0;
  while (start < max && beforeLines[start] === afterLines[start]) start += 1;
  let endBefore = beforeLines.length;
  let endAfter = afterLines.length;
  while (endBefore > start && endAfter > start && beforeLines[endBefore - 1] === afterLines[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  const oldRegion = beforeLines.slice(start, endBefore);
  const newRegion = afterLines.slice(start, endAfter);

  if (oldRegion.length === 1 && newRegion.length === 1) {
    const tokens = insertedTokens(oldRegion[0], newRegion[0]);
    if (tokens.length > 0) {
      for (const token of tokens) rows.push(token.quote + token.value + token.quote);
      return rows;
    }
  }
  push(addedByLineDiff(oldRegion, newRegion).join('\n'));
  return rows;
}

/**
 * Render the full plan: the change identity, the target files with the exact
 * `+ <line>` insertion preview, the non-blocking notes, the per-kind UI
 * pendings and every problem VERBATIM.
 *
 * Deterministic on purpose (byte-idempotent dry-run): no timestamps, no
 * randomness — the same plan renders the same bytes every time.
 *
 * @param {{ plan: { problems: string[], files: {name: string, source: string}[],
 *   notes: string[], label?: string }, sources: Record<string, string>,
 *   ui?: {file: string, hint: string}[] }} result the motor plan + the source
 *   texts read (keyed by repo-relative name) + the filtered UI pendings
 * @param {{ op: string, kind?: string, tag?: string, name?: string, icon?: string, slug?: string }} identity
 *   the requested change
 * @returns {string} the printable plan
 */
export function formatPlan(result, identity) {
  const lines = [];
  lines.push('=== registry plan ===');
  lines.push(`change: ${showIdentity(identity)}`);
  if (result.plan.label !== undefined) lines.push(`label: ${result.plan.label}`);
  lines.push('');
  lines.push('files to write:');
  if (result.plan.files.length === 0) {
    lines.push(result.plan.problems.length > 0 ? '  (none — problems below block the plan)' : '  (none — nothing to do)');
  }
  for (const file of result.plan.files) {
    lines.push(`  ${file.name}`);
    const before = Object.prototype.hasOwnProperty.call(result.sources, file.name) ? result.sources[file.name] : '';
    for (const row of previewRows(before, file.source)) lines.push(`    + ${row}`);
  }
  lines.push('');
  if (result.plan.notes.length === 0) {
    lines.push('notes: none');
  } else {
    lines.push(`notes (${result.plan.notes.length}):`);
    for (const note of result.plan.notes) lines.push(`  ${note}`);
  }
  if (result.ui !== undefined) {
    lines.push('');
    if (result.ui.length === 0) {
      lines.push('UI pending: none');
    } else {
      lines.push(`UI pending (${result.ui.length} files):`);
      for (const pending of result.ui) lines.push(`  ${pending.file}: ${pending.hint}`);
    }
  }
  lines.push('');
  if (result.plan.problems.length === 0) {
    lines.push('problems: none');
  } else {
    lines.push(`problems (${result.plan.problems.length}):`);
    for (const problem of result.plan.problems) lines.push(`  ${problem}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Render the read-only `list` audit: tag vocabularies with counts, group
 * vocabularies with their per-group UI status (`ok` / `pending (n files)`),
 * the platform registration state and the GAP flag line — platforms used by
 * content in public/index.json but missing from WRITEUP_ICON_BY_PLATFORM
 * (those render the documented `bug` fallback).
 *
 * Deterministic on purpose, like {@link formatPlan}.
 *
 * @param {{ tags: Record<string, string[]>, groups: Record<string, string[]>,
 *   platforms: { registered: {name: string, icon: string}[], used: string[], missing: string[] },
 *   groupUi: { kind: string, slug: string, ready: string[], pending: {file: string, hint: string}[] }[] }} report
 * @returns {string} the printable audit
 */
export function formatList(report) {
  const listOr = (values) => (values.length > 0 ? values.join(', ') : '(none)');
  const lines = [];
  lines.push('=== registry list ===');
  lines.push('');
  lines.push('tags:');
  for (const kind of ['writeup', 'project', 'certificate']) {
    const tags = report.tags[kind] ?? [];
    lines.push(`  ${kind} (${tags.length}): ${listOr(tags)}`);
  }
  lines.push('');
  lines.push('groups:');
  for (const kind of ['project', 'certificate']) {
    const slugs = report.groups[kind] ?? [];
    lines.push(`  ${kind} (${slugs.length}): ${listOr(slugs)}`);
    for (const entry of report.groupUi.filter((item) => item.kind === kind)) {
      const status = entry.pending.length === 0 ? 'ok' : `pending (${entry.pending.length} files)`;
      lines.push(`    ${entry.slug}: ${status}`);
      for (const pending of entry.pending) lines.push(`      ${pending.file}: ${pending.hint}`);
    }
  }
  lines.push('');
  lines.push('platforms:');
  const registered = report.platforms.registered;
  lines.push(
    `  registered in WRITEUP_ICON_BY_PLATFORM (${registered.length}): ${listOr(registered.map((entry) => `${entry.name}=${entry.icon}`))}`,
  );
  lines.push(`  used by content in public/index.json (${report.platforms.used.length}): ${listOr(report.platforms.used)}`);
  if (report.platforms.missing.length > 0) {
    lines.push(
      `  GAP: used by content but missing from WRITEUP_ICON_BY_PLATFORM (renders the "bug" fallback): ${report.platforms.missing.join(', ')}`,
    );
  } else {
    lines.push('  GAP: none');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Fuentes fijas (lo único que este runner "sabe" leer) — el mapeo cerrado que
// hace imposible que una ruta de usuario llegue a fs.
// ---------------------------------------------------------------------------

const SOURCE_FILES = Object.freeze({
  taxonomy: 'lib/taxonomy.js',
  taxonomyPin: 'tests/taxonomy.test.ts',
  kinds: 'lib/content-kinds.js',
  types: 'src/types/index.ts',
  adapter: 'src/lib/contentAdapter.ts',
  adapterPin: 'tests/ui-content-adapter.test.ts',
  index: 'public/index.json',
  certModel: 'src/lib/certificationsModel.ts',
  projModel: 'src/lib/projectsModel.ts',
  certScreen: 'src/components/CertificationsScreen.tsx',
  projScreen: 'src/components/ProjectsScreen.tsx',
  certModelTest: 'tests/certifications-model.test.ts',
  projModelTest: 'tests/projects-model.test.ts',
  contentKindsApiTest: 'tests/content-kinds-api.test.ts',
});

// Fuentes del cableado de UI (planGroupWiring) por kind — las que el plan de
// `group` lista además del vocabulario y su pin (hasta 9 archivos en total).
// `project` incluye adapter/adapterPin: con --icon el plan escribe también el
// mapa de iconos del grupo (T4/T5) y sin ellos el motor falla fuerte.
const WIRING_SOURCE_KEYS = Object.freeze({
  certificate: Object.freeze(['types', 'certModel', 'certScreen', 'certModelTest', 'contentKindsApiTest']),
  project: Object.freeze(['projModel', 'projScreen', 'projModelTest', 'contentKindsApiTest', 'adapter', 'adapterPin']),
});

// Fuentes de la auditoría de UI (las 7 claves de auditGroupUi).
const UI_SOURCE_KEYS = Object.freeze(['certModel', 'projModel', 'certScreen', 'projScreen', 'adapter', 'certModelTest', 'projModelTest']);

// Fuentes por operación. `group` también lee las fuentes de su cableado de UI
// (el plan escribe vocabulario + pin + UI en UN paso); `list` lo lee todo (la
// auditoría completa) y es de solo lectura.
const OP_SOURCE_KEYS = Object.freeze({
  list: Object.keys(SOURCE_FILES),
  tag: ['taxonomy', 'taxonomyPin'],
  platform: ['adapter', 'adapterPin'],
  group: [
    'kinds',
    'taxonomyPin',
    'types',
    ...UI_SOURCE_KEYS,
    'contentKindsApiTest',
    'adapterPin', // T5: el pin del mapa de iconos project (--icon)
  ],
});

/**
 * Filtrado por kind de la auditoría agnóstica de auditGroupUi (regla 8):
 *   certificate → certificationsModel.ts / CertificationsScreen.tsx / el pin
 *                 de la suite de certifications (certifications-model.test.ts)
 *   project     → projectsModel.ts / ProjectsScreen.tsx / contentAdapter.ts
 *                 (PROJECT_ICON_BY_GROUP) / el pin de la suite de projects
 *                 (projects-model.test.ts)
 * Cada kind solo ve los huecos que le toca aplicar.
 */
const UI_FILES_BY_KIND = Object.freeze({
  certificate: Object.freeze([
    'src/lib/certificationsModel.ts',
    'src/components/CertificationsScreen.tsx',
    'tests/certifications-model.test.ts',
  ]),
  project: Object.freeze([
    'src/lib/projectsModel.ts',
    'src/components/ProjectsScreen.tsx',
    'src/lib/contentAdapter.ts',
    'tests/projects-model.test.ts',
  ]),
});

/**
 * Read the fixed source set of one operation. Missing file → clear error
 * naming the repo-relative path (fail-loud before any planning).
 *
 * @param {string[]} keys keys into SOURCE_FILES
 * @returns {Record<string, string>} raw texts keyed by repo-relative name
 */
function readSources(keys) {
  const sources = {};
  for (const key of keys) {
    const name = SOURCE_FILES[key];
    const abs = path.join(REPO_ROOT, name);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`source file not found: ${name}`);
    }
    sources[name] = fs.readFileSync(abs, 'utf8');
  }
  return sources;
}

/** auditGroupUi input shape from the raw source texts (keyed by file name). */
function uiSources(sources) {
  const out = {};
  for (const key of UI_SOURCE_KEYS) out[key] = sources[SOURCE_FILES[key]];
  return out;
}

/** Keep only the audit rows this kind is responsible for (rule 8). */
function filterAuditForKind(kind, audit) {
  const files = UI_FILES_BY_KIND[kind];
  return {
    ready: audit.ready.filter((file) => files.includes(file)),
    pending: audit.pending.filter((entry) => files.includes(entry.file)),
  };
}

// ---------------------------------------------------------------------------
// Report-only extractions for `list` (they never edit anything; the plan-side
// registry editing lives in lib/registry.js).
// ---------------------------------------------------------------------------

/**
 * Registered platforms of WRITEUP_ICON_BY_PLATFORM ({name, icon}), parsed
 * report-only from the adapter source text. NOT plan logic: the motor owns the
 * map editing; this just reads the registration state for the audit.
 */
function registeredPlatforms(adapterSource) {
  const match = /WRITEUP_ICON_BY_PLATFORM[^=]*=\s*Object\.freeze\(\s*\{/.exec(adapterSource);
  if (!match) return [];
  const bodyStart = match.index + match[0].length;
  const close = adapterSource.indexOf('});', bodyStart);
  if (close < 0) return [];
  const entries = [];
  const entryRe = /([A-Za-z0-9_-]+)\s*:\s*(?:'([^']*)'|"([^"]*)")/g;
  const body = adapterSource.slice(bodyStart, close);
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    entries.push({ name: m[1], icon: m[2] !== undefined ? m[2] : m[3] });
  }
  return entries;
}

/** Platforms actually used by content in public/index.json (writeups). */
function usedPlatforms(indexSource) {
  const index = JSON.parse(indexSource);
  const names = new Set();
  for (const item of Array.isArray(index) ? index : []) {
    if (item && item.kind === 'writeup' && typeof item.platform === 'string' && item.platform.trim() !== '') {
      names.add(item.platform.trim().toLowerCase());
    }
  }
  return [...names].sort();
}

/** Build the read-only `list` report from the source texts. */
async function buildListReport(sources) {
  // Los valores de los vocabularios salen de los módulos reales (nunca se
  // duplica su lógica de parseo); la existencia ya se verificó en readSources.
  const taxonomy = await import('../lib/taxonomy.js');
  const kinds = await import('../lib/content-kinds.js');
  const tags = {
    writeup: [...taxonomy.TAGS],
    project: [...taxonomy.PROJECT_TAGS],
    certificate: [...taxonomy.CERTIFICATE_TAGS],
  };
  const groups = { project: [...kinds.PROJECT_GROUPS], certificate: [...kinds.CERTIFICATE_GROUPS] };

  const registered = registeredPlatforms(sources[SOURCE_FILES.adapter]);
  const used = usedPlatforms(sources[SOURCE_FILES.index]);
  const registeredNames = new Set(registered.map((entry) => entry.name.toLowerCase()));
  const missing = used.filter((name) => !registeredNames.has(name));

  const groupUi = [];
  for (const kind of ['project', 'certificate']) {
    for (const slug of groups[kind]) {
      const audit = auditGroupUi({ slug, sources: uiSources(sources) });
      const filtered = filterAuditForKind(kind, audit);
      groupUi.push({ kind, slug, ready: filtered.ready, pending: filtered.pending });
    }
  }
  return { tags, groups, platforms: { registered, used, missing }, groupUi };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

// Tope de reintentos para el prompt del icono: un stdin roto no puede dejar al
// CLI en bucle infinito (mismo patrón que scripts/add-content.js).
const MAX_ATTEMPTS = 5;

async function askChoice(rl, field, choices) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const answer = (await rl.question(`${field} (${choices.join(' | ')}): `)).trim();
    if (choices.includes(answer)) return answer;
    console.log(`  ${field} must be exactly one of: ${choices.join(', ')}`);
  }
  throw new Error(`no valid ${field} after ${MAX_ATTEMPTS} attempts`);
}

// Suites de verificación por operación (el pin editado) + las del cableado.
const VERIFY_SUITES = Object.freeze({
  tag: 'tests/taxonomy.test.ts',
  platform: 'tests/ui-content-adapter.test.ts',
  group: Object.freeze({
    certificate: 'tests/taxonomy.test.ts tests/certifications-model.test.ts tests/content-kinds-api.test.ts',
    project: 'tests/taxonomy.test.ts tests/projects-model.test.ts tests/content-kinds-api.test.ts',
  }),
});

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

  // --- 1. fuentes fijas (clear error, exit 1) -----------------------------
  let sources;
  try {
    sources = readSources(OP_SOURCE_KEYS[args.op]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  // --- 7. `list`: auditoría de solo lectura, funciona headless ------------
  if (args.op === 'list') {
    try {
      const report = await buildListReport(sources);
      process.stdout.write(formatList(report));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    return 0;
  }

  // Icono de plataforma: obligatorio sin TTY, prompt con vocabulario cerrado
  // en TTY (decisión: `bug` es fallback documentado, el motor avisa).
  let icon = args.icon;
  if (args.op === 'platform' && icon === undefined) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error('platform requires --icon <wave|server|network|database|bug> when there is no TTY.');
      return 1;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      icon = await askChoice(rl, 'icon', [...PLATFORM_ICONS]);
    } finally {
      rl.close();
    }
  }

  // --- 2. plan via el motor + impresión completa --------------------------
  const identity = {
    op: args.op,
    kind: args.kind,
    tag: args.tag,
    name: args.name,
    icon,
    slug: args.slug,
  };
  let plan;
  try {
    if (args.op === 'tag') {
      plan = planTagAddition({
        kind: args.kind,
        tag: args.tag,
        taxonomySource: sources[SOURCE_FILES.taxonomy],
        pinSource: sources[SOURCE_FILES.taxonomyPin],
      });
    } else if (args.op === 'platform') {
      plan = planPlatformAddition({
        name: args.name,
        icon,
        adapterSource: sources[SOURCE_FILES.adapter],
        pinSource: sources[SOURCE_FILES.adapterPin],
      });
    } else {
      // `group` = ASEGURAR registrado y cableado (T5, "el script lo escribe
      // todo"): vocabulario + pin (ifPresent: 'skip' — un slug ya registrado
      // es nota, no problema, para que un re-run pueda aplicar lo que falte) y
      // TODO el cableado de UI en el mismo plan (hasta 7 archivos).
      const vocabPlan = planGroupAddition({
        kind: args.kind,
        slug: args.slug,
        label: args.label,
        kindsSource: sources[SOURCE_FILES.kinds],
        pinSource: sources[SOURCE_FILES.taxonomyPin],
        ifPresent: 'skip',
      });
      const wiringSources = {};
      for (const key of WIRING_SOURCE_KEYS[args.kind]) wiringSources[SOURCE_FILES[key]] = sources[SOURCE_FILES[key]];
      const wiringPlan = planGroupWiring({
        kind: args.kind,
        slug: args.slug,
        label: args.label,
        icon: args.icon,
        sources: wiringSources,
      });
      plan = {
        problems: [...vocabPlan.problems, ...wiringPlan.problems],
        files: [...vocabPlan.files, ...wiringPlan.files],
        notes: [...vocabPlan.notes, ...wiringPlan.notes],
        label: vocabPlan.label,
      };
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  process.stdout.write(formatPlan({ plan, sources }, identity));

  // --- 3. problemas ⇒ exit 1, nada escrito --------------------------------
  if (plan.problems.length > 0) {
    console.error(`cannot register ${showIdentity(identity)}:`);
    for (const problem of plan.problems) console.error(problem);
    return 1;
  }

  // --- 4. --dry-run ⇒ salida headless, exit 0 ------------------------------
  // --- 5. --yes ⇒ aplica sin TTY (para automatización: implica la
  //         confirmación y/N); sin --yes y sin TTY ⇒ plan + exit 1 ----------
  const mode = applyMode({
    dryRun: args.dryRun,
    yes: args.yes === true,
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });
  if (mode === 'dry-run') {
    console.log('');
    console.log('Dry run: nothing written.');
    return 0;
  }
  if (mode === 'refuse') {
    console.error(
      'interactive TTY required to confirm — re-run in a terminal, use --yes for automation or --dry-run to only print the plan. Nothing was written.',
    );
    return 1;
  }

  // --- 6. confirmación explícita (salvo --yes) + escritura de SOLO los
  //         archivos del plan ----------------------------------------------
  if (mode === 'confirm') {
    const confirmRl = createInterface({ input: process.stdin, output: process.stdout });
    let confirmed;
    try {
      confirmed = (await confirmRl.question('apply this change? [y/N]: ')).trim();
    } finally {
      confirmRl.close();
    }
    if (!/^y(es)?$/i.test(confirmed)) {
      console.log('aborted — nothing written.');
      return 0;
    }
  }

  // Seguridad: cada archivo del plan debe ser EXACTAMENTE una de las fuentes
  // fijas leídas (el mapeo cerrado de arriba); nada más puede llegar a fs.
  for (const file of plan.files) {
    if (!Object.prototype.hasOwnProperty.call(sources, file.name)) {
      console.error(`refusing to write unplanned file: ${file.name} — nothing was written.`);
      return 1;
    }
  }

  // Sin escrituras parciales: cada archivo se escribe completo (fuente nueva
  // entera del plan). Los registros no tocan public/ ni regeneran el índice.
  for (const file of plan.files) {
    fs.writeFileSync(path.join(REPO_ROOT, file.name), file.source);
    console.log(`wrote ${file.name}`);
  }

  if (plan.files.length === 0) {
    console.log(`nothing to do — ${showIdentity(identity)} is already fully registered and wired (0 files written).`);
  } else {
    console.log(`[+] ${showIdentity(identity)} → ${plan.files.length} files written`);
  }
  console.log(`next: npx vitest run ${args.op === 'group' ? VERIFY_SUITES.group[args.kind] : VERIFY_SUITES[args.op]}`);
  console.log('next: npx vitest run tests/registry.test.ts');
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

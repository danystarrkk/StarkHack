// Motor puro de REGISTROS CERRADOS (registry R1/T1): el plan determinista de
// ediciones a los tres registros cerrados del repo — plataformas de writeup,
// vocabularios de tags por kind y grupos project/certificate — para que el CLI
// scripts/registry.js (T2) los aplique en UN paso: implementación y pin de
// aprobación juntos, sin que se vuelva a olvidar un pin (el patrón del repo:
// todo registro cerrado vive en 2+ lugares). Sin I/O — ni fs, ni path, ni
// process — igual que lib/content-ingest.js y lib/content-edit.js: solo
// textos fuente planos de entrada y textos nuevos + problemas de salida. Los
// tests en tests/registry.test.ts fijan el contrato (RED primero, TDD).
//
// Reglas aprobadas (odd/tasks/registry.md, decisiones humanas):
//   - Tag: vacío/espaciado ⇒ problema; ya presente en la lista DEL KIND
//     (case-insensitive) ⇒ problema que nombra ambos valores; las tres
//     vocabularías son independientes (un valor de otro kind NO es problema).
//   - Posición de inserción: TAGS/APPROVED_TAGS insertan en orden alfabético
//     (el mismo comparador del suite de taxonomía: localeCompare('en'));
//     PROJECT_TAGS/CERTIFICATE_TAGS/PROJECT_GROUPS/CERTIFICATE_GROUPS y sus
//     pines se agregan AL FINAL (el orden aprobado se preserva). Invariante:
//     tras cualquier plan, la lista lib y su pin tienen la misma longitud y el
//     mismo valor en cada índice — lo que mantiene el toEqual verde. OJO: el
//     pin APPROVED_TAGS vive a propósito en orden de aprobación histórico
//     ('Buffer Overflow' antes de 'Broken Authentication') y su suite compara
//     `[...APPROVED_TAGS].sort(byAlphabet)`, así que allí el invariante corre
//     contra el pin COMO LO COMPARA ese suite (ordenado).
//   - Plataforma: nombre ^[a-z0-9][a-z0-9-]*$; icono ∈ wave|server|network|
//     database|bug (problema listando el vocabulario si no); `bug` se permite
//     PERO empuja una nota NO bloqueante (campo `notes` — tercer campo del
//     plan, junto a `problems` y `files`); una plataforma ya registrada es
//     problema "already registered" (nunca una clave duplicada en el mapa).
//   - Edición de plataforma: agrega `  <name>: '<icon>',` a
//     WRITEUP_ICON_BY_PLATFORM antes de su `});` de cierre y UNA línea
//     `expect(toUiWriteup({ ...BARE_ENTRY, platform: '<name>' }).iconType)…`
//     justo antes del ancla `// Unknown platform → documented fallback.` del
//     bloque pin de tests/ui-content-adapter.test.ts.
//   - Grupo: slug ^[a-z][a-z0-9-]*$; `label` por defecto = slug en mayúsculas
//     (se devuelve como `label` del plan — las labels de UI viven en los
//     modelos y solo las AUDITA auditGroupUi, nunca se editan aquí); append a
//     PROJECT_GROUPS/CERTIFICATE_GROUPS en lib/content-kinds.js Y al
//     APPROVED_*_GROUPS correspondiente en tests/taxonomy.test.ts en el MISMO
//     índice (invariante de posición); slug duplicado ⇒ problema.
//   - auditGroupUi SOLO reporta, por archivo de UI, si el slug ya está
//     presente: `pending` (con pista de una línea que nombra qué agregar) o
//     `ready`. Nunca edita esas fuentes. El chequeo es por presencia textual
//     del slug (case-insensitive, con límites no alfanuméricos) y es
//     agnostic del kind: el CLI/humano filtra lo que le corresponda.
//   - Fallar fuerte (fail-loud): toda ancla ausente (lista, mapa, ancla de
//     pin) empuja un problema y el plan NO produce archivos — jamás un no-op
//     silencioso que parezca un éxito.
//
// Los mensajes nuevos siguen la familia fail-loud del pipeline
// ('Invalid …: expected …, got …', '… is already registered …', 'Missing … in
// <file>: …') y están pineados verbatim por tests/registry.test.ts.

/**
 * One planned file write: `name` is the repository-relative file the CLI
 * writes, `source` its COMPLETE new content.
 *
 * @typedef {{ name: string, source: string }} RegistryPlanFile
 */

/**
 * The plan every `plan*` returns.
 *
 * @typedef {object} RegistryPlan
 * @property {string[]} problems every validation problem, pinned verbatim by
 *   the tests. Non-empty ⇒ `files` is EMPTY (fail-loud: never half-apply).
 * @property {RegistryPlanFile[]} files the complete edited sources — the
 *   implementation first, its approval pin second.
 * @property {string[]} notes non-blocking advisories for a successful plan
 *   (e.g. a platform registered with the fallback `bug` icon). Never block.
 */

/**
 * @typedef {object} TagAdditionInput
 * @property {'writeup' | 'project' | 'certificate'} kind whose vocabulary grows
 * @property {string} tag the new tag (exact spelling; must be trimmed already)
 * @property {string} taxonomySource raw text of lib/taxonomy.js
 * @property {string} pinSource raw text of tests/taxonomy.test.ts
 */

/**
 * @typedef {object} PlatformAdditionInput
 * @property {string} name platform directory name (^ [a-z0-9][a-z0-9-]* $)
 * @property {'wave' | 'server' | 'network' | 'database' | 'bug'} icon writeup iconType
 * @property {string} adapterSource raw text of src/lib/contentAdapter.ts
 * @property {string} pinSource raw text of tests/ui-content-adapter.test.ts
 */

/**
 * @typedef {object} GroupAdditionInput
 * @property {'project' | 'certificate'} kind whose group list grows
 * @property {string} slug group slug (^ [a-z][a-z0-9-]* $)
 * @property {string} [label] UI label; defaults to the slug uppercased
 * @property {string} kindsSource raw text of lib/content-kinds.js
 * @property {string} pinSource raw text of tests/taxonomy.test.ts
 */

/**
 * A group plan carries the effective UI label too (default: slug uppercased):
 * the plan itself never writes it (the UI labels live in the audited models),
 * but the CLI needs it to prompt/report consistently.
 *
 * @typedef {RegistryPlan & { label: string }} GroupPlan
 */

/**
 * The per-file UI audit result: `pending` lists the files that still lack the
 * slug with a one-line hint naming what to add; `ready` lists the files that
 * already mention it. Pure report — audited sources are never edited.
 *
 * @typedef {{ pending: { file: string, hint: string }[], ready: string[] }} GroupUiAudit
 */

// Vocabulario cerrado de iconType de writeup (src/types Writeup['iconType']):
// `bug` es el fallback documentado, por eso se permite con aviso.
const PLATFORM_ICONS = Object.freeze(['wave', 'server', 'network', 'database', 'bug']);

const PLATFORM_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const GROUP_SLUG_RE = /^[a-z][a-z0-9-]*$/;

// Mismo formato "got" de lib/content-ingest.js para los mensajes nuevos.
function shown(value) {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

// El mismo comparador alfabético que usa tests/taxonomy.test.ts (byAlphabet).
function byAlphabet(a, b) {
  return a.localeCompare(b, 'en');
}

// ---------------------------------------------------------------------------
// Edición textual de literales de arreglo (quote-aware, comment-aware):
// localiza `const NAME = [ … ]`, extrae las entradas con sus posiciones y
// splicea UNA entrada nueva — alfabéticamente o al final — preservando el
// estilo del bloque (una entrada por línea con coma final, o inline).
// ---------------------------------------------------------------------------

/** Skip a quoted string starting at `start`; returns the closing quote index. */
function skipString(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  return i;
}

/** Quoted entries with their token positions inside `source[from, to)`. */
function scanEntries(source, from, to) {
  const entries = [];
  let i = from;
  while (i < to) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      const start = i;
      const end = skipString(source, i);
      entries.push({ value: source.slice(start + 1, end), quote: ch, start, end: end + 1 });
      i = end + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? to : nl;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? to : end + 2;
      continue;
    }
    i += 1;
  }
  return entries;
}

/**
 * Locate the array literal of the declaration `decl` matches. Returns
 * `{ open, close, entries }` (bracket positions + parsed entries) or `null`
 * when the declaration/brackets are missing (fail-loud caller handles it).
 */
function findArrayBlock(source, decl) {
  const match = decl.exec(source);
  if (!match) return null;
  const open = source.indexOf('[', match.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      i = skipString(source, i);
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      i = nl < 0 ? source.length : nl;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return { open, close: i, entries: scanEntries(source, open + 1, i) };
    }
  }
  return null;
}

function lineStartOf(source, index) {
  return source.lastIndexOf('\n', index - 1) + 1;
}

function indentOfLine(source, index) {
  const line = source.slice(lineStartOf(source, index), index);
  const match = line.match(/^[ \t]*/);
  return match ? match[0] : '';
}

/** Every entry owns its own line (`  'value',`)? → line-mode insertion. */
function entriesOwnTheirLines(source, block) {
  return (
    block.entries.length > 0 &&
    block.entries.every((entry) => {
      const beforeOnLine = source.slice(lineStartOf(source, entry.start), entry.start);
      const nl = source.indexOf('\n', entry.end);
      const afterOnLine = source.slice(entry.end, nl < 0 ? block.close : nl);
      return /^\s*$/.test(beforeOnLine) && /^[ \t]*,?[ \t]*$/.test(afterOnLine);
    })
  );
}

/**
 * Insert `value` into the array literal of `block` BEFORE the entry at
 * `beforeIndex` (entries.length ⇒ append at the end), preserving the block's
 * formatting style. Returns the new source text (inputs untouched).
 */
function insertEntry(source, block, value, beforeIndex) {
  const { close, entries } = block;
  if (entries.length === 0) {
    return source.slice(0, close) + "'" + value + "'" + source.slice(close);
  }
  const quote = (beforeIndex < entries.length ? entries[beforeIndex] : entries[entries.length - 1]).quote;

  if (!entriesOwnTheirLines(source, block)) {
    // Inline style (['a', 'b']): token splice around the entry tokens.
    if (beforeIndex < entries.length) {
      const at = entries[beforeIndex].start;
      return source.slice(0, at) + quote + value + quote + ', ' + source.slice(at);
    }
    const at = entries[entries.length - 1].end;
    return source.slice(0, at) + ', ' + quote + value + quote + source.slice(at);
  }

  // Line style ('  value', per line): splice whole lines.
  const line = (indent) => indent + quote + value + quote + ',\n';
  if (beforeIndex < entries.length) {
    const entry = entries[beforeIndex];
    const at = lineStartOf(source, entry.start);
    return source.slice(0, at) + line(indentOfLine(source, entry.start)) + source.slice(at);
  }
  // Append after the last entry's line; ensure that line ends with a comma.
  const last = entries[entries.length - 1];
  let tail = source;
  let nl = tail.indexOf('\n', last.end);
  const lineEnd = nl < 0 ? close : nl;
  if (!tail.slice(last.end, lineEnd).includes(',')) {
    tail = tail.slice(0, last.end) + ',' + tail.slice(last.end);
    nl = tail.indexOf('\n', last.end);
  }
  const at = nl < 0 ? close + 1 : nl + 1;
  return tail.slice(0, at) + line(indentOfLine(source, last.start)) + tail.slice(at);
}

/**
 * Insertion index for `value` in `entries`: alphabetically before the first
 * entry that sorts after it (the exact position in sorted lists), or at the
 * end for the approved-order lists (`mode: 'append'`).
 */
function insertionIndex(entries, value, mode) {
  if (mode === 'append') return entries.length;
  for (let i = 0; i < entries.length; i += 1) {
    if (byAlphabet(value, entries[i].value) < 0) return i;
  }
  return entries.length;
}

const declLibList = (name) => new RegExp(`export\\s+const\\s+${name}\\s*=\\s*Object\\.freeze\\s*\\(\\s*\\[`);
const declPinList = (name) => new RegExp(`const\\s+${name}\\s*=\\s*\\[`);

// ---------------------------------------------------------------------------
// planTagAddition
// ---------------------------------------------------------------------------

// Cada kind declara su lista de implementación y su pin de aprobación; los
// pines viven en tests/taxonomy.test.ts. writeup inserta alfabético, el resto
// append (orden aprobado preservado).
const TAG_LISTS = Object.freeze({
  writeup: { lib: 'TAGS', pin: 'APPROVED_TAGS', mode: 'alphabetical' },
  project: { lib: 'PROJECT_TAGS', pin: 'APPROVED_PROJECT_TAGS', mode: 'append' },
  certificate: { lib: 'CERTIFICATE_TAGS', pin: 'APPROVED_CERTIFICATE_TAGS', mode: 'append' },
});

/**
 * Plan the addition of one tag to a kind's closed vocabulary, editing
 * lib/taxonomy.js AND its approval pin in tests/taxonomy.test.ts together.
 *
 * Pure and synchronous. Throws only for a hard input error (unknown kind,
 * verbatim `Unknown content kind: …`); every semantic problem is collected
 * into `problems` and then `files` stays EMPTY (fail-loud, never half-apply).
 *
 * @param {TagAdditionInput} input the plain inputs
 * @returns {RegistryPlan} problems/files/notes (see typedef)
 */
export function planTagAddition({ kind, tag, taxonomySource, pinSource }) {
  const spec = TAG_LISTS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }
  const notes = [];

  // Regla 1: vacío/espaciado/no-string ⇒ problema (sin editar nada).
  if (typeof tag !== 'string' || tag.trim() === '' || tag !== tag.trim()) {
    return {
      problems: [`Invalid tag: expected a non-empty, non-whitespace-padded string, got ${shown(tag)}.`],
      files: [],
      notes,
    };
  }

  // Regla 1b: el tag es el único valor libre que este plan escribe y se
  // concatena SIN escapar en los dos archivos destino: comillas, backslashes
  // o caracteres de control lo dejarían sin parsear y, al no reportarlo, la
  // edición se aplicaría como un éxito (contradice el fail-loud del módulo).
  if (/['"\\\u0000-\u001f]/.test(tag)) {
    return {
      problems: [`Invalid tag: expected a value without quotes, backslashes or control characters, got ${shown(tag)}.`],
      files: [],
      notes,
    };
  }

  const problems = [];
  const libBlock = findArrayBlock(taxonomySource, declLibList(spec.lib));
  const pinBlock = findArrayBlock(pinSource, declPinList(spec.pin));
  if (!libBlock) {
    problems.push(`Missing ${spec.lib} list in lib/taxonomy.js: expected the [...] block.`);
  }
  if (!pinBlock) {
    problems.push(`Missing ${spec.pin} list in tests/taxonomy.test.ts: expected the [...] block.`);
  }
  if (problems.length > 0) return { problems, files: [], notes };

  // Regla 1: duplicado SOLO dentro del vocabulario del kind (case-insensitive),
  // nombrando ambos valores. Los otros kinds son independientes.
  const existing = libBlock.entries.find((entry) => entry.value.toLowerCase() === tag.toLowerCase());
  if (existing) {
    return {
      problems: [
        `Duplicate tag in ${kind} tag vocabulary: ${shown(tag)} is already used by ${shown(existing.value)}.`,
      ],
      files: [],
      notes,
    };
  }

  // Regla 2: misma posición en lib y en pin (alfabética para TAGS, append
  // para los vocabularios aprobados) → mismo valor en cada índice.
  const libOut = insertEntry(taxonomySource, libBlock, tag, insertionIndex(libBlock.entries, tag, spec.mode));
  const pinOut = insertEntry(pinSource, pinBlock, tag, insertionIndex(pinBlock.entries, tag, spec.mode));
  return {
    problems: [],
    files: [
      { name: 'lib/taxonomy.js', source: libOut },
      { name: 'tests/taxonomy.test.ts', source: pinOut },
    ],
    notes,
  };
}

// ---------------------------------------------------------------------------
// planPlatformAddition
// ---------------------------------------------------------------------------

// El mapa de iconos de plataforma y su bloque pin. La entrada se agrega antes
// del `});` de cierre del mapa (append al final, sin orden aprobado) y la
// línea expect antes del ancla del bloque pin.
const PLATFORM_MAP_DECL = /WRITEUP_ICON_BY_PLATFORM\b[^=]*=\s*Object\.freeze\(\s*\{/;
const PLATFORM_PIN_ANCHOR = '// Unknown platform → documented fallback.';

/** Parse `WRITEUP_ICON_BY_PLATFORM` entries ({ name, icon, start }) or null. */
function findIconMap(source) {
  const match = PLATFORM_MAP_DECL.exec(source);
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  const close = source.indexOf('});', bodyStart);
  if (close < 0) return null;
  const entries = [];
  const entryRe = /([A-Za-z0-9_-]+)\s*:\s*(?:'([^']*)'|"([^"]*)")/g;
  const body = source.slice(bodyStart, close);
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    entries.push({ name: m[1], icon: m[2] !== undefined ? m[2] : m[3], start: bodyStart + m.index });
  }
  return { bodyStart, close, entries };
}

/**
 * Plan the registration of one writeup platform, editing the
 * WRITEUP_ICON_BY_PLATFORM map in src/lib/contentAdapter.ts AND the
 * "documented map" pin block in tests/ui-content-adapter.test.ts together.
 *
 * The fallback icon `bug` is allowed but pushes a NON-BLOCKING note into
 * `notes` (the plan's third field, documented in {@link RegistryPlan}).
 *
 * @param {PlatformAdditionInput} input the plain inputs
 * @returns {RegistryPlan} problems/files/notes (see typedef)
 */
export function planPlatformAddition({ name, icon, adapterSource, pinSource }) {
  const problems = [];
  const notes = [];

  if (typeof name !== 'string' || !PLATFORM_NAME_RE.test(name)) {
    problems.push(`Invalid platform name: expected /^[a-z0-9][a-z0-9-]*$/, got ${shown(name)}.`);
  }
  if (typeof icon !== 'string' || !PLATFORM_ICONS.includes(icon)) {
    problems.push(
      `Invalid platform icon: expected one of ${PLATFORM_ICONS.map(shown).join(', ')}, got ${shown(icon)}.`
    );
  }
  if (problems.length > 0) return { problems, files: [], notes };

  const map = findIconMap(adapterSource);
  if (!map) {
    problems.push(
      'Missing WRITEUP_ICON_BY_PLATFORM map in src/lib/contentAdapter.ts: expected the {...} block.'
    );
    return { problems, files: [], notes };
  }
  const anchorLine = pinSource.indexOf(PLATFORM_PIN_ANCHOR);
  if (anchorLine < 0) {
    problems.push(
      'Missing platform pin anchor in tests/ui-content-adapter.test.ts: expected the "// Unknown platform → documented fallback." line.'
    );
    return { problems, files: [], notes };
  }

  // Re-registrar una plataforma existente (con cualquier icono) es problema:
  // una clave duplicada en el mapa nunca sería un plan válido.
  const existing = map.entries.find((entry) => entry.name === name);
  if (existing) {
    return {
      problems: [`Platform ${shown(name)} is already registered with icon ${shown(existing.icon)}.`],
      files: [],
      notes,
    };
  }

  // `bug` es el fallback documentado: se permite, con aviso no bloqueante.
  if (icon === 'bug') {
    notes.push(
      `Platform ${shown(name)} uses the fallback icon "bug": indistinguishable from unregistered platforms in the UI.`
    );
  }

  // Edición 1: la entrada del mapa antes de su `});` de cierre (indentación
  // tomada de las entradas vecinas).
  const mapIndent = map.entries.length > 0 ? indentOfLine(adapterSource, map.entries[0].start) : '  ';
  const closeLine = adapterSource.lastIndexOf('\n', map.close - 1) + 1;
  const adapterOut =
    adapterSource.slice(0, closeLine) +
    mapIndent +
    `${name}: '${icon}',\n` +
    adapterSource.slice(closeLine);

  // Edición 2: UNA línea expect justo antes del ancla del bloque pin (misma
  // indentación que el ancla, 4 espacios en el archivo real).
  const anchorAt = pinSource.indexOf(PLATFORM_PIN_ANCHOR);
  const anchorLineStart = lineStartOf(pinSource, anchorAt);
  const pinOut =
    pinSource.slice(0, anchorLineStart) +
    indentOfLine(pinSource, anchorAt) +
    `expect(toUiWriteup({ ...BARE_ENTRY, platform: '${name}' }).iconType).toBe('${icon}');\n` +
    pinSource.slice(anchorLineStart);

  return {
    problems: [],
    files: [
      { name: 'src/lib/contentAdapter.ts', source: adapterOut },
      { name: 'tests/ui-content-adapter.test.ts', source: pinOut },
    ],
    notes,
  };
}

// ---------------------------------------------------------------------------
// planGroupAddition
// ---------------------------------------------------------------------------

// Cada kind de grupo declara su lista en lib/content-kinds.js y su pin en
// tests/taxonomy.test.ts; ambos se editan AL FINAL (orden aprobado) en el
// MISMO índice.
const GROUP_LISTS = Object.freeze({
  project: { lib: 'PROJECT_GROUPS', pin: 'APPROVED_PROJECT_GROUPS' },
  certificate: { lib: 'CERTIFICATE_GROUPS', pin: 'APPROVED_CERTIFICATE_GROUPS' },
});

/**
 * Plan the addition of one project/certificate group, editing the group list
 * in lib/content-kinds.js AND its APPROVED_*_GROUPS pin in
 * tests/taxonomy.test.ts at the SAME index (both append at the end). The UI
 * label is returned as `label` (default: the slug uppercased) but never
 * written here — the UI models/screens are audit-only
 * ({@link auditGroupUi} reports what still needs it).
 *
 * Pure and synchronous. Throws only for a hard input error (kind without
 * groups, verbatim `Unknown content kind: …`); every semantic problem is
 * collected into `problems` and then `files` stays EMPTY.
 *
 * @param {GroupAdditionInput} input the plain inputs
 * @returns {GroupPlan} problems/files/notes/label (see typedefs)
 */
export function planGroupAddition({ kind, slug, label, kindsSource, pinSource }) {
  const spec = GROUP_LISTS[kind];
  if (!spec) {
    throw new Error(`Unknown content kind: ${JSON.stringify(kind)}`);
  }
  const problems = [];
  const notes = [];

  if (typeof slug !== 'string' || !GROUP_SLUG_RE.test(slug)) {
    problems.push(`Invalid group slug: expected /^[a-z][a-z0-9-]*$/, got ${shown(slug)}.`);
  }
  if (label !== undefined && label !== null && typeof label !== 'string') {
    problems.push(`Invalid group label: expected a string, got ${shown(label)}.`);
  }
  // Label efectiva: la dada (recortada) o el slug en mayúsculas.
  const effectiveLabel =
    typeof label === 'string' && label.trim() !== '' ? label.trim() : typeof slug === 'string' ? slug.toUpperCase() : '';

  if (problems.length > 0) return { problems, files: [], notes, label: effectiveLabel };

  const libBlock = findArrayBlock(kindsSource, declLibList(spec.lib));
  const pinBlock = findArrayBlock(pinSource, declPinList(spec.pin));
  if (!libBlock) {
    problems.push(`Missing ${spec.lib} list in lib/content-kinds.js: expected the [...] block.`);
  }
  if (!pinBlock) {
    problems.push(`Missing ${spec.pin} list in tests/taxonomy.test.ts: expected the [...] block.`);
  }
  if (problems.length > 0) return { problems, files: [], notes, label: effectiveLabel };

  const existing = libBlock.entries.find((entry) => entry.value === slug);
  if (existing) {
    return {
      problems: [`Duplicate group slug: ${shown(slug)} is already registered in ${spec.lib}.`],
      files: [],
      notes,
      label: effectiveLabel,
    };
  }

  // Regla 5: append al final en AMBAS listas (mismo índice), estilo inline.
  const libOut = insertEntry(kindsSource, libBlock, slug, libBlock.entries.length);
  const pinOut = insertEntry(pinSource, pinBlock, slug, pinBlock.entries.length);
  return {
    problems: [],
    files: [
      { name: 'lib/content-kinds.js', source: libOut },
      { name: 'tests/taxonomy.test.ts', source: pinOut },
    ],
    notes,
    label: effectiveLabel,
  };
}

// ---------------------------------------------------------------------------
// auditGroupUi
// ---------------------------------------------------------------------------

// Auditoría por PRESENCIA del slug en cada archivo de UI (case-insensitive,
// con límites no alfanuméricos — un slug más largo no cuenta como el corto).
// Agnóstico del kind: el CLI/humano decide qué pista le corresponde aplicar.
const UI_CHECKS = Object.freeze([
  {
    key: 'certModel',
    file: 'src/lib/certificationsModel.ts',
    hint: (slug) => `add '${slug}' to CERTIFICATE_GROUP_LABELS and CERTIFICATION_FILTER_CATEGORIES`,
  },
  {
    key: 'projModel',
    file: 'src/lib/projectsModel.ts',
    hint: (slug) => `add '${slug}' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES`,
  },
  {
    key: 'certScreen',
    file: 'src/components/CertificationsScreen.tsx',
    hint: (slug) => `add a filter button and a getCategoryBadgeStyle case for '${slug}'`,
  },
  {
    key: 'projScreen',
    file: 'src/components/ProjectsScreen.tsx',
    hint: (slug) => `add a getCategoryBadgeStyle case for the '${slug}' label`,
  },
  {
    key: 'adapter',
    file: 'src/lib/contentAdapter.ts',
    hint: (slug) => `add '${slug}' to PROJECT_ICON_BY_GROUP`,
  },
  {
    key: 'certModelTest',
    file: 'tests/certifications-model.test.ts',
    hint: (slug) => `add '${slug}' to the CERTIFICATE_GROUP_LABELS and filter-count pins`,
  },
  {
    key: 'projModelTest',
    file: 'tests/projects-model.test.ts',
    hint: (slug) => `add '${slug}' to the PROJECT_GROUP_LABELS and filter-count pins`,
  },
]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does `source` mention `slug` as a whole token (case-insensitive)? */
function mentionsSlug(source, slug) {
  if (typeof source !== 'string' || typeof slug !== 'string' || slug === '') return false;
  const pattern = new RegExp(`(^|[^a-z0-9-])${escapeRegExp(slug.toLowerCase())}([^a-z0-9-]|$)`);
  return pattern.test(source.toLowerCase());
}

/**
 * Report which UI files already mention `slug` (ready) and which still lack it
 * (pending, each with a one-line hint naming what to add). READ-ONLY by
 * contract: the audited sources are strings and are never modified — this
 * function only looks at them.
 *
 * @param {{ slug: string, sources: Record<string, string> }} input the group slug and the UI sources by key
 * @returns {GroupUiAudit} pending entries (file + hint) and ready file names
 */
export function auditGroupUi({ slug, sources }) {
  const pending = [];
  const ready = [];
  for (const check of UI_CHECKS) {
    const source = sources === null || sources === undefined ? undefined : sources[check.key];
    if (mentionsSlug(source, slug)) {
      ready.push(check.file);
    } else {
      pending.push({ file: check.file, hint: check.hint(slug) });
    }
  }
  return { pending, ready };
}

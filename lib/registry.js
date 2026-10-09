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
 * @property {'problem' | 'skip'} [ifPresent] what an already-registered slug
 *   means: `problem` (default, the pinned "Duplicate group slug" contract) or
 *   `skip` — the "ensure registered" semantics the `group` CLI step needs so a
 *   second run can report already-done instead of failing.
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
  const start = lineStartOf(source, index);
  const end = source.indexOf('\n', start);
  const line = source.slice(start, end < 0 ? source.length : end);
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
export function planGroupAddition({ kind, slug, label, kindsSource, pinSource, ifPresent }) {
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
    // "ensure" semantics (ifPresent: 'skip'): the vocabulary step is already
    // done — report it as a note so the CLI can apply whatever is still
    // missing (the UI wiring) instead of failing on a legitimate re-run.
    if (ifPresent === 'skip') {
      return {
        problems: [],
        files: [],
        notes: [`already registered in ${spec.lib} — vocabulary unchanged.`],
        label: effectiveLabel,
      };
    }
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
    hint: (slug) => `add a filter button for '${slug}'`,
  },
  {
    key: 'projScreen',
    file: 'src/components/ProjectsScreen.tsx',
    hint: (slug) => `add a filter button for '${slug}'`,
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

// ---------------------------------------------------------------------------
// planGroupWiring (T5 — "el script lo escribe todo": zero pending work)
// ---------------------------------------------------------------------------
//
// El registro de un grupo dejaba 3 tests rojos y la UI sin botón/label (la
// decisión humana: "automáticamente se hiciera todo"). planGroupWiring es el
// segundo paso del `group` del CLI: recibe las FUENTES de UI por nombre de
// archivo y devuelve los textos ya cableados — unión de tipo en
// src/types/index.ts, modelo (uniones, mapa de labels, categorías de filtro y
// normalizeGroup), UN botón de filtro clonado del último existente y los pines
// de los tests — junto con las notas del plan. Misma disciplina que el resto
// del motor: puro, sin I/O, fail-loud con problema verbatim por ancla ausente
// (nunca un resultado parcial) e idempotente: un archivo que ya menciona el
// grupo se salta, y si todos están cableados el plan es `files: []` + la nota
// `already wired`.
//
// Anclas por kind (las 5 de certificate, las 4 de project):
//   certificate:
//     1. src/types/index.ts — `category?: 'UNIVERSIDAD' | …` de Certification:
//        la label entra en la parte de pipeline (ANTES de UDEMY/OFFSEC, que
//        son solo del template).
//     2. src/lib/certificationsModel.ts — union CertificateGroup (slugs),
//        union CertificationGroupLabel, CERTIFICATE_GROUP_LABELS (después de
//        cisco), CERTIFICATION_FILTER_CATEGORIES (después del entry CISCO) y
//        el chequeo canónico de normalizeGroup.
//     3. src/components/CertificationsScreen.tsx — UN botón clonado del último
//        botón estático de filtro (hoy el de CISCO): cambian SOLO la label y
//        el id de activeFilter; getCategoryBadgeStyle NO se toca — su rama
//        default ya cubre las categorías nuevas (se dice en una nota).
//     4. tests/certifications-model.test.ts — pin del mapa de labels, arrays
//        de filter ids, arrays de groups y arrays de counts (+1 cero).
//     5. tests/content-kinds-api.test.ts — la expectation de
//        getCertificateGroups() (+ el número en el título del test).
//   project: el mismo shape sobre projectsModel.ts (ProjectGroup /
//     ProjectGroupLabel / ProjectFilterId / PROJECT_GROUP_LABELS /
//     PROJECT_FILTER_CATEGORIES / normalizeGroup), ProjectsScreen.tsx (botón),
//     tests/projects-model.test.ts y la expectation de getProjectGroups() en
//     tests/content-kinds-api.test.ts. Con `--icon` el icono del grupo vive en
//     PROJECT_ICON_BY_GROUP (src/lib/contentAdapter.ts) + su pin en
//     tests/ui-content-adapter.test.ts, FUERA de las superficies concedidas de
//     esta tarea: en vez de editarlo, el plan emite una nota que nombra los
//     dos archivos para que el operador corra ese cableado cuando conceda la
//     superficie; sin --icon el FALLBACK_PROJECT_ICON lo cubre (nota, sin
//     edición).

// Vocabulario cerrado de Project['iconType'] (src/types/index.ts).
const PROJECT_ICON_TYPES = Object.freeze(['code', 'gear', 'kernel', 'scan', 'shield']);

// La label se concatena SIN escapar en literales de TS/JSX: comillas,
// backslashes, brackets o caracteres de control romperían los archivos (misma
// guard que R3-tag-literals, aplicado a la label).
const LABEL_UNSAFE_RE = /['"\\<>{}\u0000-\u001f]/;

/** Find the balanced block opened by the LAST char of `decl` (quote- and comment-aware). */
function findDeclBlock(source, decl, openCh, closeCh) {
  const match = decl.exec(source);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  if (source[open] !== openCh) return null;
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
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return { open, close: i };
    }
  }
  return null;
}

/** The balanced [...] block opened AT `open` (quote/comment-aware), with entries. */
function arrayBlockAt(source, open) {
  const block = findDeclBlockAt(source, open, '[', ']');
  return block === null ? null : { ...block, entries: scanEntries(source, open + 1, block.close) };
}

function findDeclBlockAt(source, open, openCh, closeCh) {
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
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return { open, close: i };
    }
  }
  return null;
}

/** Every [...] region of the source (nested ones included, flagged `nested`). */
function findAllArrayBlocks(source) {
  const blocks = [];
  for (let i = 0; i < source.length; i += 1) {
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
    if (ch !== '[') continue;
    let depth = 0;
    let nested = false;
    let close = -1;
    for (let j = i; j < source.length; j += 1) {
      const c = source[j];
      if (c === "'" || c === '"') {
        j = skipString(source, j);
        continue;
      }
      if (c === '/' && source[j + 1] === '/') {
        const nl = source.indexOf('\n', j);
        j = nl < 0 ? source.length : nl;
        continue;
      }
      if (c === '/' && source[j + 1] === '*') {
        const end = source.indexOf('*/', j + 2);
        j = end < 0 ? source.length : end + 1;
        continue;
      }
      if (c === '[') {
        depth += 1;
        if (depth > 1) nested = true;
      } else if (c === ']') {
        depth -= 1;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close < 0) continue;
    blocks.push({ open: i, close, entries: scanEntries(source, i + 1, close), nested });
  }
  return blocks;
}

/** The last non-blank line before the line that holds `closer` ({ start, next, text }). */
function prevContentLine(source, closer) {
  let next = lineStartOf(source, closer);
  while (next > 0) {
    const start = lineStartOf(source, next - 1);
    const text = source.slice(start, next - 1);
    if (text.trim() !== '') return { start, next, text };
    next = start;
  }
  return null;
}

/** `line` with a guaranteed trailing comma (before any trailing comment). */
function withTrailingComma(text) {
  const commentAt = text.indexOf('//');
  const code = commentAt < 0 ? text : text.slice(0, commentAt);
  const tail = commentAt < 0 ? '' : text.slice(commentAt);
  if (code.trimEnd().endsWith(',')) return text;
  return code.trimEnd() + ',' + (tail === '' ? '' : ' ' + tail.trimEnd());
}

/**
 * Object-literal key for a slug: bare when it is a valid JS identifier, quoted
 * otherwise — `hacker-mentor: …` is invalid TypeScript, `'hacker-mentor': …`
 * is the compiled form (the design's literal bytes assume an identifier).
 */
function objectKey(slug) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(slug) ? slug : `'${slug}'`;
}

/**
 * Append a RAW entry (already formatted, no trailing comma) to an array or
 * object block — line-style blocks get one new line with the block's indent,
 * inline blocks a `, ` token splice. The pin shapes edited here carry object
 * literals and numbers, which the quoted `insertEntry` cannot place.
 */
function appendRawEntry(source, block, raw) {
  const body = source.slice(block.open + 1, block.close);
  if (!body.includes('\n')) {
    const sep = body.trim() === '' ? '' : ', ';
    return source.slice(0, block.close) + sep + raw + source.slice(block.close);
  }
  const last = prevContentLine(source, block.close);
  if (last === null) {
    const indent = indentOfLine(source, block.close) + '  ';
    return source.slice(0, block.close) + indent + raw + ',\n' + source.slice(block.close);
  }
  const line = withTrailingComma(last.text);
  return (
    source.slice(0, last.start) +
    line +
    '\n' +
    indentOfLine(source, last.start) +
    raw +
    ',\n' +
    source.slice(last.next)
  );
}

// El botón de filtro clonado: el ÚLTIMO botón estático de la fila (el onClick
// es exactamente `() => setActiveFilter('<id>')` — el botón dinámico de la
// vista exploradora usa `setActiveFilter(cat)` y el de reseteo tiene cuerpo de
// bloque, ninguno cuenta). Se clona su unidad completa (comentario + botón, o
// el botón solo si no hay comentario) con la separación de línea incluida, y
// se inserta DESPUÉS — así el orden de botones sigue el orden de
// *_FILTER_CATEGORIES también en re-ejecuciones.
const STATIC_FILTER_CLICK_RE = /onClick=\{\(\) => setActiveFilter\('([^']+)'\)\}/;

function findStaticFilterButtons(source) {
  const buttons = [];
  const tagRe = /<button\b/g;
  let match;
  while ((match = tagRe.exec(source)) !== null) {
    const close = source.indexOf('</button>', match.index);
    if (close < 0) continue;
    const end = close + '</button>'.length;
    const click = STATIC_FILTER_CLICK_RE.exec(source.slice(match.index, end));
    if (click === null) continue;
    buttons.push({ start: match.index, end, id: click[1] });
  }
  return buttons;
}

/** Clone the last static filter button for `label`, or null when there is none. */
function cloneLastFilterButton(source, label) {
  const buttons = findStaticFilterButtons(source);
  if (buttons.length === 0) return null;
  const last = buttons[buttons.length - 1];
  const prev = buttons.length > 1 ? buttons[buttons.length - 2] : null;
  let unitStart = lineStartOf(source, last.start);
  if (prev !== null) {
    const nl = source.indexOf('\n', prev.end);
    if (nl >= 0) unitStart = nl + 1;
  }
  const nlEnd = source.indexOf('\n', last.end);
  const unitEnd = nlEnd < 0 ? source.length : nlEnd + 1;
  const unit = source.slice(unitStart, unitEnd);
  if (unit.split('<button').length !== 2 || unit.split('</button>').length !== 2) return null;
  const clone = unit.split(last.id).join(label);
  return source.slice(0, unitEnd) + clone + source.slice(unitEnd);
}

// Arrays de pines de vocabulario: los arrays de filter ids ('TODOS' + labels
// en mayúsculas) y el de `for (const category of [...] as const)` — todos los
// entries son labels en mayúsculas. Los arrays de counts (números) y de groups
// (slugs en minúscula + null) se anclan por su `filterCategories.map(...)`.
const LABEL_VALUE_RE = /^[A-Z0-9ÁÉÍÓÚÜÑ][A-Z0-9ÁÉÍÓÚÜÑ -]*$/;

// ---------------------------------------------------------------------------
// Los editores por archivo. Cada uno devuelve { source } o { problem } — un
// ancla ausente es SIEMPRE problema verbatim (fail-loud, nunca a medias).
// ---------------------------------------------------------------------------

/** src/types/index.ts (certificate): la label entra antes de UDEMY/OFFSEC. */
function editCertTypes(source, { label }) {
  const match = /category\?:\s*'UNIVERSIDAD'[^;]*;/.exec(source);
  if (match === null) {
    return {
      problem:
        `Missing Certification category union in src/types/index.ts: expected the "category?: 'UNIVERSIDAD' …" line.`,
    };
  }
  const members = [...match[0].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
  const templateIndex = members.findIndex((value) => value === 'UDEMY' || value === 'OFFSEC');
  if (templateIndex >= 0) {
    const at = match.index + match[0].indexOf(`'${members[templateIndex]}'`);
    return { source: source.slice(0, at) + `'${label}' | ` + source.slice(at) };
  }
  const at = match.index + match[0].length - 1; // el `;` de cierre
  return { source: source.slice(0, at) + ` | '${label}'` + source.slice(at) };
}

/** `export type X = 'a' | 'b';` → `| 'member'` al final de la unión. */
function appendUnionMember(source, decl, member, problem) {
  const match = decl.exec(source);
  if (match === null) return { problem };
  const at = match.index + match[0].length - 1; // el `;` de cierre
  return { source: source.slice(0, at) + ` | '${member}'` + source.slice(at) };
}

/** src/lib/certificationsModel.ts: 5 anclas (uniones, mapa, filtros, normalize). */
function editCertModel(source, { slug, label }) {
  let out = source;
  let step = appendUnionMember(
    out,
    /export type CertificateGroup = [^;]*;/,
    slug,
    'Missing CertificateGroup union in src/lib/certificationsModel.ts: expected the "export type CertificateGroup = …" line.'
  );
  if (step.problem) return step;
  out = step.source;
  step = appendUnionMember(
    out,
    /export type CertificationGroupLabel = [^;]*;/,
    label,
    'Missing CertificationGroupLabel union in src/lib/certificationsModel.ts: expected the "export type CertificationGroupLabel = …" line.'
  );
  if (step.problem) return step;
  out = step.source;

  const mapBlock = findDeclBlock(out, /CERTIFICATE_GROUP_LABELS\b[^=]*=\s*Object\.freeze\(\s*\{/, '{', '}');
  if (mapBlock === null) {
    return {
      problem:
        'Missing CERTIFICATE_GROUP_LABELS map in src/lib/certificationsModel.ts: expected the Object.freeze({...}) block.',
    };
  }
  out = appendRawEntry(out, mapBlock, `${objectKey(slug)}: '${label}'`);

  const listBlock = findDeclBlock(
    out,
    /CERTIFICATION_FILTER_CATEGORIES\b[^=]*=\s*Object\.freeze\(\s*\[/,
    '[',
    ']'
  );
  if (listBlock === null) {
    return {
      problem:
        'Missing CERTIFICATION_FILTER_CATEGORIES list in src/lib/certificationsModel.ts: expected the Object.freeze([...]) block.',
    };
  }
  out = appendRawEntry(out, listBlock, `Object.freeze({ id: '${label}', group: '${slug}' })`);

  const normalize = /(lower === '[^']*')(\s*\?\s*lower\s*:\s*undefined)/.exec(out);
  if (normalize === null) {
    return {
      problem:
        `Missing normalizeGroup canonical check in src/lib/certificationsModel.ts: expected the "lower === '…' ? lower : undefined" expression.`,
    };
  }
  const at = normalize.index + normalize[1].length;
  return { source: out.slice(0, at) + ` || lower === '${slug}'` + out.slice(at) };
}

/** src/lib/projectsModel.ts: mismo shape que el cert model (Project*). */
function editProjModel(source, { slug, label }) {
  let out = source;
  const unions = [
    [
      /export type ProjectGroup = [^;]*;/,
      slug,
      'Missing ProjectGroup union in src/lib/projectsModel.ts: expected the "export type ProjectGroup = …" line.',
    ],
    [
      /export type ProjectGroupLabel = [^;]*;/,
      label,
      'Missing ProjectGroupLabel union in src/lib/projectsModel.ts: expected the "export type ProjectGroupLabel = …" line.',
    ],
    [
      /export type ProjectFilterId = [^;]*;/,
      label,
      'Missing ProjectFilterId union in src/lib/projectsModel.ts: expected the "export type ProjectFilterId = …" line.',
    ],
  ];
  for (const [decl, member, problem] of unions) {
    const step = appendUnionMember(out, decl, member, problem);
    if (step.problem) return step;
    out = step.source;
  }

  const mapBlock = findDeclBlock(out, /PROJECT_GROUP_LABELS\b[^=]*=\s*Object\.freeze\(\s*\{/, '{', '}');
  if (mapBlock === null) {
    return {
      problem:
        'Missing PROJECT_GROUP_LABELS map in src/lib/projectsModel.ts: expected the Object.freeze({...}) block.',
    };
  }
  out = appendRawEntry(out, mapBlock, `${objectKey(slug)}: { badge: '${label}', filter: '${label}' }`);

  const listBlock = findDeclBlock(out, /PROJECT_FILTER_CATEGORIES\b[^=]*=\s*Object\.freeze\(\s*\[/, '[', ']');
  if (listBlock === null) {
    return {
      problem:
        'Missing PROJECT_FILTER_CATEGORIES list in src/lib/projectsModel.ts: expected the Object.freeze([...]) block.',
    };
  }
  out = appendRawEntry(out, listBlock, `Object.freeze({ id: '${label}', group: '${slug}' })`);

  const normalize = /(lower === '[^']*')(\s*\?\s*lower\s*:\s*undefined)/.exec(out);
  if (normalize === null) {
    return {
      problem:
        `Missing normalizeGroup canonical check in src/lib/projectsModel.ts: expected the "lower === '…' ? lower : undefined" expression.`,
    };
  }
  const at = normalize.index + normalize[1].length;
  return { source: out.slice(0, at) + ` || lower === '${slug}'` + out.slice(at) };
}

/** El botón de filtro clonado (cert screen). */
function editCertScreen(source, { label }) {
  const out = cloneLastFilterButton(source, label);
  if (out === null) {
    return {
      problem:
        `Missing the 'CISCO' filter button in src/components/CertificationsScreen.tsx: expected the static "onClick={() => setActiveFilter('CISCO')}" button block.`,
    };
  }
  return { source: out };
}

/** El botón de filtro clonado (project screen). */
function editProjScreen(source, { label }) {
  const out = cloneLastFilterButton(source, label);
  if (out === null) {
    return {
      problem:
        `Missing the 'AUTOMATIZACIÓN' filter button in src/components/ProjectsScreen.tsx: expected the static "onClick={() => setActiveFilter('AUTOMATIZACIÓN')}" button block.`,
    };
  }
  return { source: out };
}

/**
 * Los pines del suite del modelo (certifications/projects-model.test.ts):
 * mapa de labels (requerido para certificate, opcional para project — ese
 * suite no lo pinea), arrays de filter ids, arrays de groups y arrays de
 * counts (+1 cero honesto: ningún fixture usa el grupo nuevo).
 */
function editModelTestPins(file, mapPinRequired, mapPinProblem) {
  return (source, { slug, label }) => {
    let out = source;
    const pinBlock = findDeclBlock(out, /(CERTIFICATE|PROJECT)_GROUP_LABELS\)\.toEqual\(\s*\{/, '{', '}');
    if (pinBlock !== null) {
      out = appendRawEntry(out, pinBlock, `${objectKey(slug)}: '${label}'`);
    } else if (mapPinRequired) {
      return { problem: mapPinProblem };
    }

    // Arrays de filter ids / del loop de categorías: todos sus entries son
    // labels en mayúsculas → se les appende la label nueva.
    const labelBlocks = findAllArrayBlocks(out).filter(
      (block) =>
        !block.nested &&
        block.entries.length >= 2 &&
        block.entries.every((entry) => LABEL_VALUE_RE.test(entry.value))
    );
    if (labelBlocks.length === 0) {
      return { problem: `Missing filter-id pins in ${file}: expected at least one [...] array of filter ids.` };
    }
    for (let i = labelBlocks.length - 1; i >= 0; i -= 1) {
      out = insertEntry(out, labelBlocks[i], label, labelBlocks[i].entries.length);
    }

    // Arrays de groups (filterCategories.map((c) => c.group)) → append slug.
    const groupAt = [...out.matchAll(/filterCategories\.map\(\(c\) => c\.group\)\)\.toEqual\(\s*\[/g)].map(
      (match) => match.index + match[0].length - 1
    );
    if (groupAt.length === 0) {
      return {
        problem: `Missing filter-group pins in ${file}: expected at least one filterCategories.map((c) => c.group)).toEqual([...]) array.`,
      };
    }
    for (let i = groupAt.length - 1; i >= 0; i -= 1) {
      const block = arrayBlockAt(out, groupAt[i]);
      if (block === null) {
        return {
          problem: `Missing filter-group pins in ${file}: expected at least one filterCategories.map((c) => c.group)).toEqual([...]) array.`,
        };
      }
      out = insertEntry(out, block, slug, block.entries.length);
    }

    // Arrays de counts (filterCategories.map((c) => c.count)) → +1 cero.
    const countAt = [...out.matchAll(/filterCategories\.map\(\(c\) => c\.count\)\)\.toEqual\(\s*\[/g)].map(
      (match) => match.index + match[0].length - 1
    );
    if (countAt.length === 0) {
      return {
        problem: `Missing filter-count pins in ${file}: expected at least one filterCategories.map((c) => c.count)).toEqual([...]) array.`,
      };
    }
    for (let i = countAt.length - 1; i >= 0; i -= 1) {
      const block = arrayBlockAt(out, countAt[i]);
      if (block === null) {
        return {
          problem: `Missing filter-count pins in ${file}: expected at least one filterCategories.map((c) => c.count)).toEqual([...]) array.`,
        };
      }
      out = appendRawEntry(out, block, '0');
    }
    return { source: out };
  };
}

/**
 * tests/content-kinds-api.test.ts: la expectation de get{Certificate,
 * Project}Groups() gana `{ id: '<slug>', count: 0 }` (cero honesto) y el
 * número incrustado en el título del test se reescribe al total real.
 */
function editGroupsApiTest(source, { kind, slug }) {
  const fn = kind === 'certificate' ? 'getCertificateGroups' : 'getProjectGroups';
  const missing = `Missing ${fn}() expectation in tests/content-kinds-api.test.ts: expected the expect(groups).toEqual([...]) block.`;
  let out = source;

  const titleAt = out.indexOf(`it('${fn}(`);
  if (titleAt < 0) return { problem: `Missing ${fn}() test in tests/content-kinds-api.test.ts: expected the "it('${fn}(…)" block.` };
  const regionEnd = (text, from) => {
    const at = text.indexOf("\n  it(", from);
    const end = text.indexOf("\n});", from);
    const candidates = [at, end].filter((value) => value >= 0);
    return candidates.length === 0 ? text.length : Math.min(...candidates);
  };
  const expMatch = /toEqual\(\s*\[/.exec(out.slice(titleAt, regionEnd(out, titleAt)));
  if (expMatch === null) return { problem: missing };
  const block = arrayBlockAt(out, titleAt + expMatch.index + expMatch[0].length - 1);
  if (block === null) return { problem: missing };
  const total = (out.slice(block.open, block.close).match(/\{\s*id:\s*'/g) ?? []).length + 1;
  out = appendRawEntry(out, block, `{ id: '${slug}', count: 0 }`);

  // El título incrusta el número ("all N canonical groups") — se reescribe al
  // total derivado de la expectation, nunca a un número fijo.
  const after = out.indexOf(`it('${fn}(`);
  const end = regionEnd(out, after);
  const region = out.slice(after, end);
  if (/all \d+ canonical groups/.test(region)) {
    out = out.slice(0, after) + region.replace(/all \d+ canonical groups/, `all ${total} canonical groups`) + out.slice(end);
  }
  return { source: out };
}

/** El badge de categoría cubierto por la rama default — nota, nunca edición. */
const badgeDefaultNote = (screen) => (label) =>
  `getCategoryBadgeStyle (${screen}) is untouched: its default branch already covers "${label}".`;

/**
 * The wiring plan per kind: ordered target files, one editor each.
 *
 * @typedef {object} GroupWiringInput
 * @property {'project' | 'certificate'} kind whose UI wiring is planned
 * @property {string} slug group slug (^ [a-z][a-z0-9-]* $)
 * @property {string} [label] UI label; defaults to the slug uppercased
 * @property {Record<string, string>} sources raw texts by repository-relative file name
 * @property {string} [icon] project iconType; with it the icon wiring is
 *   deferred by note (its two files are outside the granted edit surfaces)
 */
const GROUP_WIRING_SPECS = Object.freeze({
  certificate: Object.freeze({
    files: Object.freeze([
      'src/types/index.ts',
      'src/lib/certificationsModel.ts',
      'src/components/CertificationsScreen.tsx',
      'tests/certifications-model.test.ts',
      'tests/content-kinds-api.test.ts',
    ]),
    edit: Object.freeze({
      'src/types/index.ts': editCertTypes,
      'src/lib/certificationsModel.ts': editCertModel,
      'src/components/CertificationsScreen.tsx': editCertScreen,
      'tests/certifications-model.test.ts': editModelTestPins(
        'tests/certifications-model.test.ts',
        true,
        'Missing CERTIFICATE_GROUP_LABELS pin in tests/certifications-model.test.ts: expected the expect(CERTIFICATE_GROUP_LABELS).toEqual({...}) block.'
      ),
      'tests/content-kinds-api.test.ts': editGroupsApiTest,
    }),
    badgeNote: badgeDefaultNote('src/components/CertificationsScreen.tsx'),
  }),
  project: Object.freeze({
    files: Object.freeze([
      'src/lib/projectsModel.ts',
      'src/components/ProjectsScreen.tsx',
      'tests/projects-model.test.ts',
      'tests/content-kinds-api.test.ts',
    ]),
    edit: Object.freeze({
      'src/lib/projectsModel.ts': editProjModel,
      'src/components/ProjectsScreen.tsx': editProjScreen,
      'tests/projects-model.test.ts': editModelTestPins(
        'tests/projects-model.test.ts',
        false,
        ''
      ),
      'tests/content-kinds-api.test.ts': editGroupsApiTest,
    }),
    badgeNote: badgeDefaultNote('src/components/ProjectsScreen.tsx'),
  }),
});

/**
 * Plan the UI wiring of one project/certificate group: every anchor the group
 * needs beyond its vocabulary registration (planGroupAddition) — type unions,
 * models, ONE cloned filter button and the test pins — so registering a group
 * leaves ZERO pending work (T5, human decision: "el script lo escribe todo").
 *
 * Pure and synchronous. Throws only for an unknown kind (verbatim
 * `Unknown content kind: …`); every semantic problem — including a MISSING
 * ANCHOR — is collected verbatim into `problems` and then `files` stays EMPTY
 * (fail-loud, never a partial result). Idempotent: files that already mention
 * the slug/label are skipped; when every anchor already has the group the plan
 * is `files: []` + the single note `already wired` (running twice duplicates
 * nothing).
 *
 * @param {GroupWiringInput} input the plain inputs
 * @returns {RegistryPlan} problems/files/notes (see typedef)
 */
export function planGroupWiring({ kind, slug, label, sources, icon }) {
  const spec = GROUP_WIRING_SPECS[kind];
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
  const effectiveLabel =
    typeof label === 'string' && label.trim() !== '' ? label.trim() : typeof slug === 'string' ? slug.toUpperCase() : '';
  if (effectiveLabel !== '' && LABEL_UNSAFE_RE.test(effectiveLabel)) {
    problems.push(
      `Invalid group label: expected a value without quotes, backslashes, angle brackets, braces or control characters, got ${shown(effectiveLabel)}.`
    );
  }
  if (icon !== undefined) {
    if (kind !== 'project') {
      problems.push(`Invalid group icon: --icon applies only to project groups, got ${shown(icon)}.`);
    } else if (!PROJECT_ICON_TYPES.includes(icon)) {
      problems.push(
        `Invalid project icon: expected one of ${PROJECT_ICON_TYPES.map(shown).join(', ')}, got ${shown(icon)}.`
      );
    }
  }
  if (problems.length > 0) return { problems, files: [], notes };

  const ctx = { kind, slug, label: effectiveLabel, icon };
  const files = [];
  for (const name of spec.files) {
    const source = sources === null || sources === undefined ? undefined : sources[name];
    if (typeof source !== 'string') {
      problems.push(`Missing source text for ${name}: expected its raw source in the sources map.`);
      continue;
    }
    // Idempotencia por PRESENCIA (misma regla que auditGroupUi): un archivo
    // que ya menciona el grupo está cableado y no se toca dos veces.
    if (mentionsSlug(source, slug) || mentionsSlug(source, effectiveLabel)) continue;
    const result = spec.edit[name](source, ctx);
    if (result.problem !== undefined) {
      problems.push(result.problem);
      continue;
    }
    files.push({ name, source: result.source });
  }

  if (problems.length > 0) return { problems, files: [], notes };
  if (files.length === 0) return { problems: [], files: [], notes: ['already wired'] };

  notes.push(spec.badgeNote(effectiveLabel));
  if (kind === 'project') {
    if (icon === undefined) {
      notes.push(
        `no --icon for "${slug}": the project card icon falls back to FALLBACK_PROJECT_ICON ("shield") — no icon edit.`
      );
    } else {
      notes.push(
        `icon "${icon}" is deferred (outside the granted edit surfaces): add "${objectKey(slug)}: '${icon}'" to PROJECT_ICON_BY_GROUP in src/lib/contentAdapter.ts and its pin line in tests/ui-content-adapter.test.ts when those surfaces are granted.`
      );
    }
  }
  return { problems: [], files, notes };
}

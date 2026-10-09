// Registry planner contract: the pure, synchronous motor behind the future
// scripts/registry.js CLI (R1/T2). It plans the edits to the repo's CLOSED
// registries — writeup platforms, per-kind tag vocabularies and project/
// certificate groups — taking PLAIN source texts in and returning the NEW
// source texts plus collected problems, so one CLI step updates the
// implementation AND its approval pin together.
//
// Honesty rules under test (odd/tasks/registry.md, human decisions):
//   - Tag validation (rule 1): empty/whitespace-padded tags are problems; a tag
//     already in that kind's list is a problem naming BOTH values; the per-kind
//     vocabularies are independent (a value used by another kind is fine).
//   - Insertion position (rule 2): TAGS/APPROVED_TAGS insert alphabetically
//     (same comparator as this suite: localeCompare('en')); PROJECT_TAGS,
//     CERTIFICATE_TAGS, PROJECT_GROUPS, CERTIFICATE_GROUPS and their pins
//     append at the end (approved order preserved). After any plan the lib
//     list and its pin list hold the same values at every index — the
//     invariant that keeps the taxonomy suite's toEqual green. NOTE: the
//     APPROVED_TAGS pin is deliberately stored in historical approval order
//     ('Buffer Overflow' before 'Broken Authentication') and its own suite
//     compares `[...APPROVED_TAGS].sort(byAlphabet)`, so for the writeup pair
//     the invariant is asserted against the pin AS THAT SUITE COMPARES IT
//     (sorted); the added entry still lands at the same raw index in both.
//   - Platform (rules 3-4): name ^[a-z0-9][a-z0-9-]*$; icon one of
//     wave|server|network|database|bug (problem listing the vocabulary
//     otherwise); `bug` is allowed but pushes a NON-BLOCKING note; an already
//     registered platform is a problem. The plan adds the map entry before the
//     closing '});' of WRITEUP_ICON_BY_PLATFORM and one expect line right
//     before the '// Unknown platform → documented fallback.' pin anchor.
//   - Group (rule 5): slug ^[a-z][a-z0-9-]*$, label defaults to the slug
//     uppercased, appends to PROJECT_GROUPS/CERTIFICATE_GROUPS AND the matching
//     APPROVED_*_GROUPS pin at the SAME index; duplicate slug is a problem.
//   - auditGroupUi (rule 6) only REPORTS which UI files already mention the
//     slug (pending + one-line hint vs ready); it never edits those sources.
//   - The module is pure: no node: imports, no process, synchronous,
//     deterministic and inputs untouched (source-scan + purity tests below).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  auditGroupUi,
  planGroupAddition,
  planGroupWiring,
  planPlatformAddition,
  planTagAddition,
} from '../lib/registry.js';

// Real registry sources (the exact anchors the plans edit).
const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const taxonomySource = read('../lib/taxonomy.js');
const taxonomyPinSource = read('./taxonomy.test.ts');
const kindsSource = read('../lib/content-kinds.js');
const adapterSource = read('../src/lib/contentAdapter.ts');
const adapterPinSource = read('./ui-content-adapter.test.ts');
// Real UI wiring targets (planGroupWiring, T5 — "el script lo escribe todo").
const typesSource = read('../src/types/index.ts');
const certModelSource = read('../src/lib/certificationsModel.ts');
const certScreenSource = read('../src/components/CertificationsScreen.tsx');
const certModelTestSource = read('./certifications-model.test.ts');
const contentKindsApiTestSource = read('./content-kinds-api.test.ts');
const projModelSource = read('../src/lib/projectsModel.ts');
const projScreenSource = read('../src/components/ProjectsScreen.tsx');
const projModelTestSource = read('./projects-model.test.ts');

// planGroupWiring input maps (file name -> real source text).
const certSources = {
  'src/types/index.ts': typesSource,
  'src/lib/certificationsModel.ts': certModelSource,
  'src/components/CertificationsScreen.tsx': certScreenSource,
  'tests/certifications-model.test.ts': certModelTestSource,
  'tests/content-kinds-api.test.ts': contentKindsApiTestSource,
};
const projSources = {
  'src/lib/projectsModel.ts': projModelSource,
  'src/components/ProjectsScreen.tsx': projScreenSource,
  'tests/projects-model.test.ts': projModelTestSource,
  'tests/content-kinds-api.test.ts': contentKindsApiTestSource,
};

/** Locate a planned file's new source by name (clear failure when missing). */
function byName(files: { name: string; source: string }[], name: string): string {
  const file = files.find((entry) => entry.name === name);
  expect(file, `planned file ${name}`).toBeDefined();
  return file!.source;
}

// ---------------------------------------------------------------------------
// Test helpers: parse a `const NAME = [ … ]` array literal out of a source text
// (comment-aware, quote-aware) so the position invariants can be asserted on
// the OUTPUTS. No eval anywhere — plain text assertions only.
// ---------------------------------------------------------------------------

/** Quoted entries of the array literal declared by `decl`. */
function listEntries(source: string, decl: RegExp): string[] {
  return listBlock(source, decl).map((entry) => entry.value);
}

interface EntryToken {
  value: string;
  start: number;
  end: number;
}

function listBlock(source: string, decl: RegExp): EntryToken[] {
  const match = decl.exec(source);
  if (!match) throw new Error(`list declaration not found: ${decl}`);
  const open = source.indexOf('[', match.index);
  if (open < 0) throw new Error(`array literal not found for: ${decl}`);
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
      if (depth === 0) return scanEntries(source, open + 1, i);
    }
  }
  throw new Error(`unterminated array literal for: ${decl}`);
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  return i;
}

function scanEntries(source: string, from: number, to: number): EntryToken[] {
  const entries: EntryToken[] = [];
  let i = from;
  while (i < to) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      const start = i;
      const end = skipString(source, i);
      entries.push({ value: source.slice(start + 1, end), start, end: end + 1 });
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

const byAlphabet = (a: string, b: string) => a.localeCompare(b, 'en');

/**
 * Rule 2 invariant: after a plan the lib list and its pin list hold the same
 * length AND the same value at every index — what keeps `toEqual` green in
 * tests/taxonomy.test.ts (order-sensitive for the approved-order lists).
 */
/**
 * The inline list literal with `value` appended, rebuilt FROM THE SOURCE GIVEN
 * — never from an assumed vocabulary (the real lists grow with every
 * legitimate registration; a fixed expectation is what broke this suite).
 */
function expectedInlineList(entries: string[], value: string): string {
  return `[${[...entries, value].map((entry) => `'${entry}'`).join(', ')}]`;
}

/**
 * The element count of every `c.count)).toEqual([...])` pin array in a source
 * (comments stripped) — the wiring grows each one by exactly one honest 0.
 */
function countArrayLengths(source: string): number[] {
  const stripped = source.replace(/\/\/[^\n]*/g, '');
  return [...stripped.matchAll(/c\.count\)\)\.toEqual\(\s*(\[[^\]]*\])/g)].map(
    (match) => match[1].split(',').filter((part) => part.trim() !== '').length
  );
}

/** The `all N canonical groups` number embedded in one api test title. */
function titleGroupCount(source: string, fn: 'getCertificateGroups' | 'getProjectGroups'): number {
  const match = new RegExp(`${fn}\\(\\) returns all (\\d+) canonical groups`).exec(source);
  expect(match, `${fn} title`).not.toBeNull();
  return Number(match![1]);
}

function expectAlignedAtEveryIndex(libEntries: string[], pinEntries: string[]): void {
  expect(libEntries).toHaveLength(pinEntries.length);
  expect(libEntries).toEqual(pinEntries);
  libEntries.forEach((value, index) => {
    expect(pinEntries[index]).toBe(value); // same value at every index
  });
}

const declLib = (name: string) =>
  new RegExp(`export\\s+const\\s+${name}\\s*=\\s*Object\\.freeze\\s*\\(\\s*\\[`);
const declPin = (name: string) => new RegExp(`const\\s+${name}\\s*=\\s*\\[`);

// ---------------------------------------------------------------------------
// T1/T2 fixture sources: small but COMPLETE texts for the pin rewrites a tag
// addition owes every validation list (count pin, the three intersection
// pins) plus the structural group×tag invariant anchors. `null` omits a
// declaration on purpose (the missing-anchor tests).
// ---------------------------------------------------------------------------

type FixtureLists = {
  tags?: string[] | null;
  projectTags?: string[] | null;
  certificateTags?: string[] | null;
};

function fixtureTaxonomy(lists: FixtureLists = {}): string {
  // NOTE: `null` OMITS the declaration; `undefined` falls back to the default.
  const tags = lists.tags === undefined ? ['Alpha', 'Beta'] : lists.tags;
  const projectTags = lists.projectTags === undefined ? ['Networking', 'Web'] : lists.projectTags;
  const certificateTags = lists.certificateTags === undefined ? ['Pivoting', 'Cloud'] : lists.certificateTags;
  const decl = (name: string, values: string[] | null): string | null =>
    values === null ? null : `export const ${name} = Object.freeze([${values.map((v) => `"${v}"`).join(', ')}]);`;
  return (
    [decl('TAGS', tags), decl('PROJECT_TAGS', projectTags), decl('CERTIFICATE_TAGS', certificateTags)]
      .filter((line) => line !== null)
      .join('\n') + '\n'
  );
}

const fixturePinParts: Record<string, string> = {
  approvedTags: "const APPROVED_TAGS = ['Alpha', 'Beta'];",
  approvedProjectTags: "const APPROVED_PROJECT_TAGS = ['Networking', 'Web'];",
  approvedCertificateTags: "const APPROVED_CERTIFICATE_TAGS = ['Pivoting', 'Cloud'];",
  approvedProjectGroups: "const APPROVED_PROJECT_GROUPS = ['scripts', 'herramientas'];",
  approvedCertificateGroups: "const APPROVED_CERTIFICATE_GROUPS = ['universidad'];",
  countTags: 'expect(TAGS).toHaveLength(2);',
  countProjectTags: 'expect(PROJECT_TAGS).toHaveLength(2);',
  countCertificateTags: 'expect(CERTIFICATE_TAGS).toHaveLength(2);',
  interTagsProject: 'expect(valuesInCommon(TAGS, PROJECT_TAGS)).toEqual([]);',
  interTagsCertificate: 'expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual([]);',
  interProjectCertificate: 'expect(valuesInCommon(PROJECT_TAGS, CERTIFICATE_TAGS)).toEqual([]);',
};

/** The fixture pin with the named parts removed (missing-anchor tests). */
const fixturePin = (omit: string[] = []): string =>
  Object.entries(fixturePinParts)
    .filter(([key]) => !omit.includes(key))
    .map(([, line]) => line)
    .join('\n') + '\n';

// ---------------------------------------------------------------------------
// planTagAddition — rule 1: tag validation (problems verbatim, no edits)
// ---------------------------------------------------------------------------

describe('planTagAddition — tag validation (rule 1)', () => {
  it('rejects empty and whitespace-padded tags with the pinned problem, planning no files', () => {
    for (const tag of ['', '   ', ' Exposure ', '\tExposure']) {
      const plan = planTagAddition({ kind: 'writeup', tag, taxonomySource, pinSource: taxonomyPinSource });
      expect(plan.problems).toEqual([
        `Invalid tag: expected a non-empty, non-whitespace-padded string, got ${JSON.stringify(tag)}.`,
      ]);
      expect(plan.files).toEqual([]);
    }
  });

  it('rejects a tag already in that kind’s list case-insensitively, naming BOTH values', () => {
    const writeupPlan = planTagAddition({
      kind: 'writeup',
      tag: 'sql injection',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(writeupPlan.problems).toEqual([
      'Duplicate tag in writeup tag vocabulary: "sql injection" is already used by "SQL Injection".',
    ]);
    expect(writeupPlan.files).toEqual([]);

    const projectPlan = planTagAddition({
      kind: 'project',
      tag: 'web',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(projectPlan.problems).toEqual([
      'Duplicate tag in project tag vocabulary: "web" is already used by "Web".',
    ]);
    expect(projectPlan.files).toEqual([]);
  });

  it('treats the per-kind vocabularies as independent (cross-kind use is NOT a problem)', () => {
    // 'Web' is a PROJECT_TAGS value but not in the writeup TAGS.
    const webForWriteups = planTagAddition({
      kind: 'writeup',
      tag: 'Web',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(webForWriteups.problems).toEqual([]);

    // 'Pivoting' lives in TAGS and CERTIFICATE_TAGS but not in PROJECT_TAGS.
    const pivotingForProjects = planTagAddition({
      kind: 'project',
      tag: 'Pivoting',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(pivotingForProjects.problems).toEqual([]);
  });

  it('throws fail-loud on an unknown kind', () => {
    expect(() =>
      planTagAddition({ kind: 'book' as 'writeup', tag: 'Exposure', taxonomySource, pinSource: taxonomyPinSource })
    ).toThrow('Unknown content kind: "book"');
  });
});

// ---------------------------------------------------------------------------
// planTagAddition — rule 2: insertion position + lib/pin position invariant
// ---------------------------------------------------------------------------

describe('planTagAddition — insertion position (rule 2)', () => {
  it('inserts TAGS/APPROVED_TAGS alphabetically and keeps both lists aligned at every index', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Exposure',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([]);

    const libEntries = listEntries(plan.files[0].source, declLib('TAGS'));
    const pinEntries = listEntries(plan.files[1].source, declPin('APPROVED_TAGS'));

    // Alphabetical position in the canonical (sorted) list …
    expect(libEntries[6]).toBe('Exposed Service');
    expect(libEntries[7]).toBe('Exposure');
    expect(libEntries[8]).toBe('File Inclusion');
    expect(libEntries).toEqual([...libEntries].sort(byAlphabet));
    // … and the same raw index in the pin text (it inserts alphabetically too).
    expect(pinEntries[7]).toBe('Exposure');

    // Rule 2 invariant: the pin AS THE TAXONOMY SUITE COMPARES IT (sorted copy)
    // holds the same length and the same value at every index as TAGS.
    expectAlignedAtEveryIndex(libEntries, [...pinEntries].sort(byAlphabet));
    expect([...pinEntries].sort(byAlphabet)).toEqual(libEntries);
  });

  it('appends project tags at the END of both lists (approved order preserved)', () => {
    const plan = planTagAddition({
      kind: 'project',
      tag: 'Exploit Development',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([]);

    const libEntries = listEntries(plan.files[0].source, declLib('PROJECT_TAGS'));
    const pinEntries = listEntries(plan.files[1].source, declPin('APPROVED_PROJECT_TAGS'));

    // Appended last in BOTH lists; the approved order before it is untouched.
    expect(libEntries[libEntries.length - 1]).toBe('Exploit Development');
    expect(pinEntries[pinEntries.length - 1]).toBe('Exploit Development');
    expect(libEntries.slice(0, -1)).toEqual([
      'CLI Utilities', 'Recon', 'OSINT', 'Scanning', 'Networking', 'Web',
      'Cryptography', 'Parsers', 'Integrations', 'Reporting', 'Databases',
    ]);
    // Rule 2 invariant (order-sensitive pin: plain toEqual keeps it green).
    expectAlignedAtEveryIndex(libEntries, pinEntries);
  });

  it('appends certificate tags at the END of both lists (approved order preserved)', () => {
    const plan = planTagAddition({
      kind: 'certificate',
      tag: 'Exploit Development',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([]);

    const libEntries = listEntries(plan.files[0].source, declLib('CERTIFICATE_TAGS'));
    const pinEntries = listEntries(plan.files[1].source, declPin('APPROVED_CERTIFICATE_TAGS'));

    expect(libEntries[libEntries.length - 1]).toBe('Exploit Development');
    expect(pinEntries[pinEntries.length - 1]).toBe('Exploit Development');
    expect(libEntries[libEntries.length - 2]).toBe('Burp Suite');
    // Rule 2 invariant — must hold despite the comment lines inside the pin.
    expectAlignedAtEveryIndex(libEntries, pinEntries);
  });

  it('inserts the new line exactly once per output and keeps the declaration anchors intact', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Exposure',
      taxonomySource,
      pinSource: taxonomyPinSource,
    });
    const [libFile, pinFile] = plan.files;
    expect(libFile.name).toBe('lib/taxonomy.js');
    expect(pinFile.name).toBe('tests/taxonomy.test.ts');

    // (a) exactly once in each output …
    expect(libFile.source.split('"Exposure",').length - 1).toBe(1);
    expect(pinFile.source.split("'Exposure',").length - 1).toBe(1);
    // (b) the declaration anchors still there …
    expect(libFile.source).toContain('Object.freeze([');
    expect(pinFile.source).toContain('const APPROVED_TAGS = [');
    // … and the inserted lines are verbatim siblings of their neighbours.
    expect(libFile.source).toContain('\n  "Exposure",\n');
    expect(pinFile.source).toContain("\n  'Exposure',\n");
    // (c) quoted-entry counts of lib and pin still match.
    expect(listEntries(libFile.source, declLib('TAGS'))).toHaveLength(
      listEntries(pinFile.source, declPin('APPROVED_TAGS')).length
    );
  });
});

// ---------------------------------------------------------------------------
// planTagAddition — missing anchors fail loud (never silently no-op)
// ---------------------------------------------------------------------------

describe('planTagAddition — missing anchors fail loud', () => {
  it('reports the missing pin list instead of planning edits', () => {
    // Fixtures carry every now-required anchor except the pin list under test
    // (T1/T2 made the count/intersection/group pins structural too).
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Exposure',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(['approvedTags']),
    });
    expect(plan.problems).toEqual([
      'Missing APPROVED_TAGS list in tests/taxonomy.test.ts: expected the [...] block.',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('reports the missing lib list too', () => {
    const plan = planTagAddition({
      kind: 'project',
      tag: 'Exploit Development',
      taxonomySource: fixtureTaxonomy({ projectTags: null }),
      pinSource: fixturePin(),
    });
    expect(plan.problems).toEqual([
      'Missing PROJECT_TAGS list in lib/taxonomy.js: expected the [...] block.',
    ]);
    expect(plan.files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planTagAddition — T1/T2: the pin is rewritten for EVERY validation list the
// insertion invalidates (count pin, intersection pins) and a value that would
// break the structural groups×tags invariant pin is rejected fail-loud.
// ---------------------------------------------------------------------------

describe('planTagAddition — pin rewrites every invalidated validation list (T1/T2)', () => {
  it('rewrites the count pin to the NEW list length, leaving the sibling counts alone', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Gamma',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(),
    });
    expect(plan.problems).toEqual([]);
    expect(plan.files).toHaveLength(2);
    const pin = byName(plan.files, 'tests/taxonomy.test.ts');
    expect(pin).toContain('expect(TAGS).toHaveLength(3);');
    expect(pin).toContain('expect(PROJECT_TAGS).toHaveLength(2);'); // untouched
    expect(pin).toContain('expect(CERTIFICATE_TAGS).toHaveLength(2);'); // untouched
    // The rewrite never clobbers the inserted tag: still in BOTH lists.
    expect(listEntries(byName(plan.files, 'lib/taxonomy.js'), declLib('TAGS'))).toContain('Gamma');
    expect(listEntries(pin, declPin('APPROVED_TAGS'))).toContain('Gamma');
  });

  it('rewrites only the intersection pairs whose expected value changes', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Networking',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(),
    });
    expect(plan.problems).toEqual([]);
    const pin = byName(plan.files, 'tests/taxonomy.test.ts');
    // (TAGS, PROJECT_TAGS) changes [] → ['Networking'] and is recomputed …
    expect(pin).toContain("expect(valuesInCommon(TAGS, PROJECT_TAGS)).toEqual(['Networking']);");
    // … the unchanged pairs stay byte-identical.
    expect(pin).toContain("expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual([]);");
    expect(pin).toContain("expect(valuesInCommon(PROJECT_TAGS, CERTIFICATE_TAGS)).toEqual([]);");
  });

  it('orders each rewritten intersection in first-argument order (TRIANGULATE)', () => {
    const taxonomy = fixtureTaxonomy({
      tags: ['Alpha'],
      projectTags: ['Recon', 'Web'],
      certificateTags: ['Web', 'Recon', 'Cloud'],
    });
    const forward = planTagAddition({
      kind: 'project',
      tag: 'Cloud',
      taxonomySource: taxonomy,
      pinSource: fixturePin(),
    });
    expect(forward.problems).toEqual([]);
    expect(byName(forward.files, 'tests/taxonomy.test.ts')).toContain(
      "expect(valuesInCommon(PROJECT_TAGS, CERTIFICATE_TAGS)).toEqual(['Recon', 'Web', 'Cloud']);"
    );

    const swapped = planTagAddition({
      kind: 'project',
      tag: 'Cloud',
      taxonomySource: taxonomy,
      pinSource: fixturePin().replace(
        'expect(valuesInCommon(PROJECT_TAGS, CERTIFICATE_TAGS)).toEqual([]);',
        'expect(valuesInCommon(CERTIFICATE_TAGS, PROJECT_TAGS)).toEqual([]);'
      ),
    });
    expect(swapped.problems).toEqual([]);
    expect(byName(swapped.files, 'tests/taxonomy.test.ts')).toContain(
      "expect(valuesInCommon(CERTIFICATE_TAGS, PROJECT_TAGS)).toEqual(['Web', 'Recon', 'Cloud']);"
    );
  });

  it('leaves an unchanged pair’s line byte-identical even when its literal is stale (TRIANGULATE)', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Gamma',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin().replace(
        'expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual([]);',
        "expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual(['stale']);"
      ),
    });
    expect(plan.problems).toEqual([]);
    expect(byName(plan.files, 'tests/taxonomy.test.ts')).toContain(
      "expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual(['stale']);"
    );
  });

  it('rejects a tag equal to a registered group slug (the groups×tags pin is a structural invariant)', () => {
    const project = planTagAddition({
      kind: 'writeup',
      tag: 'scripts',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(),
    });
    expect(project.problems).toEqual([
      'Tag "scripts" collides with project group "scripts": groups and tag vocabularies must stay disjoint.',
    ]);
    expect(project.files).toEqual([]);

    const certificate = planTagAddition({
      kind: 'certificate',
      tag: 'universidad',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(),
    });
    expect(certificate.problems).toEqual([
      'Tag "universidad" collides with certificate group "universidad": groups and tag vocabularies must stay disjoint.',
    ]);
    expect(certificate.files).toEqual([]);
  });

  it('fails loud when a changed intersection pair has no pin line to rewrite', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Networking',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(['interTagsProject']),
    });
    expect(plan.problems).toEqual([
      'Missing intersection pin in tests/taxonomy.test.ts: expected the "expect(valuesInCommon(TAGS, PROJECT_TAGS)).toEqual([...])" line.',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('fails loud when the APPROVED group arrays are missing from the pin', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Gamma',
      taxonomySource: fixtureTaxonomy(),
      pinSource: fixturePin(['approvedProjectGroups', 'approvedCertificateGroups']),
    });
    expect(plan.problems).toEqual([
      'Missing APPROVED_PROJECT_GROUPS list in tests/taxonomy.test.ts: expected the [...] block.',
      'Missing APPROVED_CERTIFICATE_GROUPS list in tests/taxonomy.test.ts: expected the [...] block.',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('fails loud when a sibling vocabulary the intersection pins evaluate is missing', () => {
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Gamma',
      taxonomySource: fixtureTaxonomy({ projectTags: null }),
      pinSource: fixturePin(),
    });
    expect(plan.problems).toEqual([
      'Missing PROJECT_TAGS list in lib/taxonomy.js: expected the [...] block.',
    ]);
    expect(plan.files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planPlatformAddition — rule 3: validation + the `bug` note
// ---------------------------------------------------------------------------

describe('planPlatformAddition — validation (rule 3)', () => {
  it('rejects names outside ^[a-z0-9][a-z0-9-]*$ with the pinned problem', () => {
    for (const name of ['Hack My VM', '-x', 'X9', 'oscp lab', '']) {
      const plan = planPlatformAddition({ name, icon: 'wave', adapterSource, pinSource: adapterPinSource });
      expect(plan.problems).toEqual([
        `Invalid platform name: expected /^[a-z0-9][a-z0-9-]*$/, got ${JSON.stringify(name)}.`,
      ]);
      expect(plan.files).toEqual([]);
    }
  });

  it('rejects icons outside the closed vocabulary, listing the vocabulary', () => {
    const plan = planPlatformAddition({
      name: 'oscp',
      icon: 'skull' as 'wave',
      adapterSource,
      pinSource: adapterPinSource,
    });
    expect(plan.problems).toEqual([
      'Invalid platform icon: expected one of "wave", "server", "network", "database", "bug", got "skull".',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('allows the fallback icon `bug` but pushes a NON-BLOCKING note (files still planned)', () => {
    const plan = planPlatformAddition({
      name: 'oscp',
      icon: 'bug',
      adapterSource,
      pinSource: adapterPinSource,
    });
    expect(plan.problems).toEqual([]);
    expect(plan.notes).toEqual([
      'Platform "oscp" uses the fallback icon "bug": indistinguishable from unregistered platforms in the UI.',
    ]);
    expect(plan.files).toHaveLength(2); // note never blocks the plan
  });

  it('reports re-registering an existing platform/icon pair as "already registered"', () => {
    const plan = planPlatformAddition({
      name: 'hackmyvm',
      icon: 'wave',
      adapterSource,
      pinSource: adapterPinSource,
    });
    expect(plan.problems).toEqual([
      'Platform "hackmyvm" is already registered with icon "wave".',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('refuses a re-register that would change the icon too (never a duplicate key)', () => {
    const plan = planPlatformAddition({
      name: 'hackmyvm',
      icon: 'server',
      adapterSource,
      pinSource: adapterPinSource,
    });
    expect(plan.problems).toEqual([
      'Platform "hackmyvm" is already registered with icon "wave".',
    ]);
    expect(plan.files).toEqual([]);
  });

  it('fails loud when the adapter map or the pin anchor is missing', () => {
    const noMap = planPlatformAddition({
      name: 'oscp',
      icon: 'wave',
      adapterSource: 'const OTHER = Object.freeze({});\n',
      pinSource: adapterPinSource,
    });
    expect(noMap.problems).toEqual([
      'Missing WRITEUP_ICON_BY_PLATFORM map in src/lib/contentAdapter.ts: expected the {...} block.',
    ]);
    expect(noMap.files).toEqual([]);

    const noAnchor = planPlatformAddition({
      name: 'oscp',
      icon: 'wave',
      adapterSource,
      pinSource: 'describe("x", () => {});\n',
    });
    expect(noAnchor.problems).toEqual([
      'Missing platform pin anchor in tests/ui-content-adapter.test.ts: expected the "// Unknown platform → documented fallback." line.',
    ]);
    expect(noAnchor.files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planPlatformAddition — rule 4: the exact edits
// ---------------------------------------------------------------------------

describe('planPlatformAddition — edits (rule 4)', () => {
  const plan = planPlatformAddition({
    name: 'oscp',
    icon: 'wave',
    adapterSource,
    pinSource: adapterPinSource,
  });

  it('names the two files it edits (adapter map + documented-map pin block)', () => {
    expect(plan.files.map((file) => file.name)).toEqual([
      'src/lib/contentAdapter.ts',
      'tests/ui-content-adapter.test.ts',
    ]);
  });

  it('adds the map entry before the closing `});` of WRITEUP_ICON_BY_PLATFORM', () => {
    expect(plan.files[0].source).toContain("  vulnhub: 'database',\n  oscp: 'wave',\n});");
    expect(plan.files[0].source.split("oscp: 'wave',").length - 1).toBe(1);
  });

  it('adds one expect line right before the `// Unknown platform → documented fallback.` anchor', () => {
    const line =
      "    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'oscp' }).iconType).toBe('wave');";
    expect(plan.files[1].source).toContain(`${line}\n    // Unknown platform → documented fallback.`);
    expect(plan.files[1].source.split("platform: 'oscp'").length - 1).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// planPlatformAddition — hyphenated names need a QUOTED map key (both sides:
// the insertion must quote it AND findIconMap must parse quoted keys so a
// re-run still reports the duplicate instead of planning a second entry).
// ---------------------------------------------------------------------------

// Fixture adapter source: the map decl + close the planner edits, with one
// identifier-key entry and an optional pre-existing `entry` line.
const fixturePlatformAdapter = (entry = ''): string =>
  `export const WRITEUP_ICON_BY_PLATFORM: Readonly<Record<string, string>> = Object.freeze({\n  hackmyvm: 'wave',\n${entry}});\n`;

describe('planPlatformAddition — quoted keys for hyphenated platforms', () => {
  it('quotes a hyphenated map key and leaves identifier keys bare', () => {
    const hyphen = planPlatformAddition({
      name: 'acme-lab',
      icon: 'wave',
      adapterSource: fixturePlatformAdapter(),
      pinSource: adapterPinSource,
    });
    expect(hyphen.problems).toEqual([]);
    expect(hyphen.files[0].source).toContain("  'acme-lab': 'wave',\n});");
    expect(hyphen.files[0].source).not.toContain("acme-lab: 'wave',");

    const bare = planPlatformAddition({
      name: 'acmelab',
      icon: 'wave',
      adapterSource: fixturePlatformAdapter(),
      pinSource: adapterPinSource,
    });
    expect(bare.problems).toEqual([]);
    expect(bare.files[0].source).toContain("  acmelab: 'wave',\n});");
  });

  it('reports the duplicate when a QUOTED key for the platform already exists', () => {
    for (const entry of ["  'acme-lab': 'wave',\n", '  "acme-lab": \'wave\',\n']) {
      const plan = planPlatformAddition({
        name: 'acme-lab',
        icon: 'wave',
        adapterSource: fixturePlatformAdapter(entry),
        pinSource: adapterPinSource,
      });
      expect(plan.problems).toEqual([
        'Platform "acme-lab" is already registered with icon "wave".',
      ]);
      expect(plan.files).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// planGroupAddition — rule 5: slug/label validation, duplicates, position
// ---------------------------------------------------------------------------

describe('planGroupAddition — validation and label (rule 5)', () => {
  it('rejects slugs outside ^[a-z][a-z0-9-]*$ with the pinned problem', () => {
    for (const slug of ['OsCP', '-x', '9lives', 'oscp lab', '']) {
      const plan = planGroupAddition({
        kind: 'project',
        slug,
        kindsSource,
        pinSource: taxonomyPinSource,
      });
      expect(plan.problems).toEqual([
        `Invalid group slug: expected /^[a-z][a-z0-9-]*$/, got ${JSON.stringify(slug)}.`,
      ]);
      expect(plan.files).toEqual([]);
    }
  });

  it('defaults the label to the slug uppercased and keeps an explicit trimmed label', () => {
    const defaulted = planGroupAddition({
      kind: 'project',
      slug: 'oscp-labs',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(defaulted.problems).toEqual([]);
    expect(defaulted.label).toBe('OSCP-LABS');

    const explicit = planGroupAddition({
      kind: 'certificate',
      slug: 'oscp',
      label: '  OSCP Labs  ',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(explicit.problems).toEqual([]);
    expect(explicit.label).toBe('OSCP Labs');
  });

  it('rejects a non-string label with the pinned problem', () => {
    const plan = planGroupAddition({
      kind: 'project',
      slug: 'oscp',
      label: 3 as unknown as string,
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual(['Invalid group label: expected a string, got 3.']);
    expect(plan.files).toEqual([]);
  });

  it('reports a duplicate slug against the kind’s own list', () => {
    const plan = planGroupAddition({
      kind: 'project',
      slug: 'scripts',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([
      'Duplicate group slug: "scripts" is already registered in PROJECT_GROUPS.',
    ]);
    expect(plan.files).toEqual([]);

    // T3: the OTHER kind rejects it too — project and certificate groups must
    // stay disjoint (valuesInCommon(PROJECT_GROUPS, CERTIFICATE_GROUPS) → []).
    const other = planGroupAddition({
      kind: 'certificate',
      slug: 'scripts',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(other.problems).toEqual([
      'Group slug "scripts" is already registered in PROJECT_GROUPS: project and certificate groups must stay disjoint.',
    ]);
    expect(other.files).toEqual([]);
  });

  it('throws fail-loud on a kind without groups', () => {
    expect(() =>
      planGroupAddition({ kind: 'writeup' as 'project', slug: 'oscp', kindsSource, pinSource: taxonomyPinSource })
    ).toThrow('Unknown content kind: "writeup"');
  });

  it('fails loud when a groups list is missing', () => {
    const plan = planGroupAddition({
      kind: 'project',
      slug: 'oscp',
      kindsSource: 'export const CERTIFICATE_GROUPS = Object.freeze([]);\n',
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([
      'Missing PROJECT_GROUPS list in lib/content-kinds.js: expected the [...] block.',
    ]);
    expect(plan.files).toEqual([]);
  });
});

describe('planGroupAddition — edits and position invariant (rule 5)', () => {
  it('appends the project group to PROJECT_GROUPS AND APPROVED_PROJECT_GROUPS at the SAME index', () => {
    const plan = planGroupAddition({
      kind: 'project',
      slug: 'oscp',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([]);
    expect(plan.files.map((file) => file.name)).toEqual([
      'lib/content-kinds.js',
      'tests/taxonomy.test.ts',
    ]);
    // Expectations rebuilt from the sources given (rule: never assume the
    // real vocabulary — it grows with every legitimate registration).
    expect(plan.files[0].source).toContain(
      `Object.freeze(${expectedInlineList(listEntries(kindsSource, declLib('PROJECT_GROUPS')), 'oscp')})`
    );
    expect(plan.files[1].source).toContain(
      `const APPROVED_PROJECT_GROUPS = ${expectedInlineList(listEntries(taxonomyPinSource, declPin('APPROVED_PROJECT_GROUPS')), 'oscp')};`
    );

    // Rule 2/5 invariant: same length + same value at every index.
    expectAlignedAtEveryIndex(
      listEntries(plan.files[0].source, declLib('PROJECT_GROUPS')),
      listEntries(plan.files[1].source, declPin('APPROVED_PROJECT_GROUPS'))
    );
  });

  it('appends the certificate group to CERTIFICATE_GROUPS AND APPROVED_CERTIFICATE_GROUPS at the SAME index', () => {
    const plan = planGroupAddition({
      kind: 'certificate',
      slug: 'oscp',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(plan.problems).toEqual([]);
    expect(plan.files[0].source).toContain(
      `Object.freeze(${expectedInlineList(listEntries(kindsSource, declLib('CERTIFICATE_GROUPS')), 'oscp')})`
    );
    expect(plan.files[1].source).toContain(
      `const APPROVED_CERTIFICATE_GROUPS = ${expectedInlineList(listEntries(taxonomyPinSource, declPin('APPROVED_CERTIFICATE_GROUPS')), 'oscp')};`
    );

    expectAlignedAtEveryIndex(
      listEntries(plan.files[0].source, declLib('CERTIFICATE_GROUPS')),
      listEntries(plan.files[1].source, declPin('APPROVED_CERTIFICATE_GROUPS'))
    );
  });
});

// ---------------------------------------------------------------------------
// planGroupAddition — T3: cross-kind and cross-vocabulary guards (the group
// lists must stay disjoint and groups must never double as tags — the two
// structural invariant pins cannot be updated by insertion, so the planner
// REJECTS the colliding value, even under ifPresent: 'skip').
// ---------------------------------------------------------------------------

describe('planGroupAddition — cross-kind and cross-vocabulary guards (T3)', () => {
  const fixKinds =
    "export const PROJECT_GROUPS = Object.freeze(['scripts', 'herramientas']);\n" +
    "export const CERTIFICATE_GROUPS = Object.freeze(['universidad']);\n";
  const fixPin =
    "const APPROVED_TAGS = ['alpha'];\n" +
    "const APPROVED_PROJECT_TAGS = ['networking'];\n" +
    "const APPROVED_CERTIFICATE_TAGS = ['pivoting'];\n" +
    "const APPROVED_PROJECT_GROUPS = ['scripts', 'herramientas'];\n" +
    "const APPROVED_CERTIFICATE_GROUPS = ['universidad'];\n";

  it('rejects a slug already registered in the OTHER kind’s group list, even with ifPresent: skip', () => {
    const cert = planGroupAddition({
      kind: 'certificate',
      slug: 'scripts',
      kindsSource: fixKinds,
      pinSource: fixPin,
      ifPresent: 'skip',
    });
    expect(cert.problems).toEqual([
      'Group slug "scripts" is already registered in PROJECT_GROUPS: project and certificate groups must stay disjoint.',
    ]);
    expect(cert.files).toEqual([]);

    const proj = planGroupAddition({
      kind: 'project',
      slug: 'universidad',
      kindsSource: fixKinds,
      pinSource: fixPin,
    });
    expect(proj.problems).toEqual([
      'Group slug "universidad" is already registered in CERTIFICATE_GROUPS: project and certificate groups must stay disjoint.',
    ]);
    expect(proj.files).toEqual([]);
  });

  it('rejects a slug equal to a registered tag value in any vocabulary', () => {
    // The tag values must be valid slugs too (^ [a-z][a-z0-9-]* $) to reach
    // the guard — the pin’s valuesInCommon(groups, tags) is case-sensitive.
    const cases = [
      ['alpha', 'writeup'],
      ['networking', 'project'],
      ['pivoting', 'certificate'],
    ] as const;
    for (const [slug, tagKind] of cases) {
      const plan = planGroupAddition({ kind: 'project', slug, kindsSource: fixKinds, pinSource: fixPin });
      expect(plan.problems, slug).toEqual([
        `Group slug ${JSON.stringify(slug)} collides with ${tagKind} tag ${JSON.stringify(slug)}: groups and tag vocabularies must stay disjoint.`,
      ]);
      expect(plan.files).toEqual([]);
    }
  });

  it('fails loud when the other kind’s group list or an APPROVED tag array is missing', () => {
    const noOther = planGroupAddition({
      kind: 'project',
      slug: 'zz-probe',
      kindsSource: "export const PROJECT_GROUPS = Object.freeze(['scripts']);\n",
      pinSource: fixPin,
    });
    expect(noOther.problems).toEqual([
      'Missing CERTIFICATE_GROUPS list in lib/content-kinds.js: expected the [...] block.',
    ]);
    expect(noOther.files).toEqual([]);

    const noTagPins = planGroupAddition({
      kind: 'project',
      slug: 'zz-probe',
      kindsSource: fixKinds,
      pinSource: "const APPROVED_PROJECT_GROUPS = [];\nconst APPROVED_CERTIFICATE_GROUPS = [];\n",
    });
    expect(noTagPins.problems).toEqual([
      'Missing APPROVED_TAGS list in tests/taxonomy.test.ts: expected the [...] block.',
      'Missing APPROVED_PROJECT_TAGS list in tests/taxonomy.test.ts: expected the [...] block.',
      'Missing APPROVED_CERTIFICATE_TAGS list in tests/taxonomy.test.ts: expected the [...] block.',
    ]);
    expect(noTagPins.files).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// planGroupWiring — T5: "el script lo escribe todo" (UI wiring, zero pending)
// ---------------------------------------------------------------------------

describe('planGroupWiring — certificate UI wiring (T5)', () => {
  const slug = 'oscp-labs';

  it('wires every certificate anchor: type union, model, ONE screen button and both test pins', () => {
    const plan = planGroupWiring({ kind: 'certificate', slug, sources: certSources });
    expect(plan.problems).toEqual([]);
    expect(plan.files.map((file) => file.name)).toEqual([
      'src/types/index.ts',
      'src/lib/certificationsModel.ts',
      'src/components/CertificationsScreen.tsx',
      'tests/certifications-model.test.ts',
      'tests/content-kinds-api.test.ts',
    ]);

    // 1. src/types/index.ts: the label joins the pipeline part, IMMEDIATELY
    //    BEFORE the template-only UDEMY/OFFSEC values (whatever the pipeline
    //    part holds today).
    expect(byName(plan.files, 'src/types/index.ts')).toContain(`'OSCP-LABS' | 'UDEMY'`);

    // 2. src/lib/certificationsModel.ts: group union, label union, labels map
    //    (after cisco), filter categories (after the CISCO entry) and the
    //    normalizeGroup canonical check.
    const model = byName(plan.files, 'src/lib/certificationsModel.ts');
    expect(model).toContain(`| 'oscp-labs';`);
    expect(model).toContain(`| 'OSCP-LABS';`);
    expect(model).toContain(`'oscp-labs': 'OSCP-LABS',`);
    expect(model).toContain(`Object.freeze({ id: 'OSCP-LABS', group: 'oscp-labs' }),`);
    expect(model).toContain(`|| lower === 'oscp-labs'`);

    // 3. ONE filter button cloned from the CISCO block (label + activeFilter
    //    id only); getCategoryBadgeStyle is NOT touched (default covers it).
    const screen = byName(plan.files, 'src/components/CertificationsScreen.tsx');
    expect(screen.split(`setActiveFilter('OSCP-LABS')`).length - 1).toBe(1);
    expect(screen).toContain(`<span>OSCP-LABS</span>`);
    expect(screen).toContain(`setActiveFilter('CISCO')`); // the clone source stays
    expect(screen).toContain('getCategoryBadgeStyle'); // untouched, still present

    // 4-5. The two test pins: label map, filter ids arrays, count arrays and
    //      the getCertificateGroups() expectation + its embedded count.
    const modelTest = byName(plan.files, 'tests/certifications-model.test.ts');
    expect(modelTest).toContain(`'oscp-labs': 'OSCP-LABS',`);
    expect(modelTest).toContain(`'oscp-labs',`); // the filter-groups array
    expect(modelTest).toContain(`'OSCP-LABS',`); // the filter-id arrays
    // Every count pin array gains exactly one honest 0 (derived, never fixed).
    expect(countArrayLengths(modelTest)).toEqual(
      countArrayLengths(certModelTestSource).map((length) => length + 1)
    );
    const apiTest = byName(plan.files, 'tests/content-kinds-api.test.ts');
    // The title count is rewritten to the derived total; the SIBLING kind stays
    // byte-identical to the source given.
    expect(apiTest).toContain(
      `getCertificateGroups() returns all ${titleGroupCount(contentKindsApiTestSource, 'getCertificateGroups') + 1} canonical groups`
    );
    expect(apiTest).toContain(`{ id: 'oscp-labs', count: 0 },`);
    expect(apiTest).toContain(
      `getProjectGroups() returns all ${titleGroupCount(contentKindsApiTestSource, 'getProjectGroups')} canonical groups`
    );

    // The badge default is a plan note, never an edit.
    expect(plan.notes.some((note) => note.includes('getCategoryBadgeStyle'))).toBe(true);
  });

  it('defaults the label to the slug uppercased and honors an explicit trimmed label', () => {
    const explicit = planGroupWiring({
      kind: 'certificate',
      slug,
      label: '  OSCP Labs  ',
      sources: certSources,
    });
    expect(explicit.problems).toEqual([]);
    expect(byName(explicit.files, 'src/types/index.ts')).toContain(`'OSCP Labs' | 'UDEMY'`);
    expect(byName(explicit.files, 'src/components/CertificationsScreen.tsx')).toContain(`<span>OSCP Labs</span>`);

    const defaulted = planGroupWiring({ kind: 'certificate', slug, sources: certSources });
    expect(byName(defaulted.files, 'src/lib/certificationsModel.ts')).toContain(`'oscp-labs': 'OSCP-LABS',`);
  });

  it('fails loud with a verbatim problem per missing anchor and plans NO file (never a partial result)', () => {
    const noTypes = planGroupWiring({
      kind: 'certificate',
      slug,
      sources: { ...certSources, 'src/types/index.ts': 'export interface Certification {}\n' },
    });
    expect(noTypes.files).toEqual([]);
    expect(noTypes.problems).toEqual([
      `Missing Certification category union in src/types/index.ts: expected the "category?: 'UNIVERSIDAD' …" line.`,
    ]);

    const noButton = planGroupWiring({
      kind: 'certificate',
      slug,
      sources: { ...certSources, 'src/components/CertificationsScreen.tsx': 'const x = 1;\n' },
    });
    expect(noButton.files).toEqual([]);
    expect(noButton.problems).toEqual([
      `Missing the 'CISCO' filter button in src/components/CertificationsScreen.tsx: expected the static "onClick={() => setActiveFilter('CISCO')}" button block.`,
    ]);
  });

  it('is idempotent: re-planning over its own output reports "already wired" and plans zero files', () => {
    const first = planGroupWiring({ kind: 'certificate', slug, sources: certSources });
    const wired = Object.fromEntries(first.files.map((file) => [file.name, file.source]));
    const second = planGroupWiring({ kind: 'certificate', slug, sources: wired });
    expect(second.problems).toEqual([]);
    expect(second.files).toEqual([]);
    expect(second.notes).toEqual(['already wired']);
  });

  it('validates slug and label (the label is spliced into sources: no quotes/backslashes/brackets)', () => {
    const badSlug = planGroupWiring({ kind: 'certificate', slug: 'OsCP', sources: certSources });
    expect(badSlug.problems).toEqual([
      `Invalid group slug: expected /^[a-z][a-z0-9-]*$/, got "OsCP".`,
    ]);
    expect(badSlug.files).toEqual([]);

    const badLabel = planGroupWiring({ kind: 'certificate', slug, label: "bad'quote", sources: certSources });
    expect(badLabel.files).toEqual([]);
    expect(badLabel.problems).toEqual([
      `Invalid group label: expected a value without quotes, backslashes, angle brackets, braces or control characters, got "bad'quote".`,
    ]);
  });
});

describe('planGroupWiring — project UI wiring (T5)', () => {
  const slug = 'oscp-labs';

  it('wires the project model, ONE screen button and the test pins (no icon → fallback note)', () => {
    const plan = planGroupWiring({ kind: 'project', slug, sources: projSources });
    expect(plan.problems).toEqual([]);
    expect(plan.files.map((file) => file.name)).toEqual([
      'src/lib/projectsModel.ts',
      'src/components/ProjectsScreen.tsx',
      'tests/projects-model.test.ts',
      'tests/content-kinds-api.test.ts',
    ]);

    const model = byName(plan.files, 'src/lib/projectsModel.ts');
    expect(model).toContain(`| 'oscp-labs';`);
    expect(model).toContain(`| 'OSCP-LABS';`);
    expect(model).toContain(`'oscp-labs': { badge: 'OSCP-LABS', filter: 'OSCP-LABS' },`);
    expect(model).toContain(`Object.freeze({ id: 'OSCP-LABS', group: 'oscp-labs' }),`);
    expect(model).toContain(`|| lower === 'oscp-labs'`);

    const screen = byName(plan.files, 'src/components/ProjectsScreen.tsx');
    expect(screen.split(`setActiveFilter('OSCP-LABS')`).length - 1).toBe(1);
    expect(screen).toContain(`<span>OSCP-LABS</span>`);
    expect(screen).toContain(`setActiveFilter('AUTOMATIZACIÓN')`); // clone source stays

    const modelTest = byName(plan.files, 'tests/projects-model.test.ts');
    expect(modelTest).toContain(`'oscp-labs',`); // the filter-groups array
    expect(modelTest).toContain(`'OSCP-LABS',`); // the filter-id arrays
    expect(countArrayLengths(modelTest)).toEqual(
      countArrayLengths(projModelTestSource).map((length) => length + 1)
    );
    const apiTest = byName(plan.files, 'tests/content-kinds-api.test.ts');
    expect(apiTest).toContain(
      `getProjectGroups() returns all ${titleGroupCount(contentKindsApiTestSource, 'getProjectGroups') + 1} canonical groups`
    );
    expect(apiTest).toContain(`{ id: 'oscp-labs', count: 0 },`);
    expect(apiTest).toContain(
      `getCertificateGroups() returns all ${titleGroupCount(contentKindsApiTestSource, 'getCertificateGroups')} canonical groups`
    ); // sibling untouched

    // Without --icon the documented FALLBACK_PROJECT_ICON covers the group.
    expect(plan.notes.some((note) => note.includes('FALLBACK_PROJECT_ICON'))).toBe(true);
  });

  it('with an explicit icon, requires the icon-map sources too (missing → fail-loud, never a silent skip)', () => {
    const missing = planGroupWiring({ kind: 'project', slug, icon: 'gear', sources: projSources });
    expect(missing.files).toEqual([]);
    expect(missing.problems).toEqual([
      'Missing source text for src/lib/contentAdapter.ts: expected its raw source in the sources map.',
      'Missing source text for tests/ui-content-adapter.test.ts: expected its raw source in the sources map.',
    ]);
  });

  it('rejects an unknown project icon and --icon on certificate groups', () => {
    const badIcon = planGroupWiring({ kind: 'project', slug, icon: 'nope', sources: projSources });
    expect(badIcon.files).toEqual([]);
    expect(badIcon.problems).toEqual([
      `Invalid project icon: expected one of "code", "gear", "kernel", "scan", "shield", got "nope".`,
    ]);

    const certIcon = planGroupWiring({ kind: 'certificate', slug, icon: 'gear', sources: certSources });
    expect(certIcon.files).toEqual([]);
    expect(certIcon.problems).toEqual([
      `Invalid group icon: --icon applies only to project groups, got "gear".`,
    ]);
  });

  it('is idempotent for the project kind too', () => {
    const first = planGroupWiring({ kind: 'project', slug, sources: projSources });
    const wired = Object.fromEntries(first.files.map((file) => [file.name, file.source]));
    const second = planGroupWiring({ kind: 'project', slug, sources: wired });
    expect(second.problems).toEqual([]);
    expect(second.files).toEqual([]);
    expect(second.notes).toEqual(['already wired']);
  });
});

// ---------------------------------------------------------------------------
// planGroupWiring — T4: project --icon ACTUALLY writes the icon map entry
// (PROJECT_ICON_BY_GROUP in src/lib/contentAdapter.ts) and its pin line in
// tests/ui-content-adapter.test.ts. The old "deferred" note is gone.
// ---------------------------------------------------------------------------

describe('planGroupWiring — project --icon writes the icon map and its pin (T4)', () => {
  const slug = 'oscp-labs';
  const projIconSources = {
    ...projSources,
    'src/lib/contentAdapter.ts': adapterSource,
    'tests/ui-content-adapter.test.ts': adapterPinSource,
  };

  it('additionally plans the icon map entry (key quoted for hyphen slugs) and the pin expect line', () => {
    const plan = planGroupWiring({ kind: 'project', slug, icon: 'gear', sources: projIconSources });
    expect(plan.problems).toEqual([]);
    expect(plan.files.map((file) => file.name)).toEqual([
      'src/lib/projectsModel.ts',
      'src/components/ProjectsScreen.tsx',
      'tests/projects-model.test.ts',
      'tests/content-kinds-api.test.ts',
      'src/lib/contentAdapter.ts',
      'tests/ui-content-adapter.test.ts',
    ]);

    const adapter = byName(plan.files, 'src/lib/contentAdapter.ts');
    expect(adapter).toContain("\n  'oscp-labs': 'gear',\n});");
    expect(adapter.split("'oscp-labs': 'gear',").length - 1).toBe(1);

    const pin = byName(plan.files, 'tests/ui-content-adapter.test.ts');
    expect(pin).toContain(
      "    expect(toUiProject({ ...BARE_PROJECT_ENTRY, group: 'oscp-labs' }, 1).iconType).toBe('gear');\n" +
        '    // Missing or unknown group → documented fallback.'
    );
    expect(pin.split("group: 'oscp-labs'").length - 1).toBe(1);

    // The old "deferred (outside the granted edit surfaces)" note is gone.
    expect(plan.notes.join('\n')).not.toContain('deferred');
  });

  it('quotes the map key only for non-identifier slugs (TRIANGULATE)', () => {
    const plan = planGroupWiring({ kind: 'project', slug: 'smoketest', icon: 'gear', sources: projIconSources });
    expect(plan.problems).toEqual([]);
    expect(byName(plan.files, 'src/lib/contentAdapter.ts')).toContain("\n  smoketest: 'gear',\n});");
  });

  it('without --icon plans neither icon file and keeps the FALLBACK_PROJECT_ICON note', () => {
    const plan = planGroupWiring({ kind: 'project', slug, sources: projIconSources });
    expect(plan.problems).toEqual([]);
    expect(plan.files.map((file) => file.name)).toEqual([
      'src/lib/projectsModel.ts',
      'src/components/ProjectsScreen.tsx',
      'tests/projects-model.test.ts',
      'tests/content-kinds-api.test.ts',
    ]);
    expect(plan.notes.some((note) => note.includes('FALLBACK_PROJECT_ICON'))).toBe(true);
    expect(plan.notes.join('\n')).not.toContain('deferred');
  });

  it('skips icon files that already mention the group and ends at `already wired`', () => {
    const first = planGroupWiring({ kind: 'project', slug, icon: 'gear', sources: projIconSources });
    const wired = Object.fromEntries(first.files.map((file) => [file.name, file.source]));

    // The map already has the entry → that file is skipped, the rest still planned.
    const partial = planGroupWiring({
      kind: 'project',
      slug,
      icon: 'gear',
      sources: { ...projIconSources, 'src/lib/contentAdapter.ts': wired['src/lib/contentAdapter.ts'] },
    });
    expect(partial.problems).toEqual([]);
    expect(partial.files.map((file) => file.name)).not.toContain('src/lib/contentAdapter.ts');
    expect(partial.files.map((file) => file.name)).toContain('tests/ui-content-adapter.test.ts');

    // Everything wired → `already wired`, zero files (running twice duplicates nothing).
    const second = planGroupWiring({ kind: 'project', slug, icon: 'gear', sources: { ...projIconSources, ...wired } });
    expect(second.problems).toEqual([]);
    expect(second.files).toEqual([]);
    expect(second.notes).toEqual(['already wired']);
  });

  it('fails loud on a missing PROJECT_ICON_BY_GROUP map or pin anchor', () => {
    const noMap = planGroupWiring({
      kind: 'project',
      slug,
      icon: 'gear',
      sources: { ...projIconSources, 'src/lib/contentAdapter.ts': 'const OTHER = Object.freeze({});\n' },
    });
    expect(noMap.files).toEqual([]);
    expect(noMap.problems).toEqual([
      'Missing PROJECT_ICON_BY_GROUP map in src/lib/contentAdapter.ts: expected the {...} block.',
    ]);

    const noAnchor = planGroupWiring({
      kind: 'project',
      slug,
      icon: 'gear',
      sources: { ...projIconSources, 'tests/ui-content-adapter.test.ts': 'describe("x", () => {});\n' },
    });
    expect(noAnchor.files).toEqual([]);
    expect(noAnchor.problems).toEqual([
      'Missing project icon pin anchor in tests/ui-content-adapter.test.ts: expected the "// Missing or unknown group → documented fallback." line.',
    ]);
  });
});

// ---------------------------------------------------------------------------
// auditGroupUi — rule 6: reports, never edits
// ---------------------------------------------------------------------------

describe('auditGroupUi — pending/ready with one-line hints (rule 6)', () => {
  const sources = {
    certModel: "export const CERTIFICATE_GROUP_LABELS = Object.freeze({ universidad: 'UNIVERSIDAD' });",
    projModel: 'export const PROJECT_GROUP_LABELS = Object.freeze({ scripts: {} });',
    certScreen: 'const isUni = cert.category === \'UNIVERSIDAD\';',
    projScreen: '{model.filterCategories.map(({ id: cat }) => (',
    adapter: "PROJECT_ICON_BY_GROUP = Object.freeze({ scripts: 'code' })",
    certModelTest: "expect(CERTIFICATE_GROUP_LABELS).toEqual({ universidad: 'UNIVERSIDAD' });",
    projModelTest: 'expect(model.filterCategories.map((c) => c.count)).toEqual([1]);',
  };

  it('puts every file that still lacks the slug into pending with a one-line hint', () => {
    const before = structuredClone(sources);
    const { pending, ready } = auditGroupUi({ slug: 'oscp', sources });

    expect(ready).toEqual([]);
    expect(pending).toEqual([
      {
        file: 'src/lib/certificationsModel.ts',
        hint: "add 'oscp' to CERTIFICATE_GROUP_LABELS and CERTIFICATION_FILTER_CATEGORIES",
      },
      {
        file: 'src/lib/projectsModel.ts',
        hint: "add 'oscp' to PROJECT_GROUP_LABELS and PROJECT_FILTER_CATEGORIES",
      },
      {
        file: 'src/components/CertificationsScreen.tsx',
        hint: "add a filter button for 'oscp'",
      },
      {
        file: 'src/components/ProjectsScreen.tsx',
        hint: "add a filter button for 'oscp'",
      },
      {
        file: 'src/lib/contentAdapter.ts',
        hint: "add 'oscp' to PROJECT_ICON_BY_GROUP",
      },
      {
        file: 'tests/certifications-model.test.ts',
        hint: "add 'oscp' to the CERTIFICATE_GROUP_LABELS and filter-count pins",
      },
      {
        file: 'tests/projects-model.test.ts',
        hint: "add 'oscp' to the PROJECT_GROUP_LABELS and filter-count pins",
      },
    ]);
    expect(sources).toEqual(before); // never edits the audited sources
  });

  it('detects the slug case-insensitively and moves present files to ready', () => {
    // 'UNIVERSIDAD' (the screen label) counts as the 'universidad' slug, and a
    // hyphenated sibling name does NOT count as the shorter slug.
    const { pending, ready } = auditGroupUi({
      slug: 'universidad',
      sources: {
        ...sources,
        certModel: "labels: { universidad: 'UNIVERSIDAD' }",
        certScreen: "onClick={() => setActiveFilter('UNIVERSIDAD')}",
        adapter: "const x = 'universidad-lab';",
      },
    });

    expect(ready).toEqual([
      'src/lib/certificationsModel.ts',
      'src/components/CertificationsScreen.tsx',
      'tests/certifications-model.test.ts', // its pins mention the existing group
    ]);
    expect(pending.map((entry) => entry.file)).toEqual([
      'src/lib/projectsModel.ts',
      'src/components/ProjectsScreen.tsx',
      'src/lib/contentAdapter.ts', // 'universidad-lab' is a different token
      'tests/projects-model.test.ts',
    ]);
    // pending entries always carry their one-line hint.
    for (const entry of pending) expect(entry.hint).toContain("'universidad'");
  });
});

// ---------------------------------------------------------------------------
// Purity (rule 7): no node builtins, sync, deterministic, inputs untouched
// ---------------------------------------------------------------------------

describe('registry — purity', () => {
  it('imports no node builtin (no fs/path/process access in the module source)', () => {
    const source = readFileSync(new URL('../lib/registry.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"](?:node:)?(?:fs|path|os|child_process|url)['"]/);
    expect(source).not.toMatch(/require\s*\(/);
    expect(source).not.toMatch(/\bprocess\./);
  });

  it('planGroupWiring is pure and synchronous too: same output twice, inputs untouched', () => {
    const input = {
      kind: 'certificate' as const,
      slug: 'oscp-labs',
      sources: certSources,
    };
    const before = structuredClone(input);
    const first = planGroupWiring(input);
    const second = planGroupWiring(input);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.files).not.toBe(second.files);
    expect(input).toEqual(before);
  });

  it('is pure and synchronous: same output twice, inputs untouched', () => {
    const input = {
      kind: 'writeup' as const,
      tag: 'Exposure',
      taxonomySource,
      pinSource: taxonomyPinSource,
    };
    const before = structuredClone(input);

    const first = planTagAddition(input);
    const second = planTagAddition(input);

    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.files).not.toBe(second.files); // fresh output objects
    expect(input).toEqual(before);

    const groupInput = {
      kind: 'project' as const,
      slug: 'oscp',
      kindsSource,
      pinSource: taxonomyPinSource,
    };
    const groupBefore = structuredClone(groupInput);
    const groupPlan = planGroupAddition(groupInput);
    expect(groupPlan).not.toBeInstanceOf(Promise);
    expect(groupInput).toEqual(groupBefore);

    const uiSources = {
      certModel: "cert: 'oscp'",
      projModel: 'x',
      certScreen: 'x',
      projScreen: 'x',
      adapter: 'x',
      certModelTest: 'x',
      projModelTest: 'x',
    };
    const uiBefore = structuredClone(uiSources);
    expect(auditGroupUi({ slug: 'oscp', sources: uiSources })).toEqual(
      auditGroupUi({ slug: 'oscp', sources: uiSources })
    );
    expect(uiSources).toEqual(uiBefore);
  });
});

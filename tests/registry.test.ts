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
    const plan = planTagAddition({
      kind: 'writeup',
      tag: 'Exposure',
      taxonomySource: 'export const TAGS = Object.freeze([\n  "Access Control Bypass",\n]);\n',
      pinSource: 'const APPROVED_PROJECT_TAGS = [];\n',
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
      taxonomySource: 'export const TAGS = Object.freeze([]);\n',
      pinSource: 'const APPROVED_PROJECT_TAGS = [];\n',
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

    // The same slug is fine for the OTHER kind (independent classifiers).
    const other = planGroupAddition({
      kind: 'certificate',
      slug: 'scripts',
      kindsSource,
      pinSource: taxonomyPinSource,
    });
    expect(other.problems).toEqual([]);
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
    expect(plan.files[0].source).toContain(
      "Object.freeze(['scripts', 'automatizaciones', 'herramientas', 'oscp'])"
    );
    expect(plan.files[1].source).toContain(
      "const APPROVED_PROJECT_GROUPS = ['scripts', 'automatizaciones', 'herramientas', 'oscp'];"
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
      "Object.freeze(['universidad', 'hack4u', 'cisco', 'oscp'])"
    );
    expect(plan.files[1].source).toContain(
      "const APPROVED_CERTIFICATE_GROUPS = ['universidad', 'hack4u', 'cisco', 'oscp'];"
    );

    expectAlignedAtEveryIndex(
      listEntries(plan.files[0].source, declLib('CERTIFICATE_GROUPS')),
      listEntries(plan.files[1].source, declPin('APPROVED_CERTIFICATE_GROUPS'))
    );
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
        hint: "add a filter button and a getCategoryBadgeStyle case for 'oscp'",
      },
      {
        file: 'src/components/ProjectsScreen.tsx',
        hint: "add a getCategoryBadgeStyle case for the 'oscp' label",
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

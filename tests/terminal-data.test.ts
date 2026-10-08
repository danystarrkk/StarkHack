// Terminal data contract: the pure, synchronous row builders behind the
// terminal modal's content commands (writeups, projects, certs). They take
// RAW content-pipeline entries (public/index.json items, typed by the
// repo-root lib/content.ts API) and return exactly the rows the terminal
// commands render — through the EXISTING contentAdapter mappers, never
// duplicating mapping logic.
//
// Honesty rules under test (same family as tests/projects-model.test.ts):
//   - Every displayed field comes from the real pipeline (title, platform,
//     date, tags, group). Template-only fields with no pipeline source
//     (os, difficulty, ports, stars, issuer, ...) never appear on a row —
//     never invented, never placeholder.
//   - The group label is the documented deterministic map from the real
//     group (the SAME closed vocabulary/labels the /projects and
//     /certifications screens use — projectsModel/certificationsModel),
//     looked up case-insensitively. A missing or non-canonical group gets NO
//     label — never an invented one.
//   - Empty input returns an EXPLICIT empty-state row (the honest "sin ...
//     todavía" sentence the terminal prints) — never fake entries.
//   - `date` on certificates is OPTIONAL in the pipeline and must never be
//     fabricated (R3-cert-date-fabricated family).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CERTIFICATES_EMPTY_ROW,
  PROJECTS_EMPTY_ROW,
  TERMINAL_WRITEUP_COUNT,
  WRITEUPS_EMPTY_ROW,
  buildTerminalCertificateLines,
  buildTerminalProjectLines,
  buildTerminalWriteupLines,
  type TerminalCertificateRow,
  type TerminalProjectRow,
  type TerminalWriteupRow,
} from '../src/lib/terminalData';
import type { ContentIndexItem, WriteupIndexItem } from '../types';

// Real writeup entry shapes (public/index.json items of kind 'writeup'; the
// generator guarantees title, date and platform).
const WAVE: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'wave',
  path: '/writeups/hackmyvm/wave.md',
  title: 'Wave',
  date: '2026-09-15',
  platform: 'HackMyVM',
  description: 'Writeup de la máquina Wave en HackMyVM.',
  tags: ['File Upload', 'Privilege Escalation'],
  image: '/writeups/hackmyvm/wave/media/cover.webp',
};

const FLOSSY: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'flossy',
  path: '/writeups/hackmyvm/flossy.md',
  title: 'Flossy',
  date: '2026-06-27',
  platform: 'hackmyvm',
  tags: ['Access Control Bypass', 'CVE-2021-4034'],
};

// Minimum a validated writeup can be: no description, no tags, no image.
const MINIMAL: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'minimal',
  path: '/writeups/tryhackme/minimal.md',
  title: 'Minimal',
  date: '2026-01-01',
  platform: 'TryHackMe',
};

const WRITEUPS: WriteupIndexItem[] = [WAVE, FLOSSY, MINIMAL];

// Real project entry shapes (public/index.json items of kind 'project').
const AUTORECON: ContentIndexItem = {
  kind: 'project',
  slug: 'autorecon-ng',
  path: '/projects/autorecon-ng.md',
  title: 'AutoRecon-NG',
  date: '2026-09-15',
  description: 'Suite modular de reconocimiento multihilo.',
  tags: ['Python 3', 'AsyncIO'],
  group: 'herramientas',
};

const SHCRAWLER: ContentIndexItem = {
  kind: 'project',
  slug: 'shcrawler',
  path: '/projects/shcrawler.md',
  title: 'ShCrawler',
  date: '2026-07-02',
  tags: ['Go'],
  group: 'scripts',
};

const TGSFORGE: ContentIndexItem = {
  kind: 'project',
  slug: 'tgsforge',
  path: '/projects/tgsforge.md',
  title: 'TGS-Forge',
  date: '2026-03-11',
  group: 'automatizaciones',
};

// Group matching is case-insensitive against the canonical vocabulary.
const UPPER: ContentIndexItem = {
  kind: 'project',
  slug: 'upper',
  path: '/projects/upper.md',
  title: 'Upper',
  date: '2026-02-02',
  group: 'SCRIPTS',
};

// Minimum a validated project can be: no group, no date, no tags.
const NOGROUP: ContentIndexItem = {
  kind: 'project',
  slug: 'nogroup',
  path: '/projects/nogroup.md',
  title: 'NoGroup Tool',
};

// Non-canonical group (no pipeline source): never a label.
const WEIRD: ContentIndexItem = {
  ...NOGROUP,
  slug: 'weird',
  path: '/projects/weird.md',
  title: 'Weird',
  group: 'exploits',
};

const PROJECTS: ContentIndexItem[] = [AUTORECON, SHCRAWLER, TGSFORGE, UPPER, NOGROUP, WEIRD];

// Real certificate entry shapes (public/index.json items of kind
// 'certificate'; the generator validates `order`, `date` is OPTIONAL).
const GRADO: ContentIndexItem = {
  kind: 'certificate',
  slug: 'grado-informatica',
  path: '/certificates/grado-informatica.md',
  title: 'Cursando Grado en Ingeniería Informática',
  order: 1,
  group: 'universidad',
  date: '2023-09-01',
};

const HACK4U: ContentIndexItem = {
  kind: 'certificate',
  slug: 'hacking-etico',
  path: '/certificates/hacking-etico.md',
  title: 'Hacking Ético desde Cero',
  order: 2,
  group: 'hack4u',
  // NO date: certificates may omit it and it must never be invented.
};

const CISCO: ContentIndexItem = {
  kind: 'certificate',
  slug: 'ccna',
  path: '/certificates/ccna.md',
  title: 'CCNA: Introduction to Networks',
  order: 3,
  group: 'CISCO',
};

const CERTS_NOWEIRD: ContentIndexItem = {
  kind: 'certificate',
  slug: 'weird-cert',
  path: '/certificates/weird-cert.md',
  title: 'Weird Cert',
  order: 4,
  group: 'udemy',
};

const CERTIFICATES: ContentIndexItem[] = [GRADO, HACK4U, CISCO, CERTS_NOWEIRD];

// Template-only fields: none may ever appear on a terminal row.
const TEMPLATE_ONLY_WRITEUP_FIELDS = [
  'os',
  'ports',
  'difficulty',
  'vulnerabilities',
  'points',
  'ipAddress',
  'author',
  'readTime',
  'machineLinks',
  'toolLinks',
  'steps',
  'userFlag',
  'rootFlag',
];

const TEMPLATE_ONLY_PROJECT_FIELDS = [
  'tagCategory',
  'version',
  'isNew',
  'statusBadge',
  'subBadge',
  'stars',
  'forks',
  'releaseVersion',
  'githubUrl',
  'readme',
  'codeSnippet',
  'projectLinks',
  'toolLinks',
];

const TEMPLATE_ONLY_CERTIFICATE_FIELDS = [
  'issuer',
  'version',
  'statusBadge',
  'subBadge',
  'statValue',
  'year',
  'issueDate',
  'badgeId',
  'pdfUrl',
];

const writeupRows = (lines: ReturnType<typeof buildTerminalWriteupLines>): TerminalWriteupRow[] =>
  lines.filter((line): line is TerminalWriteupRow => line.kind === 'writeup');

describe('buildTerminalWriteupLines — rows carry ONLY real pipeline fields', () => {
  it('maps real fields through toUiWriteup: title, platform (lowercased), date, tags', () => {
    const lines = buildTerminalWriteupLines([WAVE]);
    expect(lines).toEqual([
      {
        kind: 'writeup',
        id: 'wave',
        title: 'Wave',
        platform: 'hackmyvm', // toUiWriteup's documented platformId lowercasing
        date: '2026-09-15',
        tags: ['File Upload', 'Privilege Escalation'],
      },
    ]);
  });

  it('optional real fields stay ABSENT when the source has none — never placeholders', () => {
    const [row] = writeupRows(buildTerminalWriteupLines([MINIMAL]));
    expect(row).toEqual({
      kind: 'writeup',
      id: 'minimal',
      title: 'Minimal',
      platform: 'tryhackme',
      date: '2026-01-01',
    });
    expect(row).not.toHaveProperty('tags');
  });

  it('template-only fields never appear on a writeup row', () => {
    for (const row of writeupRows(buildTerminalWriteupLines(WRITEUPS))) {
      for (const field of TEMPLATE_ONLY_WRITEUP_FIELDS) {
        expect(row, `${row.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('empty input → the explicit honest empty-state row, never fake entries', () => {
    expect(buildTerminalWriteupLines([])).toEqual([WRITEUPS_EMPTY_ROW]);
    expect(WRITEUPS_EMPTY_ROW).toEqual({ kind: 'empty', text: 'sin writeups publicados todavía' });
  });

  it('is pure and synchronous: deterministic, fresh output, input untouched', () => {
    const before = JSON.parse(JSON.stringify(WRITEUPS));
    const first = buildTerminalWriteupLines(WRITEUPS);
    const second = buildTerminalWriteupLines(WRITEUPS);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(WRITEUPS).toEqual(before); // input untouched
  });
});

describe('buildTerminalProjectLines — title + the real group label', () => {
  it('the group label is the documented closed map (canonical groups only)', () => {
    const rows = buildTerminalProjectLines([AUTORECON, SHCRAWLER, TGSFORGE]);
    expect(rows.map((r) => (r.kind === 'project' ? r.groupLabel : r.kind))).toEqual([
      'HERRAMIENTA',
      'SCRIPT',
      'AUTOMATIZACIÓN',
    ]);
    expect(rows[0]).toMatchObject({ kind: 'project', id: 'autorecon-ng', title: 'AutoRecon-NG' });
  });

  it('the label lookup is case-insensitive against the canonical vocabulary', () => {
    const [row] = buildTerminalProjectLines([UPPER]);
    expect(row).toMatchObject({ kind: 'project', id: 'upper', groupLabel: 'SCRIPT' });
  });

  it('missing or non-canonical group → NO label — never an invented one', () => {
    for (const row of buildTerminalProjectLines([NOGROUP, WEIRD])) {
      if (row.kind !== 'project') throw new Error('expected a project row');
      expect(row).not.toHaveProperty('groupLabel');
    }
  });

  it('the row carries the real date when the source has one, absent when not', () => {
    const [dated, bare] = buildTerminalProjectLines([AUTORECON, NOGROUP]);
    expect(dated).toMatchObject({ kind: 'project', date: '2026-09-15' });
    if (bare.kind !== 'project') throw new Error('expected a project row');
    expect(bare).not.toHaveProperty('date');
  });

  it('template-only fields never appear on a project row (no stars, no tagCategory)', () => {
    for (const row of buildTerminalProjectLines(PROJECTS)) {
      if (row.kind !== 'project') throw new Error('expected a project row');
      for (const field of TEMPLATE_ONLY_PROJECT_FIELDS) {
        expect(row, `${row.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('empty input → the explicit honest empty-state row, never fake entries', () => {
    expect(buildTerminalProjectLines([])).toEqual([PROJECTS_EMPTY_ROW]);
    expect(PROJECTS_EMPTY_ROW).toEqual({ kind: 'empty', text: 'sin proyectos publicados todavía' });
  });

  it('is pure and synchronous: deterministic, fresh output, input untouched', () => {
    const before = JSON.parse(JSON.stringify(PROJECTS));
    const first = buildTerminalProjectLines(PROJECTS);
    const second = buildTerminalProjectLines(PROJECTS);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(PROJECTS).toEqual(before); // input untouched
  });
});

describe('buildTerminalCertificateLines — title + real group + real date', () => {
  it('the group label is the documented closed map (canonical groups only)', () => {
    const rows = buildTerminalCertificateLines([GRADO, HACK4U, CISCO]);
    expect(rows.map((r) => (r.kind === 'certificate' ? r.groupLabel : r.kind))).toEqual([
      'UNIVERSIDAD',
      'HACK4U',
      'CISCO', // case-insensitive lookup over the canonical vocabulary
    ]);
    expect(rows[0]).toMatchObject({
      kind: 'certificate',
      id: 'grado-informatica',
      title: 'Cursando Grado en Ingeniería Informática',
      date: '2023-09-01',
    });
  });

  it('a certificate without a date gets NO date — never invented', () => {
    const [, row] = buildTerminalCertificateLines([GRADO, HACK4U]);
    if (row.kind !== 'certificate') throw new Error('expected a certificate row');
    expect(row).not.toHaveProperty('date');
  });

  it('non-canonical group → NO label — never an invented one (UDEMY/OFFSEC are gone)', () => {
    const [row] = buildTerminalCertificateLines([CERTS_NOWEIRD]);
    if (row.kind !== 'certificate') throw new Error('expected a certificate row');
    expect(row).not.toHaveProperty('groupLabel');
  });

  it('template-only fields never appear on a certificate row (no issuer, no badges)', () => {
    for (const row of buildTerminalCertificateLines(CERTIFICATES)) {
      if (row.kind !== 'certificate') throw new Error('expected a certificate row');
      for (const field of TEMPLATE_ONLY_CERTIFICATE_FIELDS) {
        expect(row, `${row.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('empty input → the explicit honest empty-state row, never fake entries', () => {
    expect(buildTerminalCertificateLines([])).toEqual([CERTIFICATES_EMPTY_ROW]);
    expect(CERTIFICATES_EMPTY_ROW).toEqual({
      kind: 'empty',
      text: 'sin certificaciones publicadas todavía',
    });
  });

  it('is pure and synchronous: deterministic, fresh output, input untouched', () => {
    const before = JSON.parse(JSON.stringify(CERTIFICATES));
    const first = buildTerminalCertificateLines(CERTIFICATES);
    const second = buildTerminalCertificateLines(CERTIFICATES);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(CERTIFICATES).toEqual(before); // input untouched
  });
});

describe('real public/index.json entries', () => {
  const raw: Array<Record<string, unknown>> = JSON.parse(
    readFileSync(new URL('../public/index.json', import.meta.url), 'utf8')
  );
  const writeups = raw.filter((item) => item.kind === 'writeup') as unknown as WriteupIndexItem[];
  const projects = raw.filter((item) => item.kind === 'project') as unknown as ContentIndexItem[];
  const certificates = raw.filter(
    (item) => item.kind === 'certificate'
  ) as unknown as ContentIndexItem[];

  it('is honestly empty for projects/certificates today → explicit empty-state rows', () => {
    expect(projects).toHaveLength(0); // documented current state of the index
    expect(certificates).toHaveLength(0);
    expect(buildTerminalProjectLines(projects)).toEqual([PROJECTS_EMPTY_ROW]);
    expect(buildTerminalCertificateLines(certificates)).toEqual([CERTIFICATES_EMPTY_ROW]);
  });

  it('the 16 real writeups produce rows of real fields only', () => {
    expect(writeups).toHaveLength(16); // documented current state of the index
    const rows = writeupRows(buildTerminalWriteupLines(writeups));
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      for (const field of TEMPLATE_ONLY_WRITEUP_FIELDS) {
        expect(row, `${row.id}.${field}`).not.toHaveProperty(field);
      }
    }
    // Real index data, verbatim.
    expect(rows[0]).toMatchObject({
      id: 'wave',
      title: 'Wave',
      platform: 'hackmyvm',
      date: '2026-09-15',
      tags: [
        'File Upload',
        'Information Disclosure',
        'Misconfiguration',
        'Privilege Escalation',
        'Remote Code Execution',
      ],
    });
    expect(rows.map((r) => r.platform)).toEqual(writeups.map((w) => w.platform.toLowerCase()));
    expect(rows.map((r) => r.date)).toEqual(writeups.map((w) => w.date));
  });

  it('the writeups command keeps the template count: the 3 most recent', () => {
    expect(TERMINAL_WRITEUP_COUNT).toBe(3); // template FEATURED_WRITEUPS length
  });
});

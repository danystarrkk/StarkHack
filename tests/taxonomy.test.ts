import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { assertValidTags, CERTIFICATE_TAGS, PROJECT_TAGS, TAGS } from '../lib/taxonomy.js';
import { CERTIFICATE_GROUPS, KINDS, PROJECT_GROUPS } from '../lib/content-kinds.js';
import { generateIndex } from '../scripts/generate-index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeupsDir = path.join(repoRoot, 'public/writeups');

/**
 * The approved closed taxonomy: exactly these 20 strings.
 *
 * NOTE (ordering decision): the approval block listed "Buffer Overflow" before
 * "Broken Authentication". In true alphabetical order "Broken Authentication"
 * sorts first ("Bro" < "Buf"), so the shipped `TAGS` stores the same 20 strings
 * sorted with `localeCompare('en')`. This list keeps the approved spelling and
 * membership verbatim; the sorted assertion below pins the canonical order.
 */
const APPROVED_TAGS = [
  'Access Control Bypass',
  'Buffer Overflow',
  'Broken Authentication',
  'Business Logic',
  'Container Escape',
  'Credential Exposure',
  'Exposed Service',
  'File Inclusion',
  'File Upload',
  'Information Disclosure',
  'JWT Attack',
  'Misconfiguration',
  'Path Traversal',
  'Pivoting',
  'Privilege Escalation',
  'Remote Code Execution',
  'Server-Side Request Forgery',
  'SQL Injection',
  'Vulnerable Component',
  'XML External Entity',
];

const byAlphabet = (a: string, b: string) => a.localeCompare(b, 'en');

interface RealWriteup {
  /** Repository-relative path of the markdown file, e.g. public/writeups/hackmyvm/wave.md */
  file: string;
  tags: string[];
  cve: unknown;
}

// Reads every real writeup under public/writeups/ and parses it with the same
// frontmatter parser the build-time indexer uses.
function readRealWriteups(): RealWriteup[] {
  const writeups: RealWriteup[] = [];
  for (const entry of fs.readdirSync(writeupsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const platformDir = path.join(writeupsDir, entry.name);
    for (const name of fs.readdirSync(platformDir).filter((f) => f.endsWith('.md'))) {
      const abs = path.join(platformDir, name);
      const { data } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
      writeups.push({
        file: path.relative(repoRoot, abs).split(path.sep).join('/'),
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        cve: data.cve,
      });
    }
  }
  return writeups;
}

describe('TAGS', () => {
  it('is exactly the 20 approved tags, alphabetically sorted, no duplicates, no blank entries', () => {
    // Exactly the approved 20 (same membership, canonical alphabetical order).
    expect(TAGS).toEqual([...APPROVED_TAGS].sort(byAlphabet));
    expect(TAGS).toHaveLength(20);

    // Sorted.
    expect(TAGS).toEqual([...TAGS].sort(byAlphabet));

    // No duplicates.
    expect(new Set(TAGS).size).toBe(TAGS.length);

    // No empty or whitespace-padded entries.
    expect(TAGS.filter((tag) => tag.trim() === '' || tag !== tag.trim())).toEqual([]);
  });
});

describe('writeup tag drift', () => {
  it('every tag of every real writeup under public/writeups/ is in TAGS', () => {
    const offList: string[] = [];
    for (const { file, tags } of readRealWriteups()) {
      for (const tag of tags) {
        if (!TAGS.includes(tag)) offList.push(`${file}: ${tag}`);
      }
    }
    expect(offList).toEqual([]);
  });

  it('every writeup has 4-6 tags, deduplicated and alphabetically sorted', () => {
    const problems: string[] = [];
    for (const { file, tags } of readRealWriteups()) {
      if (tags.length < 4 || tags.length > 6) {
        problems.push(`${file}: ${tags.length} tags (expected 4-6)`);
      }
      if (new Set(tags).size !== tags.length) {
        problems.push(`${file}: duplicate tags: ${tags.join(', ')}`);
      }
      const sorted = [...tags].sort(byAlphabet);
      if (JSON.stringify(tags) !== JSON.stringify(sorted)) {
        problems.push(`${file}: not sorted: ${tags.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('CVE tags are moved into a cve frontmatter key, never into tags', () => {
    const expectedCve: Record<string, string> = {
      'public/writeups/hackmyvm/espo.md': 'CVE-2023-5965',
      'public/writeups/hackmyvm/flossy.md': 'CVE-2021-4034',
      'public/writeups/hackmyvm/realsaga.md': 'CVE-2020-35234',
    };

    const problems: string[] = [];
    for (const { file, tags, cve } of readRealWriteups()) {
      for (const tag of tags) {
        if (/^CVE-/i.test(tag)) problems.push(`${file}: CVE still in tags: ${tag}`);
      }
      const expected = expectedCve[file];
      if (expected !== undefined) {
        if (cve !== expected) problems.push(`${file}: cve is ${JSON.stringify(cve)}, expected ${expected}`);
      } else if (cve !== undefined) {
        problems.push(`${file}: unexpected cve key: ${JSON.stringify(cve)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('assertValidTags', () => {
  it('accepts missing tags, empty tags, and canonical tags', () => {
    expect(() => assertValidTags(undefined, 'ctx')).not.toThrow();
    expect(() => assertValidTags(null, 'ctx')).not.toThrow();
    expect(() => assertValidTags([], 'ctx')).not.toThrow();
    expect(() => assertValidTags([...TAGS], 'ctx')).not.toThrow();
    expect(() => assertValidTags(['SQL Injection', 'Privilege Escalation'], 'ctx')).not.toThrow();
  });

  it('throws naming the context and the offending tag for a non-canonical tag', () => {
    let message = '';
    try {
      assertValidTags(['Privilege Escalation', 'Not A Real Tag'], 'ctx/writeup.md');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('ctx/writeup.md');
    expect(message).toContain('Not A Real Tag');
    expect(() => assertValidTags(['Not A Real Tag'], 'ctx')).toThrow(Error);
  });

  it('rejects non-array tags and blank entries', () => {
    expect(() => assertValidTags('SQL Injection', 'ctx')).toThrow(Error);
    expect(() => assertValidTags([''], 'ctx')).toThrow(Error);
    expect(() => assertValidTags([' SQL Injection'], 'ctx')).toThrow(Error);
  });
});

// ---------------------------------------------------------------------------
// Per-kind classifiers and tag vocabularies (approved extension).
//
// Groups are kind STRUCTURE and live in lib/content-kinds.js; tag vocabularies
// live in lib/taxonomy.js next to the writeup TAGS. Every list below is the
// approved vocabulary VERBATIM (approved order, not alphabetical).
// ---------------------------------------------------------------------------

const APPROVED_PROJECT_TAGS = [
  'CLI Utilities',
  'Recon',
  'OSINT',
  'Scanning',
  'Networking',
  'Web',
  'Cryptography',
  'Parsers',
  'Integrations',
  'Reporting',
  'Databases',
];

const APPROVED_CERTIFICATE_TAGS = [
  'Networking',
  'Cloud',
  'Forensics',
  'Web Security',
  'Cryptography',
  'Systems',
  'Incident Response',
  'Auditing',
  // Extended for certificate content (human decision): OWASP Top 10, Linux,
  // privilege escalation and pivoting are real certificate subjects.
  'OWASP Top 10',
  'Linux',
  'Escalada de privilegios',
  'Pivoting',
  // Second human-approved expansion (decision: real certificate subjects being
  // prepared). Kept verbatim and in the exact order of lib/taxonomy.js — this
  // list IS the approval record.
  'Ethical Hacking',
  'Pentesting',
  'System Administration',
  'Bash',
  'Python',
  'Programming',
  'Security Automation',
  'Automation',
  'Burp Suite',
];

const APPROVED_PROJECT_GROUPS = ['scripts', 'automatizaciones', 'herramientas'];
const APPROVED_CERTIFICATE_GROUPS = ['universidad', 'hack4u', 'cisco'];

const NEW_LISTS: Array<[string, readonly string[]]> = [
  ['PROJECT_TAGS', PROJECT_TAGS],
  ['CERTIFICATE_TAGS', CERTIFICATE_TAGS],
  ['PROJECT_GROUPS', PROJECT_GROUPS],
  ['CERTIFICATE_GROUPS', CERTIFICATE_GROUPS],
];

const valuesInCommon = (a: readonly string[], b: readonly string[]): string[] =>
  a.filter((value) => b.includes(value));

describe('per-kind group lists and tag vocabularies', () => {
  it('holds exactly the approved values, in the approved order', () => {
    expect(PROJECT_TAGS).toEqual(APPROVED_PROJECT_TAGS);
    expect(CERTIFICATE_TAGS).toEqual(APPROVED_CERTIFICATE_TAGS);
    expect(PROJECT_GROUPS).toEqual(APPROVED_PROJECT_GROUPS);
    expect(CERTIFICATE_GROUPS).toEqual(APPROVED_CERTIFICATE_GROUPS);
  });

  it.each(NEW_LISTS)('%s has no duplicates, empty or whitespace-padded entries', (_name, list) => {
    expect(new Set(list).size).toBe(list.length);
    expect(list.filter((entry) => entry.trim() === '' || entry !== entry.trim())).toEqual([]);
    expect(list.every((entry) => typeof entry === 'string')).toBe(true);
  });

  it('keeps every group list disjoint from every tag vocabulary and from the other group list', () => {
    // The two group lists are different classifiers (project categories vs.
    // certificate issuers): project groups are NOT certificate groups.
    expect(valuesInCommon(PROJECT_GROUPS, CERTIFICATE_GROUPS)).toEqual([]);
    expect(PROJECT_GROUPS).not.toEqual(CERTIFICATE_GROUPS);

    // Groups never double as tags, and the writeup TAGS stay out of the other
    // kinds' vocabularies EXCEPT the deliberately approved overlap below.
    const tagVocabularies: Array<[string, readonly string[]]> = [
      ['TAGS', TAGS],
      ['PROJECT_TAGS', PROJECT_TAGS],
      ['CERTIFICATE_TAGS', CERTIFICATE_TAGS],
    ];
    for (const groups of [PROJECT_GROUPS, CERTIFICATE_GROUPS]) {
      for (const [, tags] of tagVocabularies) {
        expect(valuesInCommon(groups, tags)).toEqual([]);
      }
    }
    expect(valuesInCommon(TAGS, PROJECT_TAGS)).toEqual([]);
    // 'Pivoting' is the one approved TAGS↔CERTIFICATE_TAGS overlap: privilege
    // escalation & pivoting are real certificate subjects (human decision),
    // same precedent as 'Networking'/'Cryptography' below. Pinned verbatim.
    expect(valuesInCommon(TAGS, CERTIFICATE_TAGS)).toEqual(['Pivoting']);
  });

  it('keeps PROJECT_TAGS and CERTIFICATE_TAGS as independent vocabularies', () => {
    // NOTE: the two approved vocabularies legitimately share the words
    // 'Networking' and 'Cryptography'; that overlap is pinned verbatim below.
    // They are still independent lists (own order, own length, own identity).
    expect(valuesInCommon(PROJECT_TAGS, CERTIFICATE_TAGS)).toEqual(['Networking', 'Cryptography']);
    expect(PROJECT_TAGS).not.toEqual(CERTIFICATE_TAGS);
    expect(PROJECT_TAGS).not.toBe(CERTIFICATE_TAGS);
  });
});

describe('KINDS wiring of groups and tag vocabularies', () => {
  it('declares each kind\'s own group list and tag vocabulary', () => {
    expect(KINDS.writeup.tags).toEqual([...TAGS]);
    expect(KINDS.writeup.groups).toBeNull();
    expect(KINDS.project.groups).toEqual(APPROVED_PROJECT_GROUPS);
    expect(KINDS.project.tags).toEqual(APPROVED_PROJECT_TAGS);
    expect(KINDS.certificate.groups).toEqual(APPROVED_CERTIFICATE_GROUPS);
    expect(KINDS.certificate.tags).toEqual(APPROVED_CERTIFICATE_TAGS);
  });

  it('shares no list between kinds (distinct arrays, no cross-kind reuse)', () => {
    expect(KINDS.project.groups).not.toBe(KINDS.certificate.groups);
    expect(KINDS.project.tags).not.toBe(KINDS.certificate.tags);
    expect(KINDS.writeup.tags).not.toBe(KINDS.project.tags);
    expect(KINDS.writeup.tags).not.toBe(KINDS.certificate.tags);
    expect(KINDS.project.groups).not.toEqual(KINDS.certificate.groups);
  });
});

// ---------------------------------------------------------------------------
// Temp-dir fixtures for generateIndex validation, following the pattern in
// tests/generate-index.test.ts: fixtures always live outside the repository.
// ---------------------------------------------------------------------------
const tempDirs: string[] = [];

function makeTempWriteupsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starkhack-taxonomy-'));
  tempDirs.push(dir);
  return dir;
}

function writeWriteup(
  root: string,
  platform: string,
  filename: string,
  frontmatterLines: string[],
  body = '# Writeup body'
): string {
  const platformDir = path.join(root, platform);
  fs.mkdirSync(platformDir, { recursive: true });
  const filePath = path.join(platformDir, filename);
  fs.writeFileSync(filePath, ['---', ...frontmatterLines, '---', '', body, ''].join('\n'));
  return filePath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('generateIndex tag validation', () => {
  it('throws an Error naming the file path and the offending tag when a tag is outside TAGS', () => {
    const root = makeTempWriteupsDir();
    const filePath = writeWriteup(root, 'hackmyvm', 'bad-tag.md', [
      'title: "Bad Tag"',
      'date: 2026-01-01',
      'tags:',
      '  [',
      '    "Totally Made Up Tag",',
      '  ]',
    ]);

    let thrown: unknown;
    try {
      generateIndex(root);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain(filePath);
    expect(message).toContain('Totally Made Up Tag');
  });
});


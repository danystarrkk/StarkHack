import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { assertValidTags, TAGS } from '../lib/taxonomy.js';
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


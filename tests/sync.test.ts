import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import type { WriteupIndexItem } from '../types';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const writeupsDir = path.join(publicDir, 'writeups');
const indexJsonPath = path.join(publicDir, 'index.json');

interface WriteupFile {
  rel: string;
  expectedPath: string;
  slug: string;
  data: Record<string, any>;
}

function collectMarkdownFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(full);
    }
  }
  return found;
}

// Every markdown writeup on disk, parsed with the same frontmatter parser as the generator.
const allWriteupFiles: WriteupFile[] = collectMarkdownFiles(writeupsDir).map((abs) => {
  const rel = path.relative(writeupsDir, abs).split(path.sep).join('/');
  const { data } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  return {
    rel,
    expectedPath: `/writeups/${rel}`,
    slug: path.basename(abs).replace(/\.md$/, ''),
    data,
  };
});

// Resolves the index entries for a single writeup file. Lookups go by `path`
// (`/writeups/<platform>/<file>`), which is unique by construction; the bare `slug`
// is only the filename and can collide across platforms.
function entriesFor(
  index: WriteupIndexItem[],
  file: Pick<WriteupFile, 'slug' | 'expectedPath'>
): WriteupIndexItem[] {
  return index.filter((entry) => entry.path === file.expectedPath);
}

// generateIndex() deliberately skips `draft: true`, so drafts must NOT appear in the index.
const writeupFiles: WriteupFile[] = allWriteupFiles.filter((file) => file.data.draft !== true);
const draftFiles: WriteupFile[] = allWriteupFiles.filter((file) => file.data.draft === true);

// The committed, generated index that must stay in sync with the markdown files.
const index: WriteupIndexItem[] = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8'));

describe('public/index.json drift', () => {
  it('keeps one index entry per markdown writeup file', () => {
    expect(writeupFiles.length).toBeGreaterThan(0);
    expect(index).toHaveLength(writeupFiles.length);
  });

  it.each(writeupFiles)(
    'writeup $rel has exactly one index entry with matching metadata',
    (file) => {
      const matches = entriesFor(index, file);
      expect(matches).toHaveLength(1);

      const [entry] = matches;
      expect(entry.path).toBe(file.expectedPath);
      expect(entry.title).toBe(file.data.title);
      expect(entry.date).toBe(file.data.date);
      expect(entry.level).toBe(file.data.level);
      expect(entry.tags).toEqual(file.data.tags);
    }
  );

  it.each(index)('index entry $path has a backing markdown file', (entry) => {
    const expectedPaths = new Set(writeupFiles.map((file) => file.expectedPath));
    expect(expectedPaths.has(entry.path)).toBe(true);
  });

  // A draft on disk is fine; a draft in the index is a generator contract violation.
  it.each(draftFiles)('draft writeup $rel is excluded from the index', ({ expectedPath }) => {
    expect(index.some((entry) => entry.path === expectedPath)).toBe(false);
  });
});

describe('index entry lookup', () => {
  // Synthetic index: two platforms can ship a machine with the same filename, so a bare
  // slug is ambiguous while `/writeups/<platform>/<file>` stays unique by construction.
  const syntheticIndex: WriteupIndexItem[] = [
    {
      title: 'Wave (HackMyVM)',
      date: '2026-01-01',
      slug: 'wave',
      platform: 'hackmyvm',
      path: '/writeups/hackmyvm/wave.md',
    },
    {
      title: 'Wave (HackTheBox)',
      date: '2026-01-02',
      slug: 'wave',
      platform: 'hackthebox',
      path: '/writeups/hackthebox/wave.md',
    },
  ];
  const sharedSlugFiles = [
    { slug: 'wave', expectedPath: '/writeups/hackmyvm/wave.md', expectedPlatform: 'hackmyvm' },
    { slug: 'wave', expectedPath: '/writeups/hackthebox/wave.md', expectedPlatform: 'hackthebox' },
  ];

  it.each(sharedSlugFiles)(
    'resolves exactly one entry for $expectedPath when two platforms share a slug',
    ({ slug, expectedPath, expectedPlatform }) => {
      const matches = entriesFor(syntheticIndex, { slug, expectedPath });

      expect(matches).toHaveLength(1);
      expect(matches[0].path).toBe(expectedPath);
      expect(matches[0].platform).toBe(expectedPlatform);
    }
  );
});

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
    ({ expectedPath, slug, data }) => {
      const matches = index.filter((entry) => entry.slug === slug);
      expect(matches).toHaveLength(1);

      const [entry] = matches;
      expect(entry.path).toBe(expectedPath);
      expect(entry.title).toBe(data.title);
      expect(entry.date).toBe(data.date);
      expect(entry.level).toBe(data.level);
      expect(entry.tags).toEqual(data.tags);
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

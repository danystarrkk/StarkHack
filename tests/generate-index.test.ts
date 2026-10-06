import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateIndex } from '../scripts/generate-index.js';

// Fixtures always live outside the repository, in a fresh OS temp directory.
const tempDirs: string[] = [];

function makeTempWriteupsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starkhack-generate-index-'));
  tempDirs.push(dir);
  return dir;
}

function writeWriteup(
  root: string,
  platform: string,
  filename: string,
  frontmatterLines: string[],
  body = '# Writeup body'
): void {
  const platformDir = path.join(root, platform);
  fs.mkdirSync(platformDir, { recursive: true });
  const file = ['---', ...frontmatterLines, '---', '', body, ''].join('\n');
  fs.writeFileSync(path.join(platformDir, filename), file);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('generateIndex', () => {
  it('excludes drafts while including entries with draft false or no draft key', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'drafted.md', ['title: "Drafted"', 'date: 2026-01-01', 'draft: true']);
    writeWriteup(root, 'hackmyvm', 'published.md', ['title: "Published"', 'date: 2026-01-02', 'draft: false']);
    writeWriteup(root, 'hackmyvm', 'implicit.md', ['title: "Implicit"', 'date: 2026-01-03']);

    const slugs = generateIndex(root).map((item) => item.slug);

    expect(slugs).toHaveLength(2);
    expect(slugs).not.toContain('drafted');
    expect(slugs).toContain('published');
    expect(slugs).toContain('implicit');
  });

  it('orders writeups by date descending', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'older.md', ['title: "Older"', 'date: 2024-01-01']);
    writeWriteup(root, 'hackmyvm', 'newest.md', ['title: "Newest"', 'date: 2025-06-15']);
    writeWriteup(root, 'hackmyvm', 'oldest.md', ['title: "Oldest"', 'date: 2023-12-31']);

    const slugs = generateIndex(root).map((item) => item.slug);

    expect(slugs).toEqual(['newest', 'older', 'oldest']);
  });

  it('derives platform from the directory name, slug from the filename, and a /writeups path', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'machine-one.md', ['title: "Machine One"', 'date: 2026-01-01']);

    const index = generateIndex(root);

    expect(index).toHaveLength(1);
    expect(index[0].platform).toBe('hackmyvm');
    expect(index[0].slug).toBe('machine-one');
    expect(index[0].path).toBe('/writeups/hackmyvm/machine-one.md');
    expect(index[0].title).toBe('Machine One');
  });

  it('ignores non-directory entries in the writeups directory', () => {
    const root = makeTempWriteupsDir();
    writeWriteup(root, 'hackmyvm', 'real.md', ['title: "Real"', 'date: 2026-01-01']);
    fs.writeFileSync(path.join(root, 'README.md'), '# Not a platform\n');
    fs.writeFileSync(path.join(root, 'stray.txt'), 'noise\n');

    const index = generateIndex(root);

    expect(index).toHaveLength(1);
    expect(index[0].slug).toBe('real');
  });

  it('returns an empty index for a non-existent directory', () => {
    const root = makeTempWriteupsDir();
    const missing = path.join(root, 'does-not-exist');

    expect(generateIndex(missing)).toEqual([]);
  });

  it('returns an empty index for an empty writeups directory', () => {
    const root = makeTempWriteupsDir();

    expect(generateIndex(root)).toEqual([]);
  });
});

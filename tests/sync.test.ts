import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { KINDS } from '../lib/content-kinds.js';
import type { ContentIndexItem, ContentKind, WriteupIndexItem } from '../types';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const repoRoot = path.resolve(publicDir, '..');
const indexJsonPath = path.join(publicDir, 'index.json');

interface ContentFile {
  kind: ContentKind;
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

// Every markdown content file on disk, for all three kinds. The roots come from
// the KINDS registry (lib/content-kinds.js) — never hardcoded — and absent roots
// contribute no files. Platformed kinds (writeups) are scanned like the
// generator's two-level <root>/<platform>/*.md walk; flat kinds scan <root>/*.md.
const allContentFiles: ContentFile[] = Object.entries(KINDS).flatMap(([kind, spec]) => {
  const rootDir = path.join(repoRoot, spec.root);
  if (!fs.existsSync(rootDir)) return [];

  const absFiles = spec.platformed
    ? collectMarkdownFiles(rootDir)
    : fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => path.join(rootDir, entry.name));

  const urlRoot = `/${spec.root.replace(/^public\//, '')}`;
  return absFiles.map((abs) => {
    const rel = path.relative(rootDir, abs).split(path.sep).join('/');
    const { data } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    return {
      kind: kind as ContentKind,
      rel,
      // Site paths mirror the registry roots: /writeups/<platform>/<file>,
      // /projects/<file>, /certificates/<file>.
      expectedPath: `${urlRoot}/${rel}`,
      slug: path.basename(abs).replace(/\.md$/, ''),
      data,
    };
  });
});

// Resolves the index entries for a single content file. Lookups go by `path`,
// which is unique by construction; the bare `slug` is only the filename and can
// collide across platforms.
function entriesFor(
  index: ContentIndexItem[],
  file: Pick<ContentFile, 'slug' | 'expectedPath'>
): ContentIndexItem[] {
  return index.filter((entry) => entry.path === file.expectedPath);
}

// generateIndex() deliberately skips `draft: true`, so drafts must NOT appear in the index.
const contentFiles: ContentFile[] = allContentFiles.filter((file) => file.data.draft !== true);
const draftFiles: ContentFile[] = allContentFiles.filter((file) => file.data.draft === true);

// The committed, generated index that must stay in sync with the markdown files.
const index: ContentIndexItem[] = JSON.parse(fs.readFileSync(indexJsonPath, 'utf8'));

describe('public/index.json drift', () => {
  it('keeps one index entry per markdown content file, per kind', () => {
    expect(contentFiles.length).toBeGreaterThan(0);
    expect(index).toHaveLength(contentFiles.length);
    for (const kind of Object.keys(KINDS)) {
      expect(index.filter((entry) => entry.kind === kind)).toHaveLength(
        contentFiles.filter((file) => file.kind === kind).length
      );
    }
  });

  it.each(contentFiles)(
    '$kind $rel has exactly one index entry with matching metadata',
    (file) => {
      const matches = entriesFor(index, file);
      expect(matches).toHaveLength(1);

      const [entry] = matches;
      expect(entry.kind).toBe(file.kind);
      expect(entry.path).toBe(file.expectedPath);
      expect(entry.title).toBe(file.data.title);
      expect(entry.date).toBe(file.data.date);
      expect(entry.level).toBe(file.data.level);
      expect(entry.tags).toEqual(file.data.tags);
      expect(entry.image).toBe(file.data.image);
      expect(entry.description).toBe(file.data.description);
      expect(entry.order).toBe(file.data.order);
      if (file.kind === 'writeup') {
        // Writeups are platformed: the platform comes from the directory name.
        expect(entry.platform).toBe(file.rel.split('/')[0]);
      } else {
        // Flat kinds must not carry a platform key at all.
        expect(entry).not.toHaveProperty('platform');
      }
    }
  );

  it.each(index)('index entry $path has a backing markdown file', (entry) => {
    const expectedPaths = new Set(contentFiles.map((file) => file.expectedPath));
    expect(expectedPaths.has(entry.path)).toBe(true);
  });

  // A draft on disk is fine; a draft in the index is a generator contract violation.
  it.each(draftFiles)('draft $kind $rel is excluded from the index', ({ expectedPath }) => {
    expect(index.some((entry) => entry.path === expectedPath)).toBe(false);
  });
});

describe('index entry lookup', () => {
  // Synthetic index: two platforms can ship a machine with the same filename, so a bare
  // slug is ambiguous while `/writeups/<platform>/<file>` stays unique by construction.
  const syntheticIndex: WriteupIndexItem[] = [
    {
      kind: 'writeup',
      title: 'Wave (HackMyVM)',
      date: '2026-01-01',
      slug: 'wave',
      platform: 'hackmyvm',
      path: '/writeups/hackmyvm/wave.md',
    },
    {
      kind: 'writeup',
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

// UI content adapter contract: pure, synchronous mappers from the real content
// pipeline (public/index.json entries, lib/content.ts types) to the UI types in
// src/types/index.ts.
//
// The hard rule under test: ONLY data the pipeline really supplies may be
// mapped. Template-only fields (os, ports, difficulty, vulnerabilities,
// points, steps, ...) must be ABSENT on the result — never invented, never
// hardcoded placeholder values.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toUiProject, toUiWriteup } from '../src/lib/contentAdapter';
import type { ContentIndexItem, WriteupIndexItem } from '../types';

// Real entry shape from public/index.json (writeup "Wave", trimmed tags).
const WAVE_ENTRY: WriteupIndexItem = {
  title: 'Wave',
  date: '2026-09-15',
  draft: false,
  description: 'Writeup de la máquina Wave en HackMyVM.',
  categories: ['HackMyVM'],
  tags: ['File Upload', 'Information Disclosure', 'Privilege Escalation'],
  image: '/writeups/hackmyvm/wave/media/cover.webp',
  level: 'Medium',
  kind: 'writeup',
  platform: 'hackmyvm',
  slug: 'wave',
  path: '/writeups/hackmyvm/wave.md',
};

// Minimum a validated writeup entry can be: no description/tags/image.
const BARE_ENTRY: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'bare',
  title: 'Bare',
  date: '2026-01-01',
  platform: 'hackthebox',
  path: '/writeups/hackthebox/bare.md',
};

const PROJECT_ENTRY: ContentIndexItem = {
  kind: 'project',
  slug: 'autorecon-ng',
  title: 'AutoRecon-NG',
  path: '/projects/autorecon-ng.md',
  date: '2026-02-01',
  description: 'Suite modular de reconocimiento multihilo.',
  group: 'herramientas',
  tags: ['Python 3', 'AsyncIO'],
  image: '/projects/autorecon-ng/media/cover.webp',
};

const BARE_PROJECT_ENTRY: ContentIndexItem = {
  kind: 'project',
  slug: 'bare-project',
  title: 'Bare Project',
  path: '/projects/bare-project.md',
};

// Template-only fields the pipeline has no source for. None may appear on a
// mapped UI object, not even as undefined-valued keys.
const WRITEUP_TEMPLATE_ONLY_FIELDS = [
  'os',
  'ports',
  'difficulty',
  'vulnerabilities',
  'ipAddress',
  'points',
  'steps',
  'userFlag',
  'rootFlag',
  'machineLinks',
  'toolLinks',
  'markdownContent',
  'author',
  'readTime',
];

const PROJECT_TEMPLATE_ONLY_FIELDS = [
  'tagCategory',
  'version',
  'statusBadge',
  'subBadge',
  'isNew',
  'stars',
  'forks',
  'releaseVersion',
  'githubUrl',
  'readme',
  'codeSnippet',
  'projectLinks',
  'toolLinks',
];

describe('toUiWriteup', () => {
  it('maps exactly the fields the pipeline really supplies', () => {
    expect(toUiWriteup(WAVE_ENTRY)).toEqual({
      id: 'wave',
      title: 'Wave',
      summary: 'Writeup de la máquina Wave en HackMyVM.',
      releaseDate: '2026-09-15',
      platformId: 'hackmyvm',
      tags: ['File Upload', 'Information Disclosure', 'Privilege Escalation'],
      image: '/writeups/hackmyvm/wave/media/cover.webp',
      iconType: 'wave',
    });
  });

  it('leaves template-only fields absent — never invented', () => {
    const ui = toUiWriteup(WAVE_ENTRY);
    for (const field of WRITEUP_TEMPLATE_ONLY_FIELDS) {
      expect(ui).not.toHaveProperty(field);
    }
    expect(ui).not.toHaveProperty('level'); // pipeline `level` is not UI `difficulty`
  });

  it('omits optional pipeline fields instead of fabricating placeholders', () => {
    const ui = toUiWriteup(BARE_ENTRY);
    expect(ui).toEqual({
      id: 'bare',
      title: 'Bare',
      releaseDate: '2026-01-01',
      platformId: 'hackthebox',
      iconType: 'server',
    });
    expect(ui).not.toHaveProperty('summary');
    expect(ui).not.toHaveProperty('tags');
    expect(ui).not.toHaveProperty('image');
  });

  it('derives iconType deterministically from platform (documented map)', () => {
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'hackmyvm' }).iconType).toBe('wave');
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'hackthebox' }).iconType).toBe('server');
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'tryhackme' }).iconType).toBe('network');
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'vulnhub' }).iconType).toBe('database');
    // Unknown platform → documented fallback.
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'some-oscp-lab' }).iconType).toBe('bug');
    // Platform matching is case-insensitive.
    expect(toUiWriteup({ ...BARE_ENTRY, platform: 'HackMyVM' }).iconType).toBe('wave');
  });

  it('is pure and synchronous', () => {
    const before = structuredClone(WAVE_ENTRY);
    const first = toUiWriteup(WAVE_ENTRY);
    const second = toUiWriteup(WAVE_ENTRY);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(WAVE_ENTRY).toEqual(before); // input untouched
  });
});

describe('toUiProject', () => {
  it('maps exactly the fields the pipeline really supplies', () => {
    expect(toUiProject(PROJECT_ENTRY, 1)).toEqual({
      id: 'autorecon-ng',
      title: 'AutoRecon-NG',
      description: 'Suite modular de reconocimiento multihilo.',
      tags: ['Python 3', 'AsyncIO'],
      image: '/projects/autorecon-ng/media/cover.webp',
      date: '2026-02-01',
      iconType: 'gear',
      number: '#01',
    });
  });

  it('derives number from the mapper position argument, zero-padded', () => {
    expect(toUiProject(PROJECT_ENTRY, 7).number).toBe('#07');
    expect(toUiProject(PROJECT_ENTRY, 42).number).toBe('#42');
  });

  it('leaves template-only fields absent — never invented', () => {
    const ui = toUiProject(PROJECT_ENTRY, 1);
    for (const field of PROJECT_TEMPLATE_ONLY_FIELDS) {
      expect(ui).not.toHaveProperty(field);
    }
  });

  it('omits optional pipeline fields instead of fabricating placeholders', () => {
    const ui = toUiProject(BARE_PROJECT_ENTRY, 3);
    expect(ui).toEqual({
      id: 'bare-project',
      title: 'Bare Project',
      iconType: 'shield',
      number: '#03',
    });
    expect(ui).not.toHaveProperty('description');
    expect(ui).not.toHaveProperty('tags');
    expect(ui).not.toHaveProperty('image');
    expect(ui).not.toHaveProperty('date');
  });

  it('derives iconType deterministically from project group (documented map)', () => {
    expect(toUiProject({ ...BARE_PROJECT_ENTRY, group: 'herramientas' }, 1).iconType).toBe('gear');
    expect(toUiProject({ ...BARE_PROJECT_ENTRY, group: 'scripts' }, 1).iconType).toBe('code');
    expect(toUiProject({ ...BARE_PROJECT_ENTRY, group: 'automatizaciones' }, 1).iconType).toBe('scan');
    // Missing or unknown group → documented fallback.
    expect(toUiProject(BARE_PROJECT_ENTRY, 1).iconType).toBe('shield');
    expect(toUiProject({ ...BARE_PROJECT_ENTRY, group: 'unknown-group' }, 1).iconType).toBe('shield');
  });

  it('is pure and synchronous', () => {
    const before = structuredClone(PROJECT_ENTRY);
    const first = toUiProject(PROJECT_ENTRY, 2);
    const second = toUiProject(PROJECT_ENTRY, 2);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(PROJECT_ENTRY).toEqual(before); // input untouched
  });
});

describe('real public/index.json entries', () => {
  const index: Array<Record<string, unknown>> = JSON.parse(
    readFileSync(new URL('../public/index.json', import.meta.url), 'utf8')
  );

  it('map without fabricating any template-only field', () => {
    for (const raw of index) {
      const kind = raw.kind;
      if (kind === 'writeup') {
        const ui = toUiWriteup(raw as unknown as WriteupIndexItem);
        for (const field of WRITEUP_TEMPLATE_ONLY_FIELDS) {
          expect(ui, `${String(raw.slug)}.${field}`).not.toHaveProperty(field);
        }
        expect(ui.id).toBe(raw.slug);
      } else if (kind === 'project') {
        const ui = toUiProject(raw as unknown as ContentIndexItem, 1);
        for (const field of PROJECT_TEMPLATE_ONLY_FIELDS) {
          expect(ui, `${String(raw.slug)}.${field}`).not.toHaveProperty(field);
        }
        expect(ui.id).toBe(raw.slug);
      }
    }
    expect(index.length).toBeGreaterThan(0);
  });
});

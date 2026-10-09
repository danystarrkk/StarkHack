// Directory model contract: the pure, synchronous builder behind the /writeups
// list screen. It takes RAW content-pipeline entries (public/index.json items,
// typed by the repo-root lib/content.ts API) plus the screen's filter state and
// returns exactly what the screen renders: platform cards with real counts and
// the filtered writeup list.
//
// Honesty rules under test (same family as tests/ui-content-adapter.test.ts):
//   - ONLY real pipeline fields back the filters: platform, tags, level
//     (verbatim 'Easy' | 'Medium' | 'Hard' — NEVER the template's
//     FÁCIL/MEDIO/DIFÍCIL vocabulary), search over real title/description.
//   - Template-only fields (os, ports, difficulty, vulnerabilities, ipAddress,
//     ...) never appear on the mapped writeups — no dead UI backing.
//   - Derived display data (counts, last deploy date, level breakdown) is
//     computed from the entries; nothing is invented.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DIRECTORY_LEVELS,
  EMPTY_DIRECTORY_FILTERS,
  buildDirectoryModel,
  type DirectoryFilters,
} from '../src/lib/directoryModel';
import { TAGS } from '../lib/taxonomy.js';
import type { WriteupIndexItem } from '../types';

// Real entry shapes from public/index.json (trimmed tags), covering the fields
// the screen really has: level, tags, description, cve, categories.
const WAVE: WriteupIndexItem = {
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

const FLOSSY: WriteupIndexItem = {
  title: 'Flossy',
  date: '2026-06-28',
  draft: false,
  description: 'Escalada de privilegios vía pkexec.',
  categories: ['HackMyVM'],
  tags: ['Privilege Escalation'],
  level: 'Hard',
  cve: 'CVE-2021-4034',
  kind: 'writeup',
  platform: 'hackmyvm',
  slug: 'flossy',
  path: '/writeups/hackmyvm/flossy.md',
};

// Minimum a validated writeup can be: no description, no tags, no cve.
const BARE: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'bare',
  title: 'Bare Box',
  date: '2026-01-05',
  platform: 'hackthebox',
  path: '/writeups/hackthebox/bare.md',
  level: 'Easy',
};

// No `level` at all: the model must not invent one.
const NOLVL: WriteupIndexItem = {
  kind: 'writeup',
  slug: 'nolvl',
  title: 'Nolvl',
  date: '2026-01-01',
  platform: 'vulnhub',
  categories: ['VulnHub'],
  tags: ['Buffer Overflow'],
  path: '/writeups/vulnhub/nolvl.md',
};

const ENTRIES: WriteupIndexItem[] = [WAVE, FLOSSY, BARE, NOLVL];

const filters = (overrides: Partial<DirectoryFilters>): DirectoryFilters => ({
  ...EMPTY_DIRECTORY_FILTERS,
  ...overrides,
});

// Template-only fields: none may appear on a mapped writeup.
const TEMPLATE_ONLY_FIELDS = [
  'os',
  'ports',
  'difficulty',
  'vulnerabilities',
  'ipAddress',
  'points',
  'steps',
  'userFlag',
  'rootFlag',
  // machineLinks / toolLinks are NOT template-only since writeup-links: the
  // pipeline supplies them and toUiWriteup maps them — pinned by the adapter
  // tests.
  'markdownContent',
  'author',
  'readTime',
];

describe('buildDirectoryModel — platform cards', () => {
  it('builds one card per real platform with real counts, in id order', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    expect(model.platformCards.map((card) => card.id)).toEqual(['hackmyvm', 'hackthebox', 'vulnhub']);
    const [hmv, htb, vh] = model.platformCards;
    expect(hmv.nodeCount).toBe(2);
    expect(htb.nodeCount).toBe(1);
    expect(vh.nodeCount).toBe(1);
    expect(model.totalCount).toBe(4);
  });

  it('derives the level breakdown and last deploy date from the entries (never invented)', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    const hmv = model.platformCards.find((card) => card.id === 'hackmyvm')!;
    expect(hmv.levelCounts).toEqual({ Easy: 0, Medium: 1, Hard: 1 });
    expect(hmv.lastDeploy).toBe('2026-09-15'); // newest real date on the platform
    const vh = model.platformCards.find((card) => card.id === 'vulnhub')!;
    expect(vh.levelCounts).toEqual({ Easy: 0, Medium: 0, Hard: 0 }); // entry has no level
    expect(vh.lastDeploy).toBe('2026-01-01');
  });

  it('uses the consistent real category as display name, else the platform id verbatim', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    expect(model.platformCards.find((card) => card.id === 'hackmyvm')!.name).toBe('HackMyVM');
    expect(model.platformCards.find((card) => card.id === 'vulnhub')!.name).toBe('VulnHub');
    // No categories at all → platform id, never a fabricated name.
    expect(model.platformCards.find((card) => card.id === 'hackthebox')!.name).toBe('hackthebox');
    // Disagreeing categories → platform id too.
    const disagreeing = buildDirectoryModel(
      [
        { ...BARE, platform: 'lab', categories: ['Lab A'], slug: 'a', path: '/writeups/lab/a.md' },
        { ...BARE, platform: 'lab', categories: ['Lab B'], slug: 'b', path: '/writeups/lab/b.md' },
      ],
      EMPTY_DIRECTORY_FILTERS
    );
    expect(disagreeing.platformCards[0].name).toBe('lab');
  });

  it('derives the card iconType from the platform (same documented map as toUiWriteup)', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    expect(model.platformCards.find((card) => card.id === 'hackmyvm')!.iconType).toBe('wave');
    expect(model.platformCards.find((card) => card.id === 'hackthebox')!.iconType).toBe('server');
    expect(model.platformCards.find((card) => card.id === 'vulnhub')!.iconType).toBe('database');
    const unknown = buildDirectoryModel(
      [{ ...BARE, platform: 'some-oscp-lab', slug: 'x', path: '/writeups/some-oscp-lab/x.md' }],
      EMPTY_DIRECTORY_FILTERS
    );
    expect(unknown.platformCards[0].iconType).toBe('bug');
  });
});

describe('buildDirectoryModel — filtered writeup list', () => {
  it('without filters returns every entry in index order, mapped with the real level', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    expect(model.writeups.map((w) => w.id)).toEqual(['wave', 'flossy', 'bare', 'nolvl']);
    expect(model.writeups[0]).toMatchObject({
      title: 'Wave',
      summary: 'Writeup de la máquina Wave en HackMyVM.',
      releaseDate: '2026-09-15',
      platformId: 'hackmyvm',
      level: 'Medium',
    });
    expect(model.writeups[1].cve).toBe('CVE-2021-4034');
    // Entries without level/cve keep them absent — never invented.
    expect(model.writeups[3]).not.toHaveProperty('level');
    expect(model.writeups[0]).not.toHaveProperty('cve');
  });

  it('maps only real fields: template-only fields stay absent on every writeup', () => {
    const model = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    for (const w of model.writeups) {
      for (const field of TEMPLATE_ONLY_FIELDS) {
        expect(w, `${w.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('platform filter is case-insensitive and resolves the active platform card', () => {
    const model = buildDirectoryModel(ENTRIES, filters({ platformId: 'HACKMYVM' }));
    expect(model.writeups.map((w) => w.id)).toEqual(['wave', 'flossy']);
    expect(model.activePlatform?.id).toBe('hackmyvm');
    expect(model.activePlatform?.nodeCount).toBe(2);
  });

  it('unknown platform yields no active card and an honest empty list', () => {
    const model = buildDirectoryModel(ENTRIES, filters({ platformId: 'nosuchplatform' }));
    expect(model.activePlatform).toBeNull();
    expect(model.writeups).toEqual([]);
  });

  it('level filter uses the real pipeline vocabulary verbatim', () => {
    expect(DIRECTORY_LEVELS).toEqual(['Easy', 'Medium', 'Hard']);
    expect(buildDirectoryModel(ENTRIES, filters({ level: 'Easy' })).writeups.map((w) => w.id)).toEqual([
      'bare',
    ]);
    expect(buildDirectoryModel(ENTRIES, filters({ level: 'Hard' })).writeups.map((w) => w.id)).toEqual([
      'flossy',
    ]);
    // An entry with no level never matches a specific level.
    expect(buildDirectoryModel(ENTRIES, filters({ level: 'Medium' })).writeups.map((w) => w.id)).toEqual([
      'wave',
    ]);
    // Mapped levels are real values only — never the template vocabulary.
    for (const w of buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS).writeups) {
      if (w.level !== undefined) expect(DIRECTORY_LEVELS).toContain(w.level);
    }
  });

  it('tag filter matches the real closed taxonomy and availableTags lists real tags only', () => {
    const model = buildDirectoryModel(ENTRIES, filters({ tag: 'Privilege Escalation' }));
    expect(model.writeups.map((w) => w.id)).toEqual(['wave', 'flossy']);
    expect(buildDirectoryModel(ENTRIES, filters({ tag: 'SQL Injection' })).writeups).toEqual([]);
    const all = buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS);
    expect(all.availableTags).toEqual(['Buffer Overflow', 'File Upload', 'Information Disclosure', 'Privilege Escalation']);
    for (const tag of all.availableTags) expect(TAGS).toContain(tag);
  });

  it('search matches real title/description only (case-insensitive substring)', () => {
    expect(buildDirectoryModel(ENTRIES, filters({ search: 'WAVE' })).writeups.map((w) => w.id)).toEqual(['wave']);
    expect(buildDirectoryModel(ENTRIES, filters({ search: 'pkexec' })).writeups.map((w) => w.id)).toEqual(['flossy']);
    // Title-only entry matches its title.
    expect(buildDirectoryModel(ENTRIES, filters({ search: 'bare box' })).writeups.map((w) => w.id)).toEqual(['bare']);
    // Template-only text (IPs, ports) can never match: those fields do not exist.
    expect(buildDirectoryModel(ENTRIES, filters({ search: '10.10' })).writeups).toEqual([]);
    expect(buildDirectoryModel(ENTRIES, filters({ search: '443' })).writeups).toEqual([]);
  });

  it('searchResults are global (search text only) and empty without search text', () => {
    expect(buildDirectoryModel(ENTRIES, EMPTY_DIRECTORY_FILTERS).searchResults).toEqual([]);
    expect(buildDirectoryModel(ENTRIES, filters({ search: '   ' })).searchResults).toEqual([]);
    const model = buildDirectoryModel(ENTRIES, filters({ platformId: 'vulnhub', search: 'hackmyvm' }));
    expect(model.writeups).toEqual([]); // platform + search intersect: no match
    expect(model.searchResults.map((w) => w.id)).toEqual(['wave']); // global overlay still finds it
  });

  it('all filters intersect', () => {
    const model = buildDirectoryModel(
      ENTRIES,
      filters({ platformId: 'hackmyvm', level: 'Hard', tag: 'Privilege Escalation', search: 'pkexec' })
    );
    expect(model.writeups.map((w) => w.id)).toEqual(['flossy']);
    const tooMuch = buildDirectoryModel(
      ENTRIES,
      filters({ platformId: 'hackmyvm', level: 'Easy', tag: 'Privilege Escalation', search: 'pkexec' })
    );
    expect(tooMuch.writeups).toEqual([]);
  });

  it('is pure and synchronous', () => {
    const before = structuredClone(ENTRIES);
    const f = filters({ platformId: 'hackmyvm' });
    const first = buildDirectoryModel(ENTRIES, f);
    const second = buildDirectoryModel(ENTRIES, f);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.writeups).not.toBe(second.writeups);
    expect(ENTRIES).toEqual(before); // input untouched
  });
});

describe('real public/index.json entries', () => {
  const raw: Array<Record<string, unknown>> = JSON.parse(
    readFileSync(new URL('../public/index.json', import.meta.url), 'utf8')
  );
  const writeups = raw.filter((item) => item.kind === 'writeup') as unknown as WriteupIndexItem[];

  it('build the real directory: counts, order, tags and levels are all derived from the index', () => {
    const model = buildDirectoryModel(writeups, EMPTY_DIRECTORY_FILTERS);
    expect(writeups.length).toBeGreaterThan(0);
    expect(model.totalCount).toBe(writeups.length);
    expect(model.writeups).toHaveLength(writeups.length);

    // One card per real platform; counts and last deploy match the raw entries.
    const platformIds = [...new Set(writeups.map((item) => item.platform.toLowerCase()))].sort();
    expect(model.platformCards.map((card) => card.id)).toEqual(platformIds);
    for (const card of model.platformCards) {
      const own = writeups.filter((item) => item.platform.toLowerCase() === card.id);
      expect(card.nodeCount).toBe(own.length);
      expect(card.lastDeploy).toBe(own.map((item) => item.date).sort().at(-1));
      expect(card.levelCounts).toEqual({
        Easy: own.filter((item) => item.level === 'Easy').length,
        Medium: own.filter((item) => item.level === 'Medium').length,
        Hard: own.filter((item) => item.level === 'Hard').length,
      });
    }

    // Real tags only, inside the closed taxonomy.
    const rawTags = [...new Set(writeups.flatMap((item) => item.tags ?? []))].sort((a, b) => a.localeCompare(b, 'en'));
    expect(model.availableTags).toEqual(rawTags);
    for (const tag of model.availableTags) expect(TAGS).toContain(tag);

    // Real levels only, never the template vocabulary.
    for (const w of model.writeups) {
      if (w.level !== undefined) expect(DIRECTORY_LEVELS).toContain(w.level);
      for (const field of TEMPLATE_ONLY_FIELDS) {
        expect(w, `${w.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('the platform filter navigated from /machines/:platformId (?plataforma=) finds the real platform', () => {
    const model = buildDirectoryModel(writeups, filters({ platformId: 'hackmyvm' }));
    expect(model.activePlatform?.id).toBe('hackmyvm');
    expect(model.writeups).toHaveLength(writeups.length);
  });
});

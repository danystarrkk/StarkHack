// Projects model contract: the pure, synchronous builder behind the /projects
// screen. It takes RAW content-pipeline entries (public/index.json project
// items, typed by the repo-root lib/content.ts API) plus the screen's filter
// state and returns exactly what the screen renders: the featured/recientes
// slice, the full archive list, the filter categories and the
// "MOSTRANDO X DE Y" counts.
//
// Honesty rules under test (same family as tests/directory-model.test.ts):
//   - The category filter is driven ONLY by the real pipeline `group`
//     (herramientas | scripts | automatizaciones — the canonical
//     PROJECT_GROUPS vocabulary), displayed with the screen's uppercase
//     Spanish labels. The template's tagCategory vocabulary
//     ('HERRAMIENTA'|'SCRIPT'|'AUTOMATIZACIÓN'|'EXPLOIT') is never a filter
//     source and 'EXPLOIT' has no pipeline group at all.
//   - Search matches real title/description/tags only — template-only text
//     (versions, stars, badges) can never match.
//   - Template-only fields (stars, statusBadge, subBadge, version, ...) never
//     appear on the mapped projects; the category label is derived from the
//     real group only, and stays absent for missing/unknown groups.
//   - `number` positions derive from the loaded list order — never invented.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROJECTS_FILTERS,
  FEATURED_PROJECT_COUNT,
  PROJECT_FILTER_CATEGORIES,
  buildProjectsModel,
  type ProjectGroup,
  type ProjectsFilters,
} from '../src/lib/projectsModel';
import { PROJECT_GROUPS } from '../lib/content-kinds.js';
import type { ContentIndexItem } from '../types';

// Real project entry shapes (public/index.json items of kind 'project').
const AUTORECON: ContentIndexItem = {
  kind: 'project',
  slug: 'autorecon-ng',
  path: '/projects/autorecon-ng.md',
  title: 'AutoRecon-NG',
  date: '2026-09-15',
  description: 'Suite modular de reconocimiento multihilo para escaneo de activos.',
  tags: ['Python 3', 'AsyncIO', 'Nmap Engine'],
  group: 'herramientas',
  image: '/projects/autorecon-ng/media/cover.webp',
};

const SHCRAWLER: ContentIndexItem = {
  kind: 'project',
  slug: 'shcrawler',
  path: '/projects/shcrawler.md',
  title: 'ShCrawler',
  date: '2026-07-02',
  description: 'Crawler de directorios con rotación de proxies.',
  tags: ['Go', 'Concurrency'],
  group: 'scripts',
};

const TGSFORGE: ContentIndexItem = {
  kind: 'project',
  slug: 'tgsforge',
  path: '/projects/tgsforge.md',
  title: 'TGS-Forge',
  date: '2026-03-11',
  description: 'Automatización de ataques Kerberos.',
  tags: ['Python 3', 'Impacket'],
  group: 'automatizaciones',
};

const PORTMESH: ContentIndexItem = {
  kind: 'project',
  slug: 'portmesh',
  path: '/projects/portmesh.md',
  title: 'PortMesh',
  date: '2026-01-20',
  description: 'Malla TCP para pivoting.',
  tags: ['Rust'],
  group: 'scripts',
};

// Minimum a validated project can be: no group, no description, no tags.
const NOGROUP: ContentIndexItem = {
  kind: 'project',
  slug: 'nogroup',
  path: '/projects/nogroup.md',
  title: 'NoGroup Tool',
};

// Non-canonical group (no pipeline source): TODOS only, never a label.
const WEIRD: ContentIndexItem = {
  ...NOGROUP,
  slug: 'weird',
  path: '/projects/weird.md',
  title: 'Weird',
  group: 'exploits',
};

// Group matching is case-insensitive against the canonical vocabulary.
const UPPER: ContentIndexItem = {
  ...NOGROUP,
  slug: 'upper',
  path: '/projects/upper.md',
  title: 'Upper',
  group: 'SCRIPTS',
};

const ENTRIES: ContentIndexItem[] = [AUTORECON, SHCRAWLER, TGSFORGE, PORTMESH, NOGROUP, WEIRD, UPPER];

const filters = (overrides: Partial<ProjectsFilters>): ProjectsFilters => ({
  ...EMPTY_PROJECTS_FILTERS,
  ...overrides,
});

// Template-only fields: none may appear on a mapped project.
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

describe('buildProjectsModel — filter categories from the REAL groups', () => {
  it('exposes TODOS + the canonical groups with real counts, in screen order', () => {
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(model.filterCategories.map((c) => c.id)).toEqual([
      'TODOS',
      'HERRAMIENTAS',
      'SCRIPTS',
      'AUTOMATIZACIÓN',
    ]);
    expect(model.filterCategories.map((c) => c.group)).toEqual([
      null,
      'herramientas',
      'scripts',
      'automatizaciones',
    ]);
    expect(model.filterCategories.map((c) => c.count)).toEqual([
      ENTRIES.length, // TODOS
      1, // herramientas: autorecon-ng
      3, // scripts: shcrawler, portmesh, upper (case-insensitive)
      1, // automatizaciones: tgsforge
    ]);
  });

  it('the groups are exactly the real PROJECT_GROUPS vocabulary, with no template/EXPLOIT category', () => {
    const groups = PROJECT_FILTER_CATEGORIES.map((c) => c.group)
      .filter((g): g is ProjectGroup => g !== null)
      .sort();
    expect(groups).toEqual([...PROJECT_GROUPS].sort());
    // 'EXPLOIT' exists only in the template's tagCategory union: it has no
    // pipeline group, so it must never appear as a filter category.
    expect(JSON.stringify(PROJECT_FILTER_CATEGORIES)).not.toContain('EXPLOIT');
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(JSON.stringify(model.filterCategories)).not.toContain('EXPLOIT');
  });
});

describe('buildProjectsModel — featured/recientes vs archivo/archive', () => {
  it('featured is documented as the first N of the category-filtered list', () => {
    expect(FEATURED_PROJECT_COUNT).toBe(3); // template FEATURED_PROJECTS = first 3
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(model.featured.map((p) => p.id)).toEqual(['autorecon-ng', 'shcrawler', 'tgsforge']);
    expect(model.featured.map((p) => p.number)).toEqual(['#01', '#02', '#03']);
    expect(model.featuredCount).toBe(3);
    // The archive always holds every matching entry — same entries, no slice.
    expect(model.archive.map((p) => p.id)).toEqual(ENTRIES.map((e) => e.slug));
  });

  it('the category filter changes the featured slice, keeping global number positions', () => {
    const scripts = buildProjectsModel(ENTRIES, filters({ category: 'SCRIPTS' }));
    expect(scripts.featured.map((p) => p.id)).toEqual(['shcrawler', 'portmesh', 'upper']);
    // Numbers derive from the LOADED list order, not from the filtered order.
    expect(scripts.featured.map((p) => p.number)).toEqual(['#02', '#04', '#07']);
    const autos = buildProjectsModel(ENTRIES, filters({ category: 'AUTOMATIZACIÓN' }));
    expect(autos.featured.map((p) => p.id)).toEqual(['tgsforge']);
    expect(autos.featuredCount).toBe(1);
  });

  it('featured ignores the archive search box (the search lives in the explorer view)', () => {
    const model = buildProjectsModel(ENTRIES, filters({ search: 'portmesh' }));
    expect(model.featured.map((p) => p.id)).toEqual(['autorecon-ng', 'shcrawler', 'tgsforge']);
    expect(model.archive.map((p) => p.id)).toEqual(['portmesh']);
  });
});

describe('buildProjectsModel — category filter is driven by the real group field', () => {
  it('matches the pipeline group case-insensitively, never tags or template labels', () => {
    expect(buildProjectsModel(ENTRIES, filters({ category: 'HERRAMIENTAS' })).archive.map((p) => p.id)).toEqual([
      'autorecon-ng',
    ]);
    expect(buildProjectsModel(ENTRIES, filters({ category: 'SCRIPTS' })).archive.map((p) => p.id)).toEqual([
      'shcrawler',
      'portmesh',
      'upper',
    ]);
    // Shared tags ('Python 3') must not leak a project into another category.
    expect(buildProjectsModel(ENTRIES, filters({ category: 'AUTOMATIZACIÓN' })).archive.map((p) => p.id)).toEqual([
      'tgsforge',
    ]);
  });

  it('entries with a missing or non-canonical group only ever appear under TODOS', () => {
    for (const category of ['HERRAMIENTAS', 'SCRIPTS', 'AUTOMATIZACIÓN'] as const) {
      const ids = buildProjectsModel(ENTRIES, filters({ category })).archive.map((p) => p.id);
      expect(ids).not.toContain('nogroup');
      expect(ids).not.toContain('weird');
    }
    const todos = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(todos.archive.map((p) => p.id)).toContain('nogroup');
    expect(todos.archive.map((p) => p.id)).toContain('weird');
  });
});

describe('buildProjectsModel — search over real title/description/tags', () => {
  it('matches title, description and tags, case-insensitive substring', () => {
    expect(buildProjectsModel(ENTRIES, filters({ search: 'AUTORECON' })).archive.map((p) => p.id)).toEqual([
      'autorecon-ng',
    ]);
    expect(buildProjectsModel(ENTRIES, filters({ search: 'reconocimiento' })).archive.map((p) => p.id)).toEqual([
      'autorecon-ng',
    ]);
    expect(buildProjectsModel(ENTRIES, filters({ search: 'nmap' })).archive.map((p) => p.id)).toEqual([
      'autorecon-ng',
    ]);
    expect(buildProjectsModel(ENTRIES, filters({ search: 'python' })).archive.map((p) => p.id)).toEqual([
      'autorecon-ng',
      'tgsforge',
    ]);
    expect(buildProjectsModel(ENTRIES, filters({ search: 'no-such-text' })).archive).toEqual([]);
  });

  it('template-only text can never match: those fields do not exist in the pipeline', () => {
    expect(buildProjectsModel(ENTRIES, filters({ search: 'v1.4.0' })).archive).toEqual([]);
    expect(buildProjectsModel(ENTRIES, filters({ search: '156' })).archive).toEqual([]);
    expect(buildProjectsModel(ENTRIES, filters({ search: '• • STABLE' })).archive).toEqual([]);
  });

  it('search and category intersect in the archive list', () => {
    const model = buildProjectsModel(ENTRIES, filters({ category: 'SCRIPTS', search: 'python' }));
    expect(model.archive).toEqual([]); // 'python' matches herramientas/automatizaciones only
    const ok = buildProjectsModel(ENTRIES, filters({ category: 'AUTOMATIZACIÓN', search: 'python' }));
    expect(ok.archive.map((p) => p.id)).toEqual(['tgsforge']);
    // Whitespace-only search is no search at all.
    expect(buildProjectsModel(ENTRIES, filters({ search: '   ' })).archive).toHaveLength(ENTRIES.length);
  });
});

describe('buildProjectsModel — counts and number positions', () => {
  it('the counts back the "MOSTRANDO X DE Y" lines and agree with the lists', () => {
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(model.totalCount).toBe(ENTRIES.length);
    expect(model.featuredCount).toBe(model.featured.length);
    expect(model.archiveCount).toBe(model.archive.length);
    const searched = buildProjectsModel(ENTRIES, filters({ search: 'python' }));
    expect(searched.featuredCount).toBe(3); // featured = first N of the CATEGORY-filtered list (search ignored)
    expect(searched.archiveCount).toBe(2);
    expect(searched.totalCount).toBe(ENTRIES.length); // totals never shrink with filters
  });

  it('number positions derive from the loaded list order (#01, #02, ...)', () => {
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    expect(model.archive.map((p) => p.number)).toEqual([
      '#01',
      '#02',
      '#03',
      '#04',
      '#05',
      '#06',
      '#07',
    ]);
  });
});

describe('buildProjectsModel — honest mapping', () => {
  it('template-only fields stay absent on every project', () => {
    const model = buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS);
    for (const p of model.archive) {
      for (const field of TEMPLATE_ONLY_PROJECT_FIELDS) {
        expect(p, `${p.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('the category label derives from the real group only (documented map)', () => {
    const byId = new Map(buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS).archive.map((p) => [p.id, p]));
    expect(byId.get('autorecon-ng')!.groupLabel).toBe('HERRAMIENTA');
    expect(byId.get('shcrawler')!.groupLabel).toBe('SCRIPT');
    expect(byId.get('tgsforge')!.groupLabel).toBe('AUTOMATIZACIÓN');
    expect(byId.get('upper')!.group).toBe('scripts'); // normalized canonical group
    expect(byId.get('upper')!.groupLabel).toBe('SCRIPT');
    // Missing/unknown group → no label ever invented (and no group).
    for (const id of ['nogroup', 'weird']) {
      expect(byId.get(id)!).not.toHaveProperty('groupLabel');
      expect(byId.get(id)!).not.toHaveProperty('group');
    }
  });

  it('iconType derives from the group via the documented toUiProject map', () => {
    const byId = new Map(buildProjectsModel(ENTRIES, EMPTY_PROJECTS_FILTERS).archive.map((p) => [p.id, p]));
    expect(byId.get('autorecon-ng')!.iconType).toBe('gear');
    expect(byId.get('shcrawler')!.iconType).toBe('code');
    expect(byId.get('tgsforge')!.iconType).toBe('scan');
    expect(byId.get('nogroup')!.iconType).toBe('shield');
    expect(byId.get('weird')!.iconType).toBe('shield');
  });

  it('is pure and synchronous', () => {
    const before = structuredClone(ENTRIES);
    const f = filters({ category: 'SCRIPTS', search: 'port' });
    const first = buildProjectsModel(ENTRIES, f);
    const second = buildProjectsModel(ENTRIES, f);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.archive).not.toBe(second.archive);
    expect(ENTRIES).toEqual(before); // input untouched
  });
});

describe('real public/index.json entries', () => {
  const raw: Array<Record<string, unknown>> = JSON.parse(
    readFileSync(new URL('../public/index.json', import.meta.url), 'utf8')
  );
  const projects = raw.filter((item) => item.kind === 'project') as unknown as ContentIndexItem[];

  it('is honestly empty today: zero project entries → empty lists, stable zero-count categories', () => {
    const model = buildProjectsModel(projects, EMPTY_PROJECTS_FILTERS);
    expect(projects).toHaveLength(0); // documented current state of the index
    expect(model.featured).toEqual([]);
    expect(model.archive).toEqual([]);
    expect(model.featuredCount).toBe(0);
    expect(model.archiveCount).toBe(0);
    expect(model.totalCount).toBe(0);
    // All canonical categories stay rendered with honest count 0.
    expect(model.filterCategories.map((c) => c.id)).toEqual([
      'TODOS',
      'HERRAMIENTAS',
      'SCRIPTS',
      'AUTOMATIZACIÓN',
    ]);
    expect(model.filterCategories.map((c) => c.count)).toEqual([0, 0, 0, 0]);
  });

  it('counts and numbers always agree with the index, whatever it contains', () => {
    const model = buildProjectsModel(projects, EMPTY_PROJECTS_FILTERS);
    expect(model.totalCount).toBe(projects.length);
    expect(model.featuredCount).toBe(Math.min(projects.length, FEATURED_PROJECT_COUNT));
    expect(model.archiveCount).toBe(projects.length);
    expect(model.filterCategories[0].count).toBe(projects.length);
    expect(model.archive.map((p) => p.number)).toEqual(
      projects.map((_, i) => `#${String(i + 1).padStart(2, '0')}`)
    );
  });
});

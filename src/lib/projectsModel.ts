// Pure, synchronous model builder for the /projects screen.
//
// Takes RAW content-pipeline entries (public/index.json items of kind
// 'project', typed by the repo-root lib/content.ts API) plus the screen's
// filter state and returns exactly what the screen renders: the
// featured/recientes slice, the full archivo/archive list, the filter
// categories and the "MOSTRANDO X DE Y" counts. The screen owns no data logic
// of its own — every derived value (slice, counts, category labels, number
// positions) is computed here from the entries, deterministically and without
// I/O.
//
// Honesty rules (same family as src/lib/directoryModel.ts):
//   - The category filter is driven ONLY by the real pipeline `group`
//     (herramientas | scripts | automatizaciones — the canonical
//     PROJECT_GROUPS vocabulary of lib/content-kinds.js). The screen keeps its
//     uppercase Spanish display labels ('HERRAMIENTAS', 'SCRIPTS',
//     'AUTOMATIZACIÓN') but they are pure labels over real groups: the
//     template's tagCategory vocabulary ('HERRAMIENTA'|'SCRIPT'|
//     'AUTOMATIZACIÓN'|'EXPLOIT') is never a filter source, and 'EXPLOIT' has
//     no pipeline group at all — it is simply gone.
//   - Search matches real `title`/`description`/`tags` only. Template-only
//     text (versions, stars, badges) can never match because it does not
//     exist in the pipeline.
//   - Template-only fields stay absent on mapped projects (toUiProject maps
//     only real fields; the derived `group`/`groupLabel`/`number` added here
//     all come from real data — see below).
//   - `number` (#01, #02, ...) derives from the 1-based position in the list
//     the caller loaded (toUiProject's documented contract) — ordering data
//     the caller really has, preserved across filters.
//   - The category label is a documented deterministic map from the real
//     group (like contentAdapter's icon maps): herramientas→HERRAMIENTA,
//     scripts→SCRIPT, automatizaciones→AUTOMATIZACIÓN. Entries with a
//     missing or non-canonical group get NO label — never an invented one.
//
// Featured vs archive (observable template behavior preserved):
//   - The template's FEATURED_PROJECTS were the first FEATURED_PROJECT_COUNT
//     (= 3) entries of ALL_PROJECTS_ARCHIVE, and the category filter showed
//     the first 3 of the filtered archive. So `featured` = the first N of the
//     category-filtered list ("recientes"); `archive` = every entry matching
//     the category AND the search (the explorer view's list). The search box
//     lives in the explorer view only, so it never affects `featured`.
import type { ContentIndexItem } from '../../types';
import type { Project } from '../types';
import { toUiProject } from './contentAdapter';

/** The "recientes" slice: featured shows at most the first N of the list. */
export const FEATURED_PROJECT_COUNT = 3;

/** Real pipeline project groups (lib/content-kinds.js PROJECT_GROUPS), verbatim. */
export type ProjectGroup = 'scripts' | 'automatizaciones' | 'herramientas';

/** The category pill label on a card: the group's uppercase Spanish label. */
export type ProjectGroupLabel = 'HERRAMIENTA' | 'SCRIPT' | 'AUTOMATIZACIÓN';

/**
 * Screen filter values: 'TODOS' plus the uppercase Spanish display labels of
 * the real groups. These are UI labels only — matching always happens on the
 * real `group` field.
 */
export type ProjectFilterId = 'TODOS' | 'HERRAMIENTAS' | 'SCRIPTS' | 'AUTOMATIZACIÓN';

/** Documented deterministic group → label maps (screen vocabulary preserved). */
export const PROJECT_GROUP_LABELS: Readonly<
  Record<ProjectGroup, { badge: ProjectGroupLabel; filter: ProjectFilterId }>
> = Object.freeze({
  herramientas: { badge: 'HERRAMIENTA', filter: 'HERRAMIENTAS' },
  scripts: { badge: 'SCRIPT', filter: 'SCRIPTS' },
  automatizaciones: { badge: 'AUTOMATIZACIÓN', filter: 'AUTOMATIZACIÓN' },
});

/** One filter button: UI id + the real group it selects (null = TODOS). */
export interface ProjectFilterCategory {
  id: ProjectFilterId;
  /** Real pipeline group this filter selects; null = no group filter. */
  group: ProjectGroup | null;
}

/** A filter button with its real entry count (0 stays visible — honest). */
export interface ProjectCategoryStat extends ProjectFilterCategory {
  count: number;
}

/**
 * The filter vocabulary in the screen's button order (TODOS first, then the
 * canonical groups as the template displayed them). Closed to the real
 * PROJECT_GROUPS: no template/EXPLOIT category can appear here.
 */
export const PROJECT_FILTER_CATEGORIES: readonly ProjectFilterCategory[] = Object.freeze([
  Object.freeze({ id: 'TODOS', group: null }),
  Object.freeze({ id: 'HERRAMIENTAS', group: 'herramientas' }),
  Object.freeze({ id: 'SCRIPTS', group: 'scripts' }),
  Object.freeze({ id: 'AUTOMATIZACIÓN', group: 'automatizaciones' }),
] as ProjectFilterCategory[]);

/** The screen's filter state. Every field backs a real pipeline field. */
export interface ProjectsFilters {
  /** 'TODOS' or one of the real groups' display labels. */
  category: ProjectFilterId;
  /** Free text matched against real `title`/`description`/`tags`. '' = no search. */
  search: string;
}

/** No filters at all: every project. */
export const EMPTY_PROJECTS_FILTERS: ProjectsFilters = Object.freeze({
  category: 'TODOS',
  search: '',
});

/** UI project + the derived real-group display data the screen renders. */
export interface ProjectsViewProject extends Project {
  /** Real pipeline `group`, normalized to the canonical vocabulary. */
  group?: ProjectGroup;
  /** The group's display label (documented map). Absent when group is
   *  missing or non-canonical — the badge hides, never invents a value. */
  groupLabel?: ProjectGroupLabel;
}

export interface ProjectsModel {
  /** Filter buttons in screen order, each with its real count. */
  filterCategories: ProjectCategoryStat[];
  /** "Recientes": first FEATURED_PROJECT_COUNT of the category-filtered list. */
  featured: ProjectsViewProject[];
  /** "Archivo": category + search filtered, full list, in index order. */
  archive: ProjectsViewProject[];
  /** `featured.length` — the "X RECIENTES" / "MOSTRANDO X" value. */
  featuredCount: number;
  /** `archive.length` — the "X DE Y PROYECTOS" value. */
  archiveCount: number;
  /** Every entry considered — the "Y" in every line, filters never shrink it. */
  totalCount: number;
}

// Real pipeline group → canonical vocabulary (case-insensitive); anything the
// pipeline does not recognize stays absent — never mapped onto a real group.
const normalizeGroup = (value: string | undefined): ProjectGroup | undefined => {
  const lower = (value ?? '').trim().toLowerCase();
  return lower === 'herramientas' || lower === 'scripts' || lower === 'automatizaciones'
    ? lower
    : undefined;
};

// Search matches real title/description/tags only — case-insensitive
// substring. Template-only text (versions, stars, badges) can never match
// because it does not exist in the pipeline.
const matchesSearch = (item: ContentIndexItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.description ?? '').toLowerCase().includes(q) ||
    (item.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
  );
};

// Real pipeline entry → the screen's project: toUiProject's honest mapping
// plus the derived real-group display data (position = 1-based index in the
// caller's loaded list).
const toViewProject = (item: ContentIndexItem, position: number): ProjectsViewProject => {
  const group = normalizeGroup(item.group);
  return {
    ...toUiProject(item, position),
    ...(group !== undefined
      ? { group, groupLabel: PROJECT_GROUP_LABELS[group].badge }
      : {}),
  };
};

/**
 * Build the /projects model. Pure and synchronous: same inputs → same output,
 * inputs untouched.
 */
export const buildProjectsModel = (
  entries: readonly ContentIndexItem[],
  filters: ProjectsFilters
): ProjectsModel => {
  // Positions come from the LOADED list order and survive every filter.
  // Each pair keeps the raw entry (search source) next to its mapped project.
  const all = entries.map((item, index) => ({ item, project: toViewProject(item, index + 1) }));

  const category = PROJECT_FILTER_CATEGORIES.find((c) => c.id === filters.category);
  const groupFilter = category?.group ?? null;
  const query = filters.search.trim();

  const categoryMatches = all.filter(
    ({ project }) => groupFilter === null || project.group === groupFilter
  );
  const featured = categoryMatches.slice(0, FEATURED_PROJECT_COUNT).map(({ project }) => project);
  const archive = categoryMatches
    .filter(({ item }) => matchesSearch(item, query))
    .map(({ project }) => project);

  return {
    filterCategories: PROJECT_FILTER_CATEGORIES.map((c) => ({
      ...c,
      count: c.group === null ? all.length : all.filter((p) => p.project.group === c.group).length,
    })),
    featured,
    archive,
    featuredCount: featured.length,
    archiveCount: archive.length,
    totalCount: all.length,
  };
};

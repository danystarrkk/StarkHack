// Pure, synchronous model builder for the /writeups directory screen.
//
// Takes RAW content-pipeline entries (public/index.json items, typed by the
// repo-root lib/content.ts API) plus the screen's filter state and returns
// exactly what the screen renders: platform cards with real counts, the
// filtered writeup list, the global search overlay hits, and the real tag
// options. The screen owns no data logic of its own — every derived value
// (counts, level breakdown, last deploy date, display names) is computed here
// from the entries, deterministically and without I/O.
//
// Honesty rules (same family as src/lib/contentAdapter.ts):
//   - Filters back ONLY real pipeline fields: `platform`, `tags`, `level`,
//     and search over real `title`/`description`/`tags`/`level`/`platform`.
//     There is no os/ports/template-difficulty filter because those fields do
//     not exist in the pipeline — dead controls cannot live here.
//   - `level` is displayed with its REAL vocabulary, verbatim:
//     'Easy' | 'Medium' | 'Hard'. It is NEVER translated into the template's
//     FÁCIL|MEDIO|DIFÍCIL vocabulary (that is the separate template-only
//     Writeup.difficulty union, which the pipeline never fills).
//   - Template-only fields stay absent on mapped writeups (toUiWriteup maps
//     only real fields; `level` and `cve` are added here because the list
//     screen really renders them).
//   - Derived display data is computed from the entries: nodeCount = real
//     entry count, lastDeploy = newest real `date`, levelCounts = real level
//     breakdown. A platform display name comes from the real `categories[0]`
//     only when every entry of the platform agrees on it; otherwise the
//     platform id is shown verbatim — never an invented name.
import type { WriteupIndexItem } from '../../types';
import type { Writeup } from '../types';
import { platformIconType, toUiWriteup } from './contentAdapter';

/** The real pipeline level vocabulary (frontmatter `level`), verbatim. */
export type DirectoryLevel = 'Easy' | 'Medium' | 'Hard';

export const DIRECTORY_LEVELS: readonly DirectoryLevel[] = Object.freeze([
  'Easy',
  'Medium',
  'Hard',
] as DirectoryLevel[]);

/** The screen's filter state. Every field backs a real pipeline field. */
export interface DirectoryFilters {
  /** Real `platform` (matched case-insensitively). null = no platform filter. */
  platformId: string | null;
  /** Real `level`, verbatim vocabulary. 'ALL' = no level filter. */
  level: DirectoryLevel | 'ALL';
  /** Real `tags` entry (exact match). null = no tag filter. */
  tag: string | null;
  /** Free text matched against real `title`/`description`/`tags`/`level`/`platform`. '' = no search. */
  search: string;
}

/** No filters at all: the full directory. */
export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = Object.freeze({
  platformId: null,
  level: 'ALL',
  tag: null,
  search: '',
});

/** UI writeup + the real `level`/`cve` the list screen displays verbatim. */
export interface DirectoryWriteup extends Writeup {
  /** Real pipeline `level`, verbatim 'Easy' | 'Medium' | 'Hard' (never translated). */
  level?: DirectoryLevel;
  /** Real pipeline `cve`, present only when the entry really carries one. */
  cve?: string;
}

/** One /writeups platform card: everything on it derives from the entries. */
export interface PlatformCard {
  /** Real platform id (lowercased), the `?plataforma=` value. */
  id: string;
  /** Display name: consistent real `categories[0]`, else `id` verbatim. */
  name: string;
  /** Deterministic platform → icon map (shared with toUiWriteup). */
  iconType: Writeup['iconType'];
  /** Real number of writeups on the platform. */
  nodeCount: number;
  /** Real level breakdown. */
  levelCounts: Record<DirectoryLevel, number>;
  /** Newest real `date` on the platform (YYYY-MM-DD), absent only if no dates. */
  lastDeploy?: string;
}

export interface DirectoryModel {
  /** Platform grid: one card per real platform, id-ascending. */
  platformCards: PlatformCard[];
  /** Card for the active platform filter, or null (none / unknown platform). */
  activePlatform: PlatformCard | null;
  /** The writeup list honoring ALL filters, in index order. */
  writeups: DirectoryWriteup[];
  /** Global search hits (search text only, ignores the other filters). */
  searchResults: DirectoryWriteup[];
  /** Real tags present in the entries (closed taxonomy), sorted. */
  availableTags: string[];
  /** Total number of entries considered (before filtering). */
  totalCount: number;
}

/** URL/query value → platform id: trimmed, lowercased; blank → null. */
export const normalizePlatformId = (value: string | null | undefined): string | null => {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === '' ? null : normalized;
};

// Search matches real title/description/tags/level/platform fields only —
// case-insensitive substring over each field the /writeups placeholder
// promises (name, tag, level, platform). Template-only text (IPs, ports,
// vulnerabilities) can never match because it does not exist in the pipeline.
const matchesSearch = (item: WriteupIndexItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.description ?? '').toLowerCase().includes(q) ||
    (item.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
    (item.level ?? '').toLowerCase().includes(q) ||
    item.platform.toLowerCase().includes(q) ||
    (item.categories?.[0] ?? '').toLowerCase().includes(q)
  );
};

// Real pipeline entry → the list-screen writeup: toUiWriteup's honest mapping
// plus the real `level`/`cve` this screen displays (absent → never invented).
const toDirectoryWriteup = (item: WriteupIndexItem): DirectoryWriteup => ({
  ...toUiWriteup(item),
  ...(item.level !== undefined ? { level: item.level } : {}),
  ...(item.cve !== undefined ? { cve: item.cve } : {}),
});

const countLevels = (items: readonly WriteupIndexItem[]): Record<DirectoryLevel, number> => ({
  Easy: items.filter((item) => item.level === 'Easy').length,
  Medium: items.filter((item) => item.level === 'Medium').length,
  Hard: items.filter((item) => item.level === 'Hard').length,
});

// Newest real ISO date (YYYY-MM-DD sorts lexicographically), absent if the
// entries carry no dates at all — never a fabricated "3D AGO".
const newestDate = (items: readonly WriteupIndexItem[]): string | undefined => {
  const dates = items
    .map((item) => item.date)
    .filter((date): date is string => typeof date === 'string');
  return dates.length > 0 ? dates.sort().at(-1) : undefined;
};

// Display name: `categories[0]` only when EVERY entry of the platform defines
// one and they all agree; otherwise the platform id verbatim. Real data or
// nothing.
const displayName = (platformId: string, items: readonly WriteupIndexItem[]): string => {
  const names = items.map((item) => item.categories?.[0]);
  const first = names[0];
  if (first === undefined || names.some((name) => name !== first)) return platformId;
  return first;
};

const buildPlatformCards = (entries: readonly WriteupIndexItem[]): PlatformCard[] => {
  const byPlatform = new Map<string, WriteupIndexItem[]>();
  for (const item of entries) {
    const id = item.platform.toLowerCase();
    const bucket = byPlatform.get(id);
    if (bucket) bucket.push(item);
    else byPlatform.set(id, [item]);
  }
  return [...byPlatform.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([id, items]) => ({
      id,
      name: displayName(id, items),
      iconType: platformIconType(id),
      nodeCount: items.length,
      levelCounts: countLevels(items),
      ...(newestDate(items) !== undefined ? { lastDeploy: newestDate(items) } : {}),
    }));
};

/**
 * Build the /writeups directory model. Pure and synchronous: same inputs →
 * same output, inputs untouched.
 */
export const buildDirectoryModel = (
  entries: readonly WriteupIndexItem[],
  filters: DirectoryFilters
): DirectoryModel => {
  const platformCards = buildPlatformCards(entries);
  const platformId = normalizePlatformId(filters.platformId);
  const query = filters.search.trim();

  const activePlatform =
    platformId === null
      ? null
      : (platformCards.find((card) => card.id === platformId) ?? null);

  const matchesFilters = (item: WriteupIndexItem): boolean =>
    (platformId === null || item.platform.toLowerCase() === platformId) &&
    (filters.level === 'ALL' || item.level === filters.level) &&
    (filters.tag === null || (item.tags ?? []).includes(filters.tag)) &&
    matchesSearch(item, query);

  return {
    platformCards,
    activePlatform,
    writeups: entries.filter(matchesFilters).map(toDirectoryWriteup),
    searchResults:
      query === ''
        ? []
        : entries.filter((item) => matchesSearch(item, query)).map(toDirectoryWriteup),
    availableTags: [...new Set(entries.flatMap((item) => item.tags ?? []))].sort((a, b) =>
      a.localeCompare(b, 'en')
    ),
    totalCount: entries.length,
  };
};

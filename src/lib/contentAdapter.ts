// Pure, synchronous mappers: real content pipeline entries
// (public/index.json items, typed by the repo-root lib/content.ts API) → UI
// types (src/types/index.ts).
//
// Honesty rule: ONLY fields the pipeline really supplies are mapped. Every
// template-only field with no pipeline source (os, ports, difficulty,
// vulnerabilities, points, steps, stars, versions, badges, ...) stays ABSENT on
// the result — never invented, never filled with placeholder values. The UI
// components render those chips/labels conditionally.
//
// Documented deterministic icon maps
// ----------------------------------
// Writeup iconType ← platform (case-insensitive):
//   'hackmyvm'   → 'wave'
//   'hackthebox' → 'server'
//   'tryhackme'  → 'network'
//   'vulnhub'    → 'database'
//   anything else (unknown platform) → 'bug'
//
// Project iconType ← group (the pipeline's canonical project classifier):
//   'herramientas'    → 'gear'
//   'scripts'         → 'code'
//   'automatizaciones' → 'scan'
//   missing/unknown group → 'shield'
import type { ContentIndexItem, WriteupIndexItem } from '../../types';
import type { Project, Writeup } from '../types';

const WRITEUP_ICON_BY_PLATFORM: Readonly<Record<string, Writeup['iconType']>> = Object.freeze({
  hackmyvm: 'wave',
  hackthebox: 'server',
  tryhackme: 'network',
  vulnhub: 'database',
});

const FALLBACK_WRITEUP_ICON: Writeup['iconType'] = 'bug';

const PROJECT_ICON_BY_GROUP: Readonly<Record<string, Project['iconType']>> = Object.freeze({
  herramientas: 'gear',
  scripts: 'code',
  automatizaciones: 'scan',
});

const FALLBACK_PROJECT_ICON: Project['iconType'] = 'shield';

/**
 * Writeup index item → UI Writeup. Pure and synchronous.
 *
 * Mapped (real pipeline data): slug→id, title→title, description→summary,
 * date→releaseDate, platform→platformId (lowercased) + derived iconType,
 * tags→tags, image→image. Optional pipeline fields are omitted entirely when
 * absent so no fabricated value can leak into the UI.
 */
export const toUiWriteup = (item: WriteupIndexItem): Writeup => ({
  id: item.slug,
  title: item.title,
  platformId: item.platform.toLowerCase(),
  iconType: WRITEUP_ICON_BY_PLATFORM[item.platform.toLowerCase()] ?? FALLBACK_WRITEUP_ICON,
  ...(item.description !== undefined ? { summary: item.description } : {}),
  ...(item.date !== undefined ? { releaseDate: item.date } : {}),
  ...(item.tags !== undefined ? { tags: item.tags } : {}),
  ...(item.image !== undefined ? { image: item.image } : {}),
});

/**
 * Project index item → UI Project. Pure and synchronous.
 *
 * `position` is the 1-based display position of the project in the list the
 * caller loaded; it deterministically derives `number` (`#01`, `#02`, ...).
 * That is ordering data the caller really has — nothing else is synthesized.
 *
 * Mapped (real pipeline data): slug→id, title→title, description→description,
 * tags→tags, image→image, date→date, group→derived iconType, position→number.
 * Optional pipeline fields are omitted entirely when absent.
 */
export const toUiProject = (item: ContentIndexItem, position: number): Project => ({
  id: item.slug,
  title: item.title,
  number: `#${String(position).padStart(2, '0')}`,
  iconType: PROJECT_ICON_BY_GROUP[item.group ?? ''] ?? FALLBACK_PROJECT_ICON,
  ...(item.description !== undefined ? { description: item.description } : {}),
  ...(item.tags !== undefined ? { tags: item.tags } : {}),
  ...(item.image !== undefined ? { image: item.image } : {}),
  ...(item.date !== undefined ? { date: item.date } : {}),
});

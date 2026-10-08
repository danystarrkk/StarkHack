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
import type { Certification, Project, Writeup } from '../types';

const WRITEUP_ICON_BY_PLATFORM: Readonly<Record<string, Writeup['iconType']>> = Object.freeze({
  hackmyvm: 'wave',
  hackthebox: 'server',
  tryhackme: 'network',
  vulnhub: 'database',
});

const FALLBACK_WRITEUP_ICON: Writeup['iconType'] = 'bug';

// Generic cover per pipeline level (documented map, mirrors the icon maps
// above): the difficulty decides the cover automatically — writeups never
// need a manual markdown reference for their card image. The three covers
// live at public/ui/{easy,medium,hard}.webp.
const WRITEUP_COVER_BY_LEVEL: Readonly<Record<string, Writeup['image']>> = Object.freeze({
  easy: '/ui/easy.webp',
  medium: '/ui/medium.webp',
  hard: '/ui/hard.webp',
});

// Public, single-source platform → iconType derivation (documented map above).
// Used by toUiWriteup and by the /writeups platform cards (directoryModel) so
// the two cannot drift apart.
export const platformIconType = (platform: string): Writeup['iconType'] =>
  WRITEUP_ICON_BY_PLATFORM[platform.toLowerCase()] ?? FALLBACK_WRITEUP_ICON;

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
 * tags→tags. The cover (`image`) is derived from the pipeline `level` via
 * the documented level→cover map; entries without a level fall back to the
 * real per-writeup `image:` cover; entries with neither carry no image at
 * all (never invented).
 */
export const toUiWriteup = (item: WriteupIndexItem): Writeup => ({
  id: item.slug,
  title: item.title,
  platformId: item.platform.toLowerCase(),
  iconType: platformIconType(item.platform),
  ...(item.description !== undefined ? { summary: item.description } : {}),
  ...(item.date !== undefined ? { releaseDate: item.date } : {}),
  ...(item.tags !== undefined ? { tags: item.tags } : {}),
  ...(() => {
    const levelCover =
      item.level !== undefined
        ? WRITEUP_COVER_BY_LEVEL[item.level.toLowerCase()]
        : undefined;
    const cover = levelCover ?? item.image;
    return cover !== undefined ? { image: cover } : {};
  })(),
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

/**
 * Certificate index item → UI Certification. Pure and synchronous.
 *
 * `position` is the 1-based display position of the certificate in the list
 * the caller loaded (getCertificates' canonical `order`); it deterministically
 * derives `number` (`#01`, `#02`, ...). That is ordering data the caller
 * really has — nothing else is synthesized.
 *
 * Mapped (real pipeline data): slug→id, title→title, description→description,
 * tags→tags, date→date, position→number. The group-derived `category` label is
 * added by certificationsModel (same layering as projectsModel's groupLabel).
 * Optional pipeline fields are omitted entirely when absent; every
 * template-only field (version, badges, issuer, statValue, ...) stays ABSENT —
 * never invented.
 */
export const toUiCertification = (item: ContentIndexItem, position: number): Certification => ({
  id: item.slug,
  title: item.title,
  number: `#${String(position).padStart(2, '0')}`,
  ...(item.description !== undefined ? { description: item.description } : {}),
  ...(item.tags !== undefined ? { tags: item.tags } : {}),
  ...(item.date !== undefined ? { date: item.date } : {}),
});

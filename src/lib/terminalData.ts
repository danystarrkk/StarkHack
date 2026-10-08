// Pure, synchronous row builders for the terminal modal's content commands
// (`writeups`, `projects`, `certs`).
//
// Takes RAW content-pipeline entries (public/index.json items, typed by the
// repo-root lib/content.ts API) and returns exactly what each command prints:
// one row per real entry with ONLY real fields (title, platform, date, tags,
// and the group's display label), or — for empty input — an explicit
// honest empty-state row. The component owns no data logic of its own and
// this module never fetches and never touches React: same inputs → same
// rows, deterministically.
//
// Honesty rules (same family as src/lib/projectsModel.ts):
//   - Rows are built through the EXISTING contentAdapter mappers
//     (toUiWriteup / toUiProject / toUiCertification) — mapping logic is
//     reused, never duplicated. Every field on a row is really rendered by
//     the terminal; nothing else is invented.
//   - Template-only fields with no pipeline source (os, difficulty, ports,
//     stars, issuer, badges, ...) never appear on a row — they are dropped,
//     not replaced by placeholders.
//   - The group label is a documented deterministic lookup over the SAME
//     closed vocabulary and labels the /projects and /certifications screens
//     use (PROJECT_GROUP_LABELS in projectsModel, CERTIFICATE_GROUP_LABELS
//     in certificationsModel — imported here so the terminal cannot drift
//     from the screens). The lookup is case-insensitive like the screens'
//     normalizers; a missing or non-canonical group gets NO label — never an
//     invented one. The template's tagCategory/issuer vocabularies have no
//     pipeline source at all and are simply gone.
//   - `date` on certificates is OPTIONAL in the pipeline: when the source
//     has none, the row has none (R3-cert-date-fabricated family).
//   - Empty input yields EXPLICIT empty-state rows (the honest "sin ...
//     todavía" sentences) — never fake entries.
//
// Display composition lives in the component (terminal aesthetic/markup is
// preserved verbatim from the template); this module returns the row data.
import type { ContentIndexItem, WriteupIndexItem } from '../../types';
import { CERTIFICATE_GROUP_LABELS, type CertificationGroupLabel } from './certificationsModel';
import { PROJECT_GROUP_LABELS, type ProjectGroupLabel } from './projectsModel';
import { toUiCertification, toUiProject, toUiWriteup } from './contentAdapter';

/**
 * How many entries the `writeups` command lists: the template's
 * FEATURED_WRITEUPS count — the 3 most recent writeups
 * (getRecentWriteups(TERMINAL_WRITEUP_COUNT)).
 */
export const TERMINAL_WRITEUP_COUNT = 3;

/** One honest empty-state line, rendered when a command has no entries. */
export interface TerminalEmptyRow {
  kind: 'empty';
  /** The honest empty-state sentence the terminal prints. */
  text: string;
}

/** One `writeups` line: real writeup fields only. */
export interface TerminalWriteupRow {
  kind: 'writeup';
  /** Real pipeline slug (toUiWriteup's id) — the React key. */
  id: string;
  title: string;
  /** Real pipeline platform (toUiWriteup's platformId, lowercased). */
  platform: string;
  /** Real pipeline date — absent only when the source has none. */
  date?: string;
  /** Real pipeline tags — absent when the source has none. */
  tags?: string[];
}

/** One `projects` line: real project fields only. */
export interface TerminalProjectRow {
  kind: 'project';
  /** Real pipeline slug (toUiProject's id) — the React key. */
  id: string;
  title: string;
  /**
   * Display label derived from the REAL pipeline `group` (documented map
   * above). Absent when the group is missing or non-canonical — never an
   * invented category.
   */
  groupLabel?: ProjectGroupLabel;
  /** Real pipeline date — absent only when the source has none. */
  date?: string;
}

/** One `certs` line: real certificate fields only. */
export interface TerminalCertificateRow {
  kind: 'certificate';
  /** Real pipeline slug (toUiCertification's id) — the React key. */
  id: string;
  title: string;
  /**
   * Display label derived from the REAL pipeline `group` (documented map
   * above). Absent when the group is missing or non-canonical — never an
   * invented category.
   */
  groupLabel?: CertificationGroupLabel;
  /** Real pipeline date — certificates may omit it and it is never invented. */
  date?: string;
}

export type TerminalWriteupLine = TerminalWriteupRow | TerminalEmptyRow;
export type TerminalProjectLine = TerminalProjectRow | TerminalEmptyRow;
export type TerminalCertificateLine = TerminalCertificateRow | TerminalEmptyRow;

/** The three honest empty-state rows, in the commands' own words. */
export const WRITEUPS_EMPTY_ROW: TerminalEmptyRow = Object.freeze({
  kind: 'empty',
  text: 'sin writeups publicados todavía',
});
export const PROJECTS_EMPTY_ROW: TerminalEmptyRow = Object.freeze({
  kind: 'empty',
  text: 'sin proyectos publicados todavía',
});
export const CERTIFICATES_EMPTY_ROW: TerminalEmptyRow = Object.freeze({
  kind: 'empty',
  text: 'sin certificaciones publicadas todavía',
});

// Real pipeline group → the screens' display label, case-insensitively over
// the closed canonical vocabulary (the maps are the single source — see the
// honesty rules above). Missing or non-canonical → NO label.
const projectGroupLabel = (group: string | undefined): ProjectGroupLabel | undefined => {
  const key = (group ?? '').trim().toLowerCase() as keyof typeof PROJECT_GROUP_LABELS;
  return key in PROJECT_GROUP_LABELS ? PROJECT_GROUP_LABELS[key].badge : undefined;
};

const certificateGroupLabel = (group: string | undefined): CertificationGroupLabel | undefined => {
  const key = (group ?? '').trim().toLowerCase() as keyof typeof CERTIFICATE_GROUP_LABELS;
  return key in CERTIFICATE_GROUP_LABELS ? CERTIFICATE_GROUP_LABELS[key] : undefined;
};

/**
 * Build the `writeups` rows. Pure and synchronous: same inputs → same rows,
 * inputs untouched. Empty input → the explicit empty-state row.
 */
export const buildTerminalWriteupLines = (
  entries: readonly WriteupIndexItem[]
): TerminalWriteupLine[] => {
  if (entries.length === 0) return [WRITEUPS_EMPTY_ROW];
  return entries.map((item) => {
    const ui = toUiWriteup(item);
    return {
      kind: 'writeup' as const,
      id: ui.id,
      title: ui.title,
      platform: ui.platformId,
      ...(ui.releaseDate !== undefined ? { date: ui.releaseDate } : {}),
      ...(ui.tags !== undefined ? { tags: ui.tags } : {}),
    };
  });
};

/**
 * Build the `projects` rows. Pure and synchronous: same inputs → same rows,
 * inputs untouched. Empty input → the explicit empty-state row.
 */
export const buildTerminalProjectLines = (
  entries: readonly ContentIndexItem[]
): TerminalProjectLine[] => {
  if (entries.length === 0) return [PROJECTS_EMPTY_ROW];
  return entries.map((item, index) => {
    // `position` is the 1-based position in the list the caller loaded
    // (toUiProject's documented contract) — ordering data, not invented.
    const ui = toUiProject(item, index + 1);
    const groupLabel = projectGroupLabel(item.group);
    return {
      kind: 'project' as const,
      id: ui.id,
      title: ui.title,
      ...(groupLabel !== undefined ? { groupLabel } : {}),
      ...(ui.date !== undefined ? { date: ui.date } : {}),
    };
  });
};

/**
 * Build the `certs` rows. Pure and synchronous: same inputs → same rows,
 * inputs untouched. Empty input → the explicit empty-state row.
 */
export const buildTerminalCertificateLines = (
  entries: readonly ContentIndexItem[]
): TerminalCertificateLine[] => {
  if (entries.length === 0) return [CERTIFICATES_EMPTY_ROW];
  return entries.map((item, index) => {
    // `position` is the 1-based position in the list the caller loaded
    // (getCertificates' canonical order — toUiCertification's contract).
    const ui = toUiCertification(item, index + 1);
    const groupLabel = certificateGroupLabel(item.group);
    return {
      kind: 'certificate' as const,
      id: ui.id,
      title: ui.title,
      ...(groupLabel !== undefined ? { groupLabel } : {}),
      ...(ui.date !== undefined ? { date: ui.date } : {}),
    };
  });
};

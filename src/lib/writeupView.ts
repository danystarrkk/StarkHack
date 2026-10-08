// Pure, synchronous view-model builder for the writeup detail page.
//
// Source ("a resolved pipeline entry + markdown doc"): the writeup the detail
// route resolves from the REAL content pipeline (public/index.json via
// lib/content.ts) — the index entry mapped with toUiWriteup, plus the real
// markdown document body attached on `markdownContent` (the pipeline
// doc.content from public/writeups/<platform>/<slug>.md).
//
// Output: exactly what WriteupPage renders — real markdown body, chips, tags,
// links and the sections TOC.
//
// Honesty rules (pinned by tests/writeup-view.test.ts):
//   - The body is ALWAYS the real pipeline markdown. Template content
//     (SAMPLE_WRITEUPS_CONTENT) is only ever a source for machineLinks /
//     toolLinks — never for the body or the tags.
//   - Chips render only fields that really exist on the data. No invented
//     badges (the old hardcoded "PWNED: ROOT (100%)" is gone for good), no
//     empty "DIFICULTAD: " / "OS: " chips.
//   - Absent optional fields (tags, os, difficulty, vulnerabilities, ...) can
//     NEVER crash the builder (the old tags useMemo spread
//     `...writeup.vulnerabilities`).
//   - Links come ONLY from curated template data and stay empty (the page
//     hides the sections) when it is absent. The template's generated fallback
//     (getWriteupContent) fabricates IPs, links and star counts and is NEVER
//     used here.
import { extractHeadingsFromMarkdown, type TocHeading } from '../components/MarkdownRenderer';
import { SAMPLE_WRITEUPS_CONTENT, type RichWriteupData } from '../data/writeupContents';
import type { MachineLink, ToolLink, Writeup } from '../types';

export type WriteupViewChipKind = 'platform' | 'difficulty' | 'os';
export type WriteupViewChipTone = 'platform' | 'easy' | 'medium' | 'hard' | 'neutral';

export interface WriteupViewChip {
  kind: WriteupViewChipKind;
  label: string;
  tone: WriteupViewChipTone;
}

/** Everything WriteupPage renders — nothing fabricated, nothing template-sourced. */
export interface WriteupView {
  id: string;
  title: string;
  /** Honest platform label (HackMyVM, HackTheBox, ...); absent when the entry has no platform. */
  platformName?: string;
  summary?: string;
  /** REAL markdown body (writeup.markdownContent === pipeline doc.content). */
  markdownContent: string;
  /** Real entry tags only (normalized). Empty → the TAGS row stays hidden. */
  tags: string[];
  /** Platform chip + optional DIFICULTAD / OS chips. Only fields that exist. */
  chips: WriteupViewChip[];
  /** Template-curated links only; empty → the section stays hidden. */
  machineLinks: MachineLink[];
  toolLinks: ToolLink[];
  /** Sections TOC extracted from the real markdown body (anchors match the renderer). */
  headings: TocHeading[];
}

export interface BuildWriteupViewOptions {
  /**
   * Curated template extras (links are the only thing taken from them).
   * `undefined` → looked up by writeup id in SAMPLE_WRITEUPS_CONTENT (curated
   * entries only, never the generated fabrication). `null` → no template data.
   */
  template?: RichWriteupData | null;
}

// Honest platform label derived from the real platform id. Unknown platforms
// are shown as-is — never relabeled to a platform they are not.
const PLATFORM_NAMES: Readonly<Record<string, string>> = Object.freeze({
  hackmyvm: 'HackMyVM',
  hackthebox: 'HackTheBox',
  tryhackme: 'TryHackMe',
  vulnhub: 'VulnHub',
});

export const platformDisplayName = (platformId: string): string =>
  PLATFORM_NAMES[platformId.toLowerCase()] ?? platformId;

/**
 * The curated template extras for a slug (lookup keys: id, then `hmv-${id}` —
 * the same keys getWriteupContent uses), or null when there are none. Only the
 * CURATED map is consulted: the generated fallback of getWriteupContent
 * fabricates data and must never feed the UI.
 */
export const findCuratedTemplateExtras = (id: string): RichWriteupData | null =>
  SAMPLE_WRITEUPS_CONTENT[id] ?? SAMPLE_WRITEUPS_CONTENT[`hmv-${id}`] ?? null;

const DIFFICULTY_TONE: Readonly<Record<NonNullable<Writeup['difficulty']>, WriteupViewChipTone>> =
  Object.freeze({
    'FÁCIL': 'easy',
    'MEDIO': 'medium',
    'DIFÍCIL': 'hard',
    'INSANE': 'hard',
  });

const isPresent = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

// Real tags only: strip a leading '#', trim and drop empties. No fallback to
// os / difficulty / vulnerabilities (that fallback crashed on absent fields).
const normalizeTags = (tags: string[] | undefined): string[] =>
  (tags ?? [])
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag !== '');

/**
 * Build the writeup detail view model. Pure and synchronous: same input →
 * same output, input untouched, no I/O.
 */
export const buildWriteupView = (
  writeup: Writeup,
  options: BuildWriteupViewOptions = {}
): WriteupView => {
  const template =
    options.template === undefined ? findCuratedTemplateExtras(writeup.id) : options.template;

  const platformName = isPresent(writeup.platformId)
    ? platformDisplayName(writeup.platformId)
    : undefined;

  const chips: WriteupViewChip[] = [];
  if (platformName !== undefined) {
    chips.push({ kind: 'platform', label: platformName.toUpperCase(), tone: 'platform' });
  }
  if (isPresent(writeup.difficulty)) {
    chips.push({
      kind: 'difficulty',
      label: `DIFICULTAD: ${writeup.difficulty}`,
      tone: DIFFICULTY_TONE[writeup.difficulty] ?? 'neutral',
    });
  }
  if (isPresent(writeup.os)) {
    chips.push({ kind: 'os', label: `OS: ${writeup.os}`, tone: 'neutral' });
  }

  const markdownContent = writeup.markdownContent ?? '';

  return {
    id: writeup.id,
    title: writeup.title,
    ...(platformName !== undefined ? { platformName } : {}),
    ...(isPresent(writeup.summary) ? { summary: writeup.summary } : {}),
    markdownContent,
    tags: normalizeTags(writeup.tags),
    chips,
    machineLinks: template?.machineLinks ?? [],
    toolLinks: template?.toolLinks ?? [],
    headings: extractHeadingsFromMarkdown(markdownContent),
  };
};

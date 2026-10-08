// Pure, synchronous view-model builder for the project detail page.
//
// Source ("the pipeline project", `ProjectViewSource` of src/types/index.ts):
// the project the detail route resolves from the REAL content pipeline
// (public/index.json via lib/content.ts) — the index entry mapped with
// toUiProject, its real raw `group`, and the real markdown document body
// attached on `readme` (the pipeline doc.content from
// public/projects/<slug>.md).
//
// Output: exactly what ProjectPage renders — real markdown body, chips, tags,
// metadata and the sections TOC.
//
// Honesty rules (pinned by tests/project-view.test.ts):
//   - The body is ALWAYS the real pipeline markdown. Template content
//     (SAMPLE_PROJECTS_CONTENT) is NEVER a source — not for the body, tags or
//     links. Its generated fallback (getProjectContent) fabricates data and
//     crashes on pipeline-mapped objects, so this builder has zero dependency
//     on src/data (which the next phase deletes).
//   - Chips render only fields that really exist on the data: the group-derived
//     badge (documented PROJECT_GROUP_LABELS map of lib/projectsModel.ts) and
//     the real date. The invented "• • ACTIVE" status badge and the
//     template-only subBadge are gone for good; the group-derived icon rides
//     through toUiProject (documented map of lib/contentAdapter.ts), never
//     relabeled here.
//   - Absent optional fields (group, date, description, tags, readme) can
//     NEVER crash the builder (the old getProjectContent fallback threw on
//     pipeline-mapped objects).
//   - Sidebar links come ONLY from fields with a real source: githubUrl → one
//     repo link, or explicit projectLinks / toolLinks when the real data
//     carries them. Template-sample links are never used; without a real
//     source the lists stay empty and the page hides the sections. Fields with
//     no pipeline source at all (stars, versions, badges) stay ABSENT.
import { extractHeadingsFromMarkdown, type TocHeading } from '../components/MarkdownRenderer';
import { PROJECT_GROUP_LABELS, type ProjectGroup, type ProjectGroupLabel } from './projectsModel';
import type { Project, ProjectLink, ProjectViewSource, ToolLink } from '../types';

export type ProjectViewChipKind = 'group' | 'date';
export type ProjectViewChipTone = 'group' | 'neutral';

export interface ProjectViewChip {
  kind: ProjectViewChipKind;
  label: string;
  tone: ProjectViewChipTone;
}

/** Everything ProjectPage renders — nothing fabricated, nothing template-sourced. */
export interface ProjectView {
  id: string;
  title: string;
  /** Display position ('#01', '#02', ...) — real listing order (toUiProject). */
  number?: string;
  /** Group-derived icon (contentAdapter's documented map via toUiProject). */
  iconType: Project['iconType'];
  /** Group-derived badge label (projectsModel's documented map). Absent when
   *  the group is missing or non-canonical — never an invented category. */
  groupBadge?: ProjectGroupLabel;
  date?: string;
  description?: string;
  /** Real entry tags only (normalized). Empty → the tags row stays hidden. */
  tags: string[];
  /** Group badge + FECHA chips. Only fields that exist. */
  chips: ProjectViewChip[];
  /** REAL markdown body (project.readme === pipeline doc.content). */
  markdownContent: string;
  /** Sections TOC extracted from the real markdown body (anchors match the renderer). */
  headings: TocHeading[];
  /** Real repo URL (frontmatter `githubUrl`), when the data supplies one. */
  repoUrl?: string;
  /** Real-source sidebar links only; empty → the sections stay hidden. */
  projectLinks: ProjectLink[];
  toolLinks: ToolLink[];
}

// Group → badge label through the documented map of projectsModel (the single
// source of truth for the vocabulary). Membership comes from the map's own
// keys; only the case-insensitive normalization mirrors projectsModel's
// contract (its normalizeGroup is module-private and not an edit surface here).
// Unknown or missing groups get NO label — never an invented one.
const groupBadgeFor = (group: string | undefined): ProjectGroupLabel | undefined => {
  const key = (group ?? '').trim().toLowerCase();
  return Object.keys(PROJECT_GROUP_LABELS).includes(key)
    ? PROJECT_GROUP_LABELS[key as ProjectGroup].badge
    : undefined;
};

const isPresent = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

// Real tags only: strip a leading '#', trim and drop empties. No fallback to
// template sample tags (that data is never a source here).
const normalizeTags = (tags: string[] | undefined): string[] =>
  (tags ?? [])
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter((tag) => tag !== '');

/**
 * Build the project detail view model. Pure and synchronous: same input →
 * same output, input untouched, no I/O.
 */
export const buildProjectView = (project: ProjectViewSource): ProjectView => {
  const groupBadge = groupBadgeFor(project.group);

  const chips: ProjectViewChip[] = [];
  if (groupBadge !== undefined) {
    chips.push({ kind: 'group', label: groupBadge, tone: 'group' });
  }
  if (isPresent(project.date)) {
    chips.push({ kind: 'date', label: `FECHA: ${project.date}`, tone: 'neutral' });
  }

  const markdownContent = project.readme ?? '';

  return {
    id: project.id,
    title: project.title,
    ...(project.number !== undefined ? { number: project.number } : {}),
    iconType: project.iconType,
    ...(groupBadge !== undefined ? { groupBadge } : {}),
    ...(isPresent(project.date) ? { date: project.date } : {}),
    ...(isPresent(project.description) ? { description: project.description } : {}),
    tags: normalizeTags(project.tags),
    chips,
    markdownContent,
    headings: extractHeadingsFromMarkdown(markdownContent),
    ...(isPresent(project.githubUrl) ? { repoUrl: project.githubUrl } : {}),
    // Links: real sources ONLY. Explicit link lists when the data carries
    // them; otherwise one repo link derived from the real githubUrl; never
    // template-sample links (SAMPLE_PROJECTS_CONTENT is not imported here).
    projectLinks:
      project.projectLinks ??
      (isPresent(project.githubUrl)
        ? [{ title: 'GITHUB REPO', url: project.githubUrl, type: 'github' }]
        : []),
    toolLinks: project.toolLinks ?? [],
  };
};

// Project detail view-model contract: the PURE builder `buildProjectView`
// (src/lib/projectView.ts) turns a project resolved from the REAL content
// pipeline — the index entry mapped with toUiProject plus its real `group`
// and its real markdown document body (pipeline doc.content from
// public/projects/<slug>.md, carried on `project.readme`) — into exactly what
// ProjectPage renders: markdown body, chips, tags, metadata and the sections
// TOC.
//
// Hard rules under test:
//   1. The body is ALWAYS the real pipeline markdown. The template's
//      SAMPLE_PROJECTS_CONTENT is never the source of the body (its generated
//      fallback fabricates data and crashes on pipeline-mapped objects).
//   2. Chips/badges render only what the real data has: the group-derived
//      badge (the documented PROJECT_GROUP_LABELS map) and the real date. The
//      invented status badge ("• • ACTIVE") and the template-only subBadge
//      are gone for good.
//   3. Tags / description / date / number come from the real entry only, and
//      absent optional fields can NEVER crash the builder (the old
//      getProjectContent fallback threw on pipeline-mapped objects).
//   4. Sidebar links come ONLY from fields with a real source (githubUrl →
//      one repo link; explicit projectLinks / toolLinks when the data really
//      carries them). Template-sample links are NEVER used — the sections
//      hide when there is no real source. Stars / versions / badges stay
//      absent, never invented.
//   5. The TOC is extracted from the real markdown body: fenced-code comments
//      are not headings, and every TOC anchor matches the id MarkdownRenderer
//      actually renders (so the sidebar links scroll to the right place).
//
// public/index.json has 0 project entries today, so correctness is pinned over
// synthetic pipeline-shaped entries (ContentIndexItem) assembled exactly like
// ProjectDetailRoute assembles them — the same approach tests/router.test.ts
// uses for the project resolution paths.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { toUiProject } from '../src/lib/contentAdapter';
import { MarkdownRenderer } from '../src/components/MarkdownRenderer';
import { SAMPLE_PROJECTS_CONTENT } from '../src/data/projectContents';
import { buildProjectView } from '../src/lib/projectView';
import type { ContentIndexItem } from '../types';
import type { Project, ProjectLink, ProjectViewSource, ToolLink } from '../src/types';

// ---------------------------------------------------------------------------
// Synthetic pipeline-shaped fixtures (the pipeline has no project entries yet)
// ---------------------------------------------------------------------------

const PIPELINE_ENTRY: ContentIndexItem = {
  kind: 'project',
  slug: 'autorecon-ng',
  path: '/projects/autorecon-ng.md',
  title: 'AutoRecon-NG',
  date: '2026-01-15',
  group: 'herramientas',
  description: 'Framework de reconocimiento automatizado.',
  tags: ['#Recon', '  Pentesting  ', ''],
};

const PIPELINE_README = [
  '# AutoRecon-NG',
  '',
  'Framework **asíncrono** de reconocimiento.',
  '',
  '```bash',
  '# comentario de shell, no es un encabezado',
  'python3 autorecon-ng.py --target 10.10.10.0/24',
  '```',
  '',
  '## Arquitectura',
  '',
  '### Motor de escaneo',
  '',
  '## Instalación',
].join('\n');

// Exactly what ProjectDetailRoute builds from the resolved pipeline detail:
// the mapped index entry + its real group + the real markdown body
// (ProjectViewSource = the pipeline Project + its real raw group).
// `readme: null` = the pipeline detail has no body for this project.
const pipelineProject = (
  entry: ContentIndexItem = PIPELINE_ENTRY,
  position = 1,
  readme: string | null = PIPELINE_README
): ProjectViewSource => ({
  ...toUiProject(entry, position),
  ...(entry.group !== undefined ? { group: entry.group } : {}),
  ...(readme !== null ? { readme } : {}),
});

// The smallest object the pipeline can resolve: no group / date / description
// / tags / readme at all.
const BARE_ENTRY: ContentIndexItem = {
  kind: 'project',
  slug: 'nuevo-proyecto',
  path: '/projects/nuevo-proyecto.md',
  title: 'Nuevo Proyecto',
};
const BARE_SOURCE: Project = pipelineProject(BARE_ENTRY, 2, null);

// A pipeline entry for a slug that DOES hold curated template content, so the
// "template is never the source" rules can be pinned against real template
// data (SAMPLE_PROJECTS_CONTENT['autorecon-ng']).
const NO_TEMPLATE_ENTRY: ContentIndexItem = {
  kind: 'project',
  slug: 'krustykrab',
  path: '/projects/krustykrab.md',
  title: 'KrustyKrab',
  date: '2026-02-01',
  group: 'scripts',
};

// ---------------------------------------------------------------------------
// 1. Body: the REAL markdown, never template content
// ---------------------------------------------------------------------------

describe('buildProjectView — body source', () => {
  it('renders the real pipeline markdown as the body', () => {
    const view = buildProjectView(pipelineProject());
    expect(view.markdownContent).toBe(PIPELINE_README);
    expect(view.markdownContent).toContain('python3 autorecon-ng.py');
    expect(view.markdownContent).toContain('## Arquitectura');
  });

  it('never takes the body from SAMPLE_PROJECTS_CONTENT, even for a slug with curated template content', () => {
    const curated = SAMPLE_PROJECTS_CONTENT['autorecon-ng'];
    expect(curated).toBeDefined(); // "autorecon-ng" DOES hold curated template content
    expect(curated.markdown).not.toBe(PIPELINE_README); // and it is a different document
    const view = buildProjectView(pipelineProject());
    expect(view.markdownContent).not.toBe(curated.markdown);
    expect(view.markdownContent).toBe(PIPELINE_README);
  });

  it('an absent readme yields an empty body — template markdown is still not used', () => {
    const view = buildProjectView(pipelineProject(PIPELINE_ENTRY, 1, null));
    expect(view.markdownContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. Chips: group-derived badge + real date only — no invented badges
// ---------------------------------------------------------------------------

describe('buildProjectView — chips and group-derived badge/icon', () => {
  it('renders the group badge from the real group and the date chip only when the date exists', () => {
    const view = buildProjectView(pipelineProject());
    expect(view.groupBadge).toBe('HERRAMIENTA');
    expect(view.chips).toEqual([
      { kind: 'group', label: 'HERRAMIENTA', tone: 'group' },
      { kind: 'date', label: 'FECHA: 2026-01-15', tone: 'neutral' },
    ]);
  });

  it('derives the badge through the documented PROJECT_GROUP_LABELS map, case-insensitively', () => {
    const badgeFor = (group: string) =>
      buildProjectView(pipelineProject({ ...NO_TEMPLATE_ENTRY, group })).groupBadge;
    expect(badgeFor('herramientas')).toBe('HERRAMIENTA');
    expect(badgeFor('scripts')).toBe('SCRIPT');
    expect(badgeFor('Automatizaciones')).toBe('AUTOMATIZACIÓN');
  });

  it('has no group badge when the group is missing or non-canonical — never an invented one', () => {
    for (const entry of [BARE_ENTRY, { ...NO_TEMPLATE_ENTRY, group: 'exploit' }, { ...NO_TEMPLATE_ENTRY, group: '' }]) {
      const view = buildProjectView(pipelineProject(entry));
      expect(view.groupBadge).toBeUndefined();
      expect(view.chips.map((c) => c.kind)).not.toContain('group');
      expect(view.chips.map((c) => c.label).join(' | ')).not.toMatch(/EXPLOIT/);
    }
  });

  it('passes through the group-derived icon (contentAdapter map via toUiProject) without relabeling', () => {
    expect(buildProjectView(pipelineProject()).iconType).toBe('gear'); // herramientas
    expect(
      buildProjectView(pipelineProject({ ...NO_TEMPLATE_ENTRY, group: 'scripts' }, 3)).iconType
    ).toBe('code');
    expect(buildProjectView(BARE_SOURCE).iconType).toBe('shield'); // no group → honest fallback
  });

  it('never emits the invented ACTIVE status badge, the template-only subBadge, or empty chips', () => {
    const sources = [
      BARE_SOURCE,
      pipelineProject(),
      pipelineProject(NO_TEMPLATE_ENTRY, 3, null),
    ];
    for (const source of sources) {
      const labels = buildProjectView(source)
        .chips.map((chip) => chip.label)
        .join(' | ');
      expect(labels).not.toMatch(/ACTIVE/i);
      expect(labels).not.toMatch(/undefined/);
      expect(labels).not.toMatch(/:\s*$/); // no empty "FECHA: " chips
    }
  });

  it('has no chips at all when the entry has neither group nor date', () => {
    expect(buildProjectView(BARE_SOURCE).chips).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Metadata & tags: real entry data only, crash-safe on absent fields
// ---------------------------------------------------------------------------

describe('buildProjectView — metadata and tags', () => {
  it('maps only the real metadata the entry supplies and nothing more', () => {
    const view = buildProjectView(pipelineProject());
    expect(view.id).toBe('autorecon-ng');
    expect(view.title).toBe('AutoRecon-NG');
    expect(view.date).toBe('2026-01-15');
    expect(view.description).toBe('Framework de reconocimiento automatizado.');
    expect(view.number).toBe('#01'); // real listing position (toUiProject contract)
  });

  it('uses only the real tags of the entry, normalized', () => {
    expect(buildProjectView(pipelineProject()).tags).toEqual(['Recon', 'Pentesting']);
  });

  it('takes no tags from template data', () => {
    const view = buildProjectView(
      pipelineProject({ ...PIPELINE_ENTRY, tags: undefined }, 1, null)
    );
    expect(view.tags).toEqual([]);
  });

  it('absent optional fields can never crash the builder (old getProjectContent regression)', () => {
    expect(() => buildProjectView(BARE_SOURCE)).not.toThrow();
    const view = buildProjectView(BARE_SOURCE);
    expect(view.date).toBeUndefined();
    expect(view.description).toBeUndefined();
    expect(view.tags).toEqual([]);
    expect(view.number).toBe('#02');
    expect(view.markdownContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 4. Links: ONLY from fields with a real source — sections hide otherwise
// ---------------------------------------------------------------------------

describe('buildProjectView — sidebar links', () => {
  it('hides both link sections (empty lists) when the real data has no link source — even with curated template content', () => {
    const view = buildProjectView(pipelineProject(PIPELINE_ENTRY, 1, null));
    expect(view.projectLinks).toEqual([]);
    expect(view.toolLinks).toEqual([]);
    expect(view.repoUrl).toBeUndefined();
  });

  it('never fabricates links (template samples and the generated fallback are not a source)', () => {
    const curated = SAMPLE_PROJECTS_CONTENT['autorecon-ng'];
    expect(curated).toBeDefined();
    expect(curated.projectLinks.length).toBeGreaterThan(0);
    const view = buildProjectView(pipelineProject(PIPELINE_ENTRY, 1, null));
    const urls = [...view.projectLinks, ...view.toolLinks].map((l) => l.url);
    expect(urls).toEqual([]);
    // neither the curated template URL nor the generated fallback's fake link
    expect(urls).not.toContain('https://github.com/starkhack/autorecon-ng');
    expect(urls).not.toContain('https://github.com/danystark/stark-recon-suite');
  });

  it('derives the repo sidebar link from the real githubUrl only', () => {
    const source: Project = { ...BARE_SOURCE, githubUrl: 'https://github.com/starkhack/real-repo' };
    const view = buildProjectView(source);
    expect(view.repoUrl).toBe('https://github.com/starkhack/real-repo');
    expect(view.projectLinks).toEqual([
      { title: 'GITHUB REPO', url: 'https://github.com/starkhack/real-repo', type: 'github' },
    ]);
  });

  it('passes through explicit projectLinks / toolLinks the real data supplies, verbatim', () => {
    const projectLinks: ProjectLink[] = [
      { title: 'Documentación', url: 'https://example.test/docs', type: 'docs' },
    ];
    const toolLinks: ToolLink[] = [
      { name: 'herramienta', url: 'https://example.test/tool', description: 'recurso de referencia' },
    ];
    const view = buildProjectView({ ...BARE_SOURCE, projectLinks, toolLinks });
    expect(view.projectLinks).toEqual(projectLinks);
    expect(view.toolLinks).toEqual(toolLinks);
  });
});

// ---------------------------------------------------------------------------
// 5. Sections TOC from the real markdown — correct and anchored
// ---------------------------------------------------------------------------

describe('buildProjectView — sections TOC', () => {
  it('extracts the real section list from the pipeline readme', () => {
    const view = buildProjectView(pipelineProject());
    expect(view.headings.map((h) => h.cleanText)).toEqual([
      'AutoRecon-NG',
      'Arquitectura',
      'Motor de escaneo',
      'Instalación',
    ]);
    expect(view.headings[0].level).toBe(1);
    expect(view.headings[1].level).toBe(2);
    expect(view.headings[2].level).toBe(3);
  });

  it('fenced-code comments are not headings', () => {
    const view = buildProjectView({
      ...BARE_SOURCE,
      readme: [
        '# Real',
        '',
        '```bash',
        '# comentario de shell, no es un encabezado',
        'echo "# tampoco"',
        '```',
        '',
        '## También real',
        '',
        '# Real',
      ].join('\n'),
    });
    expect(view.headings.map((h) => h.cleanText)).toEqual(['Real', 'También real', 'Real']);
  });

  it('every TOC anchor matches the id MarkdownRenderer renders', () => {
    const duplicated = [
      '# Duplicado',
      '',
      '```bash',
      '# comentario dentro de código',
      '```',
      '',
      '## Duplicado',
      '',
      '# Duplicado',
      '',
      '# !!',
      '',
      '## Válido',
    ].join('\n');
    const fixtures = [PIPELINE_README, duplicated];
    for (const markdown of fixtures) {
      const { headings } = buildProjectView({ ...BARE_SOURCE, readme: markdown });
      const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: markdown }));
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings) {
        expect(markup, `anchor ${heading.id} must exist in the rendered document`).toContain(
          `id="${heading.id}"`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Purity + the page itself (rendered): real body in, invented badges out
// ---------------------------------------------------------------------------

describe('buildProjectView — purity', () => {
  it('is pure and synchronous', () => {
    const source = pipelineProject();
    const before = structuredClone(source);
    const first = buildProjectView(source);
    const second = buildProjectView(source);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(source).toEqual(before); // input untouched
  });
});

describe('ProjectPage (rendered with real pipeline data)', () => {
  // Dynamic import keeps the RED failure honest: ProjectPage must consume the
  // new builder instead of the template content map (whose generated fallback
  // fabricates data and crashes on pipeline-mapped objects).
  const renderPage = async (source: Project): Promise<string> => {
    const { ProjectPage } = await import('../src/components/ProjectPage');
    return renderToStaticMarkup(
      createElement(ProjectPage, { project: source, onBack: () => undefined })
    );
  };

  it('renders the real markdown body for /projects/autorecon-ng', async () => {
    const markup = await renderPage(pipelineProject());
    // Real pipeline body fragments (none of them exist in the template body):
    expect(markup).toContain('python3 autorecon-ng.py');
    expect(markup).toContain('10.10.10.0/24');
    expect(markup).toContain('Motor de escaneo');
    // The renderer formats inline markdown (bold becomes <strong>), so the raw
    // `**` markers are gone — but the real words of the pipeline paragraph are
    // rendered.
    expect(markup).toContain('de reconocimiento.');
    // The curated template body is NOT the rendered source.
    expect(markup).not.toContain('Clonación del repositorio oficial');
  });

  it('renders a minimal pipeline project without crashing (the old getProjectContent fallback threw on it)', async () => {
    const markup = await renderPage(BARE_SOURCE);
    expect(markup).toContain('Nuevo Proyecto');
  });

  it('shows no invented badges and hides template-only chrome on real data', async () => {
    const markup = await renderPage(pipelineProject());
    expect(markup).not.toMatch(/ACTIVE/);
    expect(markup).not.toMatch(/undefined/);
    expect(markup).toContain('HERRAMIENTA'); // real group-derived badge
  });

  it('renders link sections only when the real data has a link source', async () => {
    const withoutLinks = await renderPage(pipelineProject(PIPELINE_ENTRY, 1, null));
    expect(withoutLinks).not.toContain('ENLACES DEL PROYECTO');
    expect(withoutLinks).not.toContain('HERRAMIENTAS & OTROS LINKS');

    const withRepo = await renderPage({
      ...pipelineProject(PIPELINE_ENTRY, 1, null),
      githubUrl: 'https://github.com/starkhack/real-repo',
    });
    expect(withRepo).toContain('ENLACES DEL PROYECTO');
    expect(withRepo).toContain('https://github.com/starkhack/real-repo');
    expect(withRepo).not.toContain('HERRAMIENTAS & OTROS LINKS');
  });
});

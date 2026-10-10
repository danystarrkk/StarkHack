// Home model contract: the single orchestration behind the Home screen
// (src/lib/homeModel.ts) plus the honesty of the FeaturedProjects counters.
//
// Honesty rules under test:
//   - The Home grid shows the 3 most recent writeups and the 3 most recent
//     projects (the shared mostRecentByDate rule: date descending, stable
//     tie-break on equal dates), while the counters report the REAL total of
//     project entries in the index — the grid never lies about its size.
//   - No hardcoded slugs: every expectation is derived from the real
//     public/index.json the browser loads at runtime, so future content
//     changes keep the contract without editing this file.
//
// Style follows tests/router.test.ts: real repo data via readFileSync,
// renderToStaticMarkup from react-dom/server, vi.stubGlobal fetch stub.
//
// NOTE on the dynamic import: `loadHomeContent` is loaded via `await import`
// inside the tests instead of a top-level static import so each contract
// fails on its own during the RED phase (the missing module rejects only the
// loader tests; the counter and source-structure pins still observe their own
// real failures). After implementation the dynamic import resolves normally.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeaturedProjects } from '../src/components/FeaturedProjects';
import { toUiProject } from '../src/lib/contentAdapter';
import type { ContentIndexItem } from '../types';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Real pipeline fixtures straight from the repository (the same source the
// browser loads at runtime).
const REAL_INDEX = JSON.parse(readFileSync('public/index.json', 'utf8')) as ContentIndexItem[];
const REAL_PROJECTS = REAL_INDEX.filter((item) => item.kind === 'project');
const REAL_PROJECT_TOTAL = REAL_PROJECTS.length;

const stubPipelineFetch = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      if (String(input) === '/index.json') {
        return new Response(JSON.stringify(REAL_INDEX));
      }
      return new Response('not found', { status: 404 });
    })
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadHomeContent against the real index', () => {
  it('returns the 3 most recent writeups, the 3 most recent projects and the real project total', async () => {
    stubPipelineFetch();
    const { HOME_WRITEUP_COUNT, HOME_PROJECT_COUNT, loadHomeContent } = await import(
      '../src/lib/homeModel'
    );
    expect(HOME_WRITEUP_COUNT).toBe(3);
    expect(HOME_PROJECT_COUNT).toBe(3);

    const content = await loadHomeContent();

    expect(content.writeups.length).toBe(3);
    expect(content.projects.length).toBe(3);
    expect(content.projectTotal).toBe(REAL_PROJECT_TOTAL);
  });

  it('never displays a project newer than the oldest displayed one (excluded are not more recent)', async () => {
    stubPipelineFetch();
    const { loadHomeContent } = await import('../src/lib/homeModel');

    const content = await loadHomeContent();
    const displayedIds = new Set(content.projects.map((project) => project.id));
    const displayedTimes = content.projects
      .map((project) => (project.date === undefined ? NaN : Date.parse(project.date)))
      .filter((time) => !Number.isNaN(time));
    // The oldest displayed date is the cutoff. Vacuous when no displayed
    // entry carries a parseable date — dates are never invented.
    const cutoff = displayedTimes.length > 0 ? Math.min(...displayedTimes) : undefined;
    const excluded = REAL_PROJECTS.filter((item) => !displayedIds.has(item.slug));

    expect(excluded.length).toBe(REAL_PROJECT_TOTAL - content.projects.length);
    if (cutoff !== undefined) {
      for (const item of excluded) {
        const time = item.date === undefined ? NaN : Date.parse(item.date);
        // Missing/unparseable dates sort last, so they are never "newer".
        if (!Number.isNaN(time)) {
          expect(time, `${item.slug} is newer than every displayed project`).toBeLessThanOrEqual(
            cutoff
          );
        }
      }
    }
  });
});

describe('FeaturedProjects counters use the real total, not the grid length', () => {
  it('renders both counters from totalCount when it is greater than projects.length', () => {
    const featured = REAL_PROJECTS.slice(0, 3).map((item, index) => toUiProject(item, index + 1));
    // The discriminating scenario: the real index holds more projects than
    // the 3-card grid, so the counters can only match if they use totalCount.
    expect(REAL_PROJECT_TOTAL).toBeGreaterThan(featured.length);

    const markup = renderToStaticMarkup(
      createElement(FeaturedProjects, {
        projects: featured,
        totalCount: REAL_PROJECT_TOTAL,
        onSelectProject: () => {},
        onExploreAll: () => {},
      })
    );

    expect(markup).toContain(`INDEX: ${String(REAL_PROJECT_TOTAL).padStart(2, '0')} REPOSITORIOS`);
    expect(markup).toContain(`• ${REAL_PROJECT_TOTAL} REPOSITORIOS INDEXADOS`);
  });

  it('still reports the grid length when totalCount is omitted (default)', () => {
    const featured = REAL_PROJECTS.slice(0, 3).map((item, index) => toUiProject(item, index + 1));

    const markup = renderToStaticMarkup(
      createElement(FeaturedProjects, {
        projects: featured,
        onSelectProject: () => {},
        onExploreAll: () => {},
      })
    );

    expect(markup).toContain(`INDEX: ${String(featured.length).padStart(2, '0')} REPOSITORIOS`);
    expect(markup).toContain(`• ${featured.length} REPOSITORIOS INDEXADOS`);
  });
});

describe('Home source structure', () => {
  it('routes Home loading through loadHomeContent(), never getProjects() directly', () => {
    const homeSource = readFileSync(path.join(repoRoot, 'src', 'lib', 'Home.tsx'), 'utf8');

    expect(homeSource).toContain('loadHomeContent(');
    expect(homeSource).not.toContain('getProjects(');
  });
});

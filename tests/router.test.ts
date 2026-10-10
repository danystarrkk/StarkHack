// Route table contract: the template's `activeTab` state is replaced by real
// react-router routing. These tests pin the route table as REAL BEHAVIOUR:
// createMemoryRouter + RouterProvider rendered with renderToStaticMarkup
// (react-dom/server, already installed — no new dependencies).
//
// SSR note (honest scope): renderToStaticMarkup does not run effects, so async
// content loaders render their honest loading state and the detail-route data
// resolution is pinned separately against the REAL pipeline (public/index.json
// + public/writeups/...) through resolveWriteupDetail/resolveProjectDetail with
// a stubbed fetch. Nothing here is a stronger claim than what is observed.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../src/lib/router';
import {
  hasTemplateProjectContent,
  resolveProjectDetail,
  resolveWriteupDetail,
} from '../src/lib/detailRoutes';

// The router settles loader-driven navigation (e.g. redirect loaders)
// asynchronously; poll until the initial navigation has completed.
const settle = async (router: ReturnType<typeof createMemoryRouter>): Promise<void> => {
  for (let tick = 0; tick < 500 && !router.state.initialized; tick += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const renderRoute = async (
  initialEntry: string
): Promise<{ router: ReturnType<typeof createMemoryRouter>; markup: string; matchedIds: string[] }> => {
  const router = createMemoryRouter(ROUTES, { initialEntries: [initialEntry] });
  await settle(router);
  const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
  const matchedIds = router.state.matches.map((match) => match.route.id ?? '');
  return { router, markup, matchedIds };
};

// Real pipeline fixtures straight from the repository (the same sources the
// browser loads at runtime).
const REAL_INDEX = JSON.parse(readFileSync('public/index.json', 'utf8')) as unknown;
const REAL_WAVE_MD = readFileSync('public/writeups/hackmyvm/wave.md', 'utf8');

const stubPipelineFetch = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url === '/index.json') {
        return new Response(JSON.stringify(REAL_INDEX));
      }
      if (url === '/writeups/hackmyvm/wave.md') {
        return new Response(REAL_WAVE_MD);
      }
      return new Response('not found', { status: 404 });
    })
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('route table (createMemoryRouter + renderToStaticMarkup)', () => {
  it('/writeups renders the writeups screen', async () => {
    const { markup, matchedIds } = await renderRoute('/writeups');
    expect(matchedIds).toContain('writeups');
    expect(markup).toContain('Search archives (name, tag, level, platform)');
  });

  it('/about renders the about screen', async () => {
    const { markup, matchedIds } = await renderRoute('/about');
    expect(matchedIds).toContain('about');
    expect(markup).toContain('ABOUT ME');
  });

  it('/directory (old URL) lands on /writeups', async () => {
    const { router, markup, matchedIds } = await renderRoute('/directory');
    expect(router.state.location.pathname).toBe('/writeups');
    expect(matchedIds).toContain('writeups');
    expect(markup).toContain('Search archives (name, tag, level, platform)');
  });

  it('/machines/:platformId (old URL) lands on /writeups?plataforma=:platformId', async () => {
    const { router } = await renderRoute('/machines/hackmyvm');
    expect(router.state.location.pathname).toBe('/writeups');
    expect(router.state.location.search).toBe('?plataforma=hackmyvm');
  });

  it('/writeups/hackmyvm/wave resolves the detail route', async () => {
    const { markup, matchedIds, router } = await renderRoute('/writeups/hackmyvm/wave');
    expect(matchedIds).toContain('writeup');
    const detailMatch = router.state.matches[router.state.matches.length - 1];
    expect(detailMatch.params).toEqual({ platformId: 'hackmyvm', slug: 'wave' });
    // SSR renders the honest loading state (effects do not run server-side);
    // the async resolution itself is pinned below against the real pipeline.
    expect(markup).toContain('CARGANDO CONTENIDO');
    expect(markup).toContain('/writeups/hackmyvm/wave');
  });

  it('* renders the styled 404 not-found state', async () => {
    const { markup, matchedIds } = await renderRoute('/no/such/route');
    expect(matchedIds).toContain('not-found');
    expect(markup).toContain('404');
    expect(markup).toContain('RUTA NO ENCONTRADA');
  });

  it('/ renders the home screen shell', async () => {
    const { markup, matchedIds } = await renderRoute('/');
    expect(matchedIds).toContain('home');
    expect(markup).toContain('CARGANDO CONTENIDO DESDE');
  });
});

describe('detail route resolution against the real content pipeline', () => {
  it('resolveWriteupDetail resolves /writeups/hackmyvm/wave from real data', async () => {
    stubPipelineFetch();
    const resolved = await resolveWriteupDetail('hackmyvm', 'wave');
    expect(resolved).not.toBeNull();
    expect(resolved!.entry.slug).toBe('wave');
    expect(resolved!.entry.title).toBe('Wave');
    expect(resolved!.doc.content).toContain('# Enumeración');
  });

  it('resolveWriteupDetail returns null for unknown slugs (honest not-found)', async () => {
    stubPipelineFetch();
    expect(await resolveWriteupDetail('hackmyvm', 'no-such-writeup')).toBeNull();
    expect(await resolveWriteupDetail('nosuchplatform', 'wave')).toBeNull();
  });

  it('resolveProjectDetail returns null when the pipeline has no projects yet', async () => {
    stubPipelineFetch();
    expect(await resolveProjectDetail('autorecon-ng')).toBeNull();
  });

  it('project detail components only render where they hold curated content (never generated fakes)', () => {
    // SAMPLE_PROJECTS_CONTENT holds curated project content only; its
    // generated fallback invents IPs, scan output, links and star counts, so
    // the detail routes must NOT render it and only report availability.
    // (Writeup-side there is no template source anymore: links come from the
    // writeup's frontmatter alone — the writeup-side availability export was
    // deleted.)
    expect(hasTemplateProjectContent('autorecon-ng')).toBe(true);
    expect(hasTemplateProjectContent('not-a-project')).toBe(false);
  });
});

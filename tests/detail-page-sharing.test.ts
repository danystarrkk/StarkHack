import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// P2 U2 (p2-structure, H3 of the audit): the detail pages (WriteupPage and
// ProjectPage) mirrored ~100 lines of scroll machinery (reading progress +
// active TOC heading under one listener, smooth scroll with re-anchoring) and
// copy-to-clipboard flag state. The machinery now lives in
// src/lib/useDetailScroll.ts and src/lib/useCopyFlag.ts; the pages consume
// them. Pinned structurally (node test environment, no jsdom), same contract
// style as tests/use-content-query.test.ts.
// ---------------------------------------------------------------------------

const read = (relative: string): string =>
  readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const PAGES = ['src/components/WriteupPage.tsx', 'src/components/ProjectPage.tsx'];

describe('detail pages share the scroll/copy machinery (p2 U2)', () => {
  it('exports the shared hooks contract', () => {
    expect(read('src/lib/useDetailScroll.ts')).toContain('export function useDetailScroll');
    expect(read('src/lib/useCopyFlag.ts')).toContain('export function useCopyFlag');
  });

  it.each(PAGES)('%s consumes the shared hooks', (page) => {
    const source = read(page);
    expect(source).toContain('useDetailScroll(');
    expect(source).toContain('useCopyFlag(');
  });

  it.each(PAGES)('%s no longer hand-rolls scroll listeners or clipboard flags', (page) => {
    const source = read(page);
    expect(source).not.toContain("addEventListener('scroll'");
    expect(source).not.toContain('navigator.clipboard');
    expect(source).not.toContain('window.setInterval'); // re-anchoring lives in the hook
  });
});

// ---------------------------------------------------------------------------
// P2 U6b (p2-structure, H4): both filter rows render from the model — the
// hand-cloned button blocks (and the CLI's text-anchor cloning) are gone; a
// new group needs its label/entry in the models and an accent entry, never a
// new JSX button.
// ---------------------------------------------------------------------------

describe('filter buttons render from the model (p2 U6b)', () => {
  const projects = readFileSync(
    new URL('../src/components/ProjectsScreen.tsx', import.meta.url),
    'utf8'
  );
  const certifications = readFileSync(
    new URL('../src/components/CertificationsScreen.tsx', import.meta.url),
    'utf8'
  );

  it.each([
    ['ProjectsScreen', projects, 'PROJECT_FILTER_ACCENT'],
    ['CertificationsScreen', certifications, 'CERT_FILTER_ACCENT'],
  ])('%s maps model.filterCategories with its accent map and no static filter click', (_name, source, accent) => {
    expect(source).toContain('model.filterCategories.map(');
    expect(source).toContain(accent);
    expect(source).toContain('FALLBACK');
    // No hand-written per-group button with a static filter id remains.
    expect(source).not.toMatch(/onClick=\{\(\) => setActiveFilter\('[^']+'\)\}/);
  });
});

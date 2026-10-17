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

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  GlobalErrorBoundary,
  GlobalErrorFallback,
} from '../src/components/GlobalErrorBoundary';

// ---------------------------------------------------------------------------
// P1 reliability (p1-reliability S3): a render crash anywhere below the shell
// must become an honest visible state, never a white screen. The vitest
// environment is `node` (no jsdom), so the boundary is covered by a structural
// pin (it wraps the Outlet), a fallback render pin, and a unit of its
// getDerivedStateFromError — same contract style as tests/styling.test.ts.
// ---------------------------------------------------------------------------

describe('GlobalErrorBoundary — app shell contract', () => {
  it('App renders the Outlet inside the global error boundary (structural pin)', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('GlobalErrorBoundary');
    expect(app).toMatch(/<GlobalErrorBoundary>[\s\S]*<Outlet[\s\S]*<\/GlobalErrorBoundary>/);
  });

  it('flips into its error state when a child throws', () => {
    expect(GlobalErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
  });

  it('the fallback is an honest panel with a way back home', () => {
    const markup = renderToStaticMarkup(createElement(GlobalErrorFallback, null));
    expect(markup).toContain('ERROR');
    expect(markup).toContain('href="/"');
  });
});

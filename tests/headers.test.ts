import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Security headers contract (url-scheme-hardening S2). public/_headers is the
// Netlify/Cloudflare-Pages format served for every path; if the host changes,
// the same directives must be mirrored (vercel.json headers array) — this pin
// keeps the contract visible either way.
describe('public/_headers — security headers contract', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

  it('sets the baseline hardening headers', () => {
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin');
  });

  it('serves a CSP that keeps the site working and scripts same-origin only', () => {
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("script-src 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("base-uri 'self'");
    // The Google Fonts loaded by index.html must stay allowed.
    expect(headers).toContain('https://fonts.gstatic.com');
    expect(headers).toContain('https://fonts.googleapis.com');
  });
});

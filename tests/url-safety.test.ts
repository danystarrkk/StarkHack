import { describe, expect, it } from 'vitest';
import { isSafeUrl } from '../lib/url-safety.js';

// Shared URL-scheme allowlist (P0 security hardening, url-scheme-hardening S3).
// The site renders content-supplied URLs (markdown bodies, frontmatter links,
// image paths). Only http(s) and site-relative locations are allowed to reach
// an href/src: every other scheme (javascript:, data:, vbscript:, file:) and
// scheme-relative '//host' URLs are rejected at every layer that touches them
// (pipeline validation and render-time guards).
describe('isSafeUrl — shared scheme allowlist', () => {
  it('accepts http(s) absolute URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com/path?q=1#frag')).toBe(true);
  });

  it('accepts site-relative locations (/, ./, #, ?)', () => {
    expect(isSafeUrl('/writeups/hackmyvm/wave/media/cover.webp')).toBe(true);
    expect(isSafeUrl('./sibling.md')).toBe(true);
    expect(isSafeUrl('#seccion')).toBe(true);
    expect(isSafeUrl('?orden=fecha')).toBe(true);
  });

  it('rejects every executable or off-origin scheme', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false); // case-insensitive
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('mailto:someone@example.com')).toBe(false);
    expect(isSafeUrl('blob:https://example.com/uuid')).toBe(false);
  });

  it('rejects scheme-relative URLs (//host) — they escape the site origin', () => {
    expect(isSafeUrl('//evil.example/steal')).toBe(false);
  });

  it('rejects empty, whitespace and non-string values', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl(' javascript:alert(1)')).toBe(false); // untrimmed scheme
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl({})).toBe(false);
  });
});

// Regression probes from the independent verification (T7): browsers
// normalize URLs (strip tabs/newlines/control chars, treat leading
// backslashes as slashes), so an obfuscated scheme must be rejected BEFORE
// that happens.
describe('isSafeUrl — URL-normalization obfuscation (verifier probes)', () => {
  it('rejects schemes obfuscated with control characters', () => {
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false);
    expect(isSafeUrl('java\nscript:alert(1)')).toBe(false);
    expect(isSafeUrl('java\rscript:alert(1)')).toBe(false);
    expect(isSafeUrl('\u0001javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('\u0000data:text/html,x')).toBe(false);
  });

  it('rejects backslash scheme-relative URLs (browsers treat a leading backslash pair as slashes)', () => {
    expect(isSafeUrl('\\evil.com/x')).toBe(false);
    expect(isSafeUrl(' \\evil.com/x')).toBe(false);
  });
});

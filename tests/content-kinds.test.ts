import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_GROUPS,
  KINDS,
  PROJECT_GROUPS,
  missingFields,
} from '../lib/content-kinds.js';

describe('KINDS registry (single source of truth)', () => {
  it('defines exactly the three content kinds', () => {
    expect(Object.keys(KINDS).sort()).toEqual(['certificate', 'project', 'writeup']);
  });

  it('writeup: platformed under public/writeups, requiring title and date', () => {
    expect(KINDS.writeup.root).toBe('public/writeups');
    expect(KINDS.writeup.platformed).toBe(true);
    expect(KINDS.writeup.required).toEqual(['title', 'date']);
  });

  it('project: flat under public/projects, requiring title, date and image', () => {
    expect(KINDS.project.root).toBe('public/projects');
    expect(KINDS.project.platformed).toBe(false);
    expect(KINDS.project.required).toEqual(['title', 'date', 'image']);
  });

  it('certificate: flat under public/certificates, requiring title, order, image and description', () => {
    expect(KINDS.certificate.root).toBe('public/certificates');
    expect(KINDS.certificate.platformed).toBe(false);
    expect(KINDS.certificate.required).toEqual(['title', 'order', 'image', 'description']);
  });

  it('uses three distinct content roots', () => {
    const roots = Object.values(KINDS).map((spec) => spec.root);
    expect(new Set(roots).size).toBe(3);
  });
});

describe('missingFields', () => {
  it('reports every required key that is absent', () => {
    expect(missingFields({}, 'writeup')).toEqual(['title', 'date']);
    expect(missingFields({}, 'project')).toEqual(['title', 'date', 'image']);
    expect(missingFields({}, 'certificate')).toEqual(['title', 'order', 'image', 'description']);
  });

  it('treats null values as missing', () => {
    expect(missingFields({ title: null, date: '2026-01-01' }, 'writeup')).toEqual(['title']);
  });

  it('treats empty and whitespace-only strings as missing', () => {
    expect(missingFields({ title: '', date: '2026-01-01' }, 'writeup')).toEqual(['title']);
    expect(missingFields({ title: '   ', date: '2026-01-01' }, 'writeup')).toEqual(['title']);
    expect(missingFields({ title: '\t\n', date: '2026-01-01' }, 'writeup')).toEqual(['title']);
  });

  it('treats non-string values as missing', () => {
    expect(missingFields({ title: 42, date: '2026-01-01' }, 'writeup')).toEqual(['title']);
    expect(missingFields({ title: ['a'], date: '2026-01-01' }, 'writeup')).toEqual(['title']);
    expect(missingFields({ title: true, date: '2026-01-01' }, 'writeup')).toEqual(['title']);
    expect(missingFields({ title: { nested: 1 }, date: '2026-01-01' }, 'writeup')).toEqual(['title']);
  });

  it('accepts present non-empty strings', () => {
    expect(missingFields({ title: 'Wave', date: '2026-01-01' }, 'writeup')).toEqual([]);
  });

  it('reports only the missing keys, keeping the required order', () => {
    expect(missingFields({ date: '2026-01-01' }, 'project')).toEqual(['title', 'image']);
  });

  it('treats only absent/null order as missing (integer validity is checked separately)', () => {
    const base = { title: 'Cert', image: '/x.webp', description: 'd' };

    expect(missingFields({ ...base, order: 3 }, 'certificate')).toEqual([]);
    // Strings and floats are PRESENT here: the generator rejects them with its
    // own "Invalid certificate order" error, not with a missing-field error.
    expect(missingFields({ ...base, order: '3' }, 'certificate')).toEqual([]);
    expect(missingFields({ ...base, order: 2.5 }, 'certificate')).toEqual([]);
    expect(missingFields({ ...base, order: null }, 'certificate')).toEqual(['order']);
    expect(missingFields(base, 'certificate')).toEqual(['order']);
  });

  it('throws for an unknown kind', () => {
    expect(() => missingFields({}, 'book')).toThrow(/book/);
  });
});

// ---------------------------------------------------------------------------
// P2 U6: the group vocabularies carry a literal-tuple `@type` so
// src/types/kinds.ts can derive the ProjectGroup/CertificateGroup unions at
// the type level. The tuple must never drift from the runtime array — pinned
// here (the registry CLI rewrites both lines together on every addition).
// ---------------------------------------------------------------------------

describe('group vocabularies — literal-tuple @type pin (p2 U6)', () => {
  const source = readFileSync(new URL('../lib/content-kinds.js', import.meta.url), 'utf8');

  function tupleFor(name: string): string[] {
    const match = new RegExp(
      `@type \\{readonly \\[([^\\]]+)\\]\\}\\s*\\n \\*/\\nexport const ${name}`
    ).exec(source);
    expect(match, `${name} literal-tuple @type`).not.toBeNull();
    return match![1].split(',').map((entry) => entry.trim().replace(/^'|'$/g, ''));
  }

  it('PROJECT_GROUPS @type tuple matches the runtime array', () => {
    expect(tupleFor('PROJECT_GROUPS')).toEqual([...PROJECT_GROUPS]);
  });

  it('CERTIFICATE_GROUPS @type tuple matches the runtime array', () => {
    expect(tupleFor('CERTIFICATE_GROUPS')).toEqual([...CERTIFICATE_GROUPS]);
  });
});

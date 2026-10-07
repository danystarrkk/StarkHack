import { describe, expect, it } from 'vitest';
import { CERTIFICATE_GROUPS, KINDS, PROJECT_GROUPS } from '../lib/content-kinds.js';
import { CERTIFICATE_TAGS, PROJECT_TAGS, TAGS } from '../lib/taxonomy.js';

// R3-kinds-shallow-frozen: Object.freeze(KINDS) only protects the top-level
// key set. The kind specs and their nested lists must be frozen too, otherwise
// e.g. KINDS.project.required.push('x') silently mutates the shared vocabulary
// that the indexer, the drift tests and the app all read.

describe('KINDS is deep-frozen', () => {
  it('freezes each kind spec object itself', () => {
    expect(Object.isFrozen(KINDS.writeup)).toBe(true);
    expect(Object.isFrozen(KINDS.project)).toBe(true);
    expect(Object.isFrozen(KINDS.certificate)).toBe(true);
  });

  it('freezes the nested required lists', () => {
    expect(Object.isFrozen(KINDS.writeup.required)).toBe(true);
    expect(Object.isFrozen(KINDS.project.required)).toBe(true);
    expect(Object.isFrozen(KINDS.certificate.required)).toBe(true);
  });

  it('keeps the nested group and tag vocabularies frozen', () => {
    expect(Object.isFrozen(KINDS.writeup.tags)).toBe(true);
    expect(Object.isFrozen(KINDS.project.groups)).toBe(true);
    expect(Object.isFrozen(KINDS.project.tags)).toBe(true);
    expect(Object.isFrozen(KINDS.certificate.groups)).toBe(true);
    expect(Object.isFrozen(KINDS.certificate.tags)).toBe(true);
  });

  // Mutation attempts must THROW (ES modules are strict mode) instead of
  // silently growing the vocabulary. Kept in one test, last in the file, so a
  // pre-fix mutation cannot leak into the assertions above.
  it('rejects mutation of a nested list instead of silently changing the vocabulary', () => {
    expect(() => (KINDS.project.groups as string[]).push('x')).toThrow();
    expect(() => (KINDS.project.required as string[]).push('x')).toThrow();
    expect(() => (KINDS.certificate.required as string[]).push('x')).toThrow();
    expect(() => {
      (KINDS.project as { root: string }).root = 'x';
    }).toThrow();
    expect(() => (KINDS.project.tags as string[]).push('x')).toThrow();
  });
});

describe('taxonomy vocabulary lists are frozen (verified graph)', () => {
  it('freezes every canonical list in lib/taxonomy.js and lib/content-kinds.js', () => {
    expect(Object.isFrozen(TAGS)).toBe(true);
    expect(Object.isFrozen(PROJECT_TAGS)).toBe(true);
    expect(Object.isFrozen(CERTIFICATE_TAGS)).toBe(true);
    expect(Object.isFrozen(PROJECT_GROUPS)).toBe(true);
    expect(Object.isFrozen(CERTIFICATE_GROUPS)).toBe(true);
  });

  it('shares those very lists with KINDS (one frozen vocabulary, no copies)', () => {
    expect(KINDS.project.groups).toBe(PROJECT_GROUPS);
    expect(KINDS.certificate.groups).toBe(CERTIFICATE_GROUPS);
    expect(KINDS.writeup.tags).toBe(TAGS);
    expect(KINDS.project.tags).toBe(PROJECT_TAGS);
    expect(KINDS.certificate.tags).toBe(CERTIFICATE_TAGS);
  });
});

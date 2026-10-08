// Certifications model contract: the pure, synchronous builder behind the
// /certifications screen. It takes RAW content-pipeline entries
// (public/index.json certificate items, typed by the repo-root lib/content.ts
// API) plus the screen's filter state and returns exactly what the screen
// renders: the filtered certificate list, the filter categories driven by the
// REAL `group` field, the "MOSTRANDO X ... Y TOTALES" counts and the derived
// `number` display positions.
//
// Honesty rules under test (same family as tests/projects-model.test.ts):
//   - The category filter is driven ONLY by the real pipeline `group`
//     (universidad | hack4u | cisco — the canonical CERTIFICATE_GROUPS
//     vocabulary), displayed with the screen's uppercase Spanish labels.
//     The template's category vocabulary ('UDEMY' | 'OFFSEC') is never a
//     filter source: those have no pipeline group at all.
//   - Template-only fields (version, statusBadge, subBadge, statValue, year,
//     issueDate, issuer, badgeId, ...) never appear on the mapped
//     certificates; the category label is derived from the real group only,
//     and stays absent for missing/unknown groups.
//   - `number` positions derive from the loaded list order (getCertificates()
//     canonical order) — never invented.
//   - There is NO text search on this screen: the model carries only the
//     category filter the screen really has.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_GROUP_LABELS,
  CERTIFICATION_FILTER_CATEGORIES,
  EMPTY_CERTIFICATIONS_FILTERS,
  buildCertificationsModel,
  type CertificateGroup,
  type CertificationsFilters,
} from '../src/lib/certificationsModel';
import { CERTIFICATE_GROUPS } from '../lib/content-kinds.js';
import type { ContentIndexItem } from '../types';

// Real certificate entry shapes (public/index.json items of kind 'certificate';
// the generator validates `order` on every certificate entry).
const GRADO: ContentIndexItem = {
  kind: 'certificate',
  slug: 'grado-informatica',
  path: '/certifications/grado-informatica.md',
  title: 'Cursando Grado en Ingeniería Informática',
  order: 1,
  group: 'universidad',
  description: 'Especialización en arquitectura de sistemas, seguridad de redes y criptografía aplicada.',
  tags: ['Redes', 'C/C++', 'Linux'],
  date: '2025-09-01',
};

const HACKING: ContentIndexItem = {
  kind: 'certificate',
  slug: 'hacking-etico',
  path: '/certifications/hacking-etico.md',
  title: 'Introducción al Hacking Ético',
  order: 2,
  group: 'hack4u',
  description: 'Metodologías ofensivas de reconocimiento y explotación web.',
  tags: ['Web Exploitation', 'Burp Suite'],
  date: '2024-02-24',
};

const CCNA: ContentIndexItem = {
  kind: 'certificate',
  slug: 'ccna',
  path: '/certifications/ccna.md',
  title: 'CCNA: Introduction to Networks',
  order: 3,
  group: 'cisco',
  tags: ['Redes', 'TCP/IP'],
};

const LINUX: ContentIndexItem = {
  kind: 'certificate',
  slug: 'linux-hardening',
  path: '/certifications/linux-hardening.md',
  title: 'Linux Security & Hardening',
  order: 4,
  group: 'hack4u',
};

// Minimum a validated certificate can be: no group, no date, no description,
// no tags.
const MINIMAL: ContentIndexItem = {
  kind: 'certificate',
  slug: 'minimal',
  path: '/certifications/minimal.md',
  title: 'Minimal Cert',
  order: 5,
};

// Non-canonical group (no pipeline source): TODOS only, never a label.
const UDEMYG: ContentIndexItem = {
  ...MINIMAL,
  slug: 'udemy-linux',
  path: '/certifications/udemy-linux.md',
  title: 'Udemy Linux',
  order: 6,
  group: 'udemy',
};

// Group matching is case-insensitive against the canonical vocabulary.
const UPPER: ContentIndexItem = {
  ...MINIMAL,
  slug: 'upper',
  path: '/certifications/upper.md',
  title: 'Upper',
  order: 7,
  group: 'HACK4U',
};

const ENTRIES: ContentIndexItem[] = [GRADO, HACKING, CCNA, LINUX, MINIMAL, UDEMYG, UPPER];

const filters = (overrides: Partial<CertificationsFilters>): CertificationsFilters => ({
  ...EMPTY_CERTIFICATIONS_FILTERS,
  ...overrides,
});

// Template-only fields: none may appear on a mapped certificate.
const TEMPLATE_ONLY_CERT_FIELDS = [
  'version',
  'statusBadge',
  'subBadge',
  'iconType',
  'statValue',
  'year',
  'issueDate',
  'issuer',
  'badgeId',
  'pdfUrl',
  'verificationUrl',
  'status',
  'isPending',
  'skills',
];

describe('buildCertificationsModel — filter categories from the REAL groups', () => {
  it('exposes TODOS + the canonical groups with real counts, in screen order', () => {
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.filterCategories.map((c) => c.id)).toEqual([
      'TODOS',
      'UNIVERSIDAD',
      'HACK4U',
      'CISCO',
    ]);
    expect(model.filterCategories.map((c) => c.group)).toEqual([
      null,
      'universidad',
      'hack4u',
      'cisco',
    ]);
    expect(model.filterCategories.map((c) => c.count)).toEqual([
      ENTRIES.length, // TODOS
      1, // universidad: grado-informatica
      3, // hack4u: hacking-etico, linux-hardening, upper (case-insensitive)
      1, // cisco: ccna
    ]);
  });

  it('the groups are exactly the real CERTIFICATE_GROUPS vocabulary, with no template/UDEMY|OFFSEC category', () => {
    const groups = CERTIFICATION_FILTER_CATEGORIES.map((c) => c.group)
      .filter((g): g is CertificateGroup => g !== null)
      .sort();
    expect(groups).toEqual([...CERTIFICATE_GROUPS].sort());
    // 'UDEMY' and 'OFFSEC' exist only in the template's category union: they
    // have no pipeline group, so they must never appear as filter categories.
    const serialized = JSON.stringify(CERTIFICATION_FILTER_CATEGORIES);
    expect(serialized).not.toContain('UDEMY');
    expect(serialized).not.toContain('OFFSEC');
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(JSON.stringify(model.filterCategories)).not.toContain('UDEMY');
    expect(JSON.stringify(model.filterCategories)).not.toContain('OFFSEC');
  });

  it('canonical groups with no entries keep an honest count 0', () => {
    const model = buildCertificationsModel([GRADO], EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.filterCategories.map((c) => c.id)).toEqual([
      'TODOS',
      'UNIVERSIDAD',
      'HACK4U',
      'CISCO',
    ]);
    expect(model.filterCategories.map((c) => c.count)).toEqual([1, 1, 0, 0]);
  });
});

describe('buildCertificationsModel — category filter is driven by the real group field', () => {
  it('matches the pipeline group case-insensitively, never tags or template labels', () => {
    expect(
      buildCertificationsModel(ENTRIES, filters({ category: 'UNIVERSIDAD' })).certificates.map((c) => c.id)
    ).toEqual(['grado-informatica']);
    expect(
      buildCertificationsModel(ENTRIES, filters({ category: 'HACK4U' })).certificates.map((c) => c.id)
    ).toEqual(['hacking-etico', 'linux-hardening', 'upper']);
    expect(
      buildCertificationsModel(ENTRIES, filters({ category: 'CISCO' })).certificates.map((c) => c.id)
    ).toEqual(['ccna']);
  });

  it('entries with a missing or non-canonical group only ever appear under TODOS', () => {
    for (const category of ['UNIVERSIDAD', 'HACK4U', 'CISCO'] as const) {
      const ids = buildCertificationsModel(ENTRIES, filters({ category })).certificates.map((c) => c.id);
      expect(ids).not.toContain('minimal');
      expect(ids).not.toContain('udemy-linux');
    }
    const todos = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(todos.certificates.map((c) => c.id)).toContain('minimal');
    expect(todos.certificates.map((c) => c.id)).toContain('udemy-linux');
  });

  it('preserves the caller order (getCertificates canonical order) in every filter', () => {
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.certificates.map((c) => c.id)).toEqual(ENTRIES.map((e) => e.slug));
    const hack4u = buildCertificationsModel(ENTRIES, filters({ category: 'HACK4U' }));
    expect(hack4u.certificates.map((c) => c.id)).toEqual([
      'hacking-etico',
      'linux-hardening',
      'upper',
    ]);
  });
});

describe('buildCertificationsModel — counts and number positions', () => {
  it('the counts back the "MOSTRANDO X ... Y TOTALES" line and agree with the lists', () => {
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.totalCount).toBe(ENTRIES.length);
    expect(model.filteredCount).toBe(model.certificates.length);
    expect(model.filteredCount).toBe(ENTRIES.length); // TODOS filters nothing
    const hack4u = buildCertificationsModel(ENTRIES, filters({ category: 'HACK4U' }));
    expect(hack4u.filteredCount).toBe(3);
    expect(hack4u.totalCount).toBe(ENTRIES.length); // totals never shrink with filters
  });

  it('number positions derive from the loaded list order (#01, #02, ...), kept across filters', () => {
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.certificates.map((c) => c.number)).toEqual([
      '#01',
      '#02',
      '#03',
      '#04',
      '#05',
      '#06',
      '#07',
    ]);
    // Filtering keeps the GLOBAL positions of the loaded list (the screen's
    // display order), never renumbers the filtered subset.
    const hack4u = buildCertificationsModel(ENTRIES, filters({ category: 'HACK4U' }));
    expect(hack4u.certificates.map((c) => c.number)).toEqual(['#02', '#04', '#07']);
  });
});

describe('buildCertificationsModel — honest mapping', () => {
  it('template-only fields stay absent on every certificate', () => {
    const model = buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS);
    for (const c of model.certificates) {
      for (const field of TEMPLATE_ONLY_CERT_FIELDS) {
        expect(c, `${c.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('maps the real fields only: slug/title/description/tags/date', () => {
    const byId = new Map(
      buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS).certificates.map((c) => [c.id, c])
    );
    const grado = byId.get('grado-informatica')!;
    expect(grado.title).toBe(GRADO.title);
    expect(grado.description).toBe(GRADO.description);
    expect(grado.tags).toEqual(GRADO.tags);
    expect(grado.date).toBe('2025-09-01');
    // Absent optional pipeline fields stay absent — never placeholders.
    const minimal = byId.get('minimal')!;
    expect(minimal).not.toHaveProperty('description');
    expect(minimal).not.toHaveProperty('tags');
    expect(minimal).not.toHaveProperty('date');
  });

  it('the category label derives from the real group only (documented map)', () => {
    const byId = new Map(
      buildCertificationsModel(ENTRIES, EMPTY_CERTIFICATIONS_FILTERS).certificates.map((c) => [c.id, c])
    );
    expect(CERTIFICATE_GROUP_LABELS).toEqual({
      universidad: 'UNIVERSIDAD',
      hack4u: 'HACK4U',
      cisco: 'CISCO',
    });
    expect(byId.get('grado-informatica')!.category).toBe('UNIVERSIDAD');
    expect(byId.get('hacking-etico')!.category).toBe('HACK4U');
    expect(byId.get('ccna')!.category).toBe('CISCO');
    expect(byId.get('upper')!.group).toBe('hack4u'); // normalized canonical group
    expect(byId.get('upper')!.category).toBe('HACK4U');
    // Missing/unknown group → no category and no group, never invented.
    for (const id of ['minimal', 'udemy-linux']) {
      expect(byId.get(id)!).not.toHaveProperty('category');
      expect(byId.get(id)!).not.toHaveProperty('group');
    }
  });

  it('is pure and synchronous', () => {
    const before = structuredClone(ENTRIES);
    const f = filters({ category: 'HACK4U' });
    const first = buildCertificationsModel(ENTRIES, f);
    const second = buildCertificationsModel(ENTRIES, f);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.certificates).not.toBe(second.certificates);
    expect(ENTRIES).toEqual(before); // input untouched
  });
});

describe('real public/index.json entries', () => {
  const raw: Array<Record<string, unknown>> = JSON.parse(
    readFileSync(new URL('../public/index.json', import.meta.url), 'utf8')
  );
  const certificates = raw.filter((item) => item.kind === 'certificate') as unknown as ContentIndexItem[];

  it('is honestly empty today: zero certificate entries → empty list, stable zero-count categories', () => {
    const model = buildCertificationsModel(certificates, EMPTY_CERTIFICATIONS_FILTERS);
    expect(certificates).toHaveLength(0); // documented current state of the index
    expect(model.certificates).toEqual([]);
    expect(model.filteredCount).toBe(0);
    expect(model.totalCount).toBe(0);
    // All canonical categories stay rendered with honest count 0.
    expect(model.filterCategories.map((c) => c.id)).toEqual([
      'TODOS',
      'UNIVERSIDAD',
      'HACK4U',
      'CISCO',
    ]);
    expect(model.filterCategories.map((c) => c.count)).toEqual([0, 0, 0, 0]);
  });

  it('counts and numbers always agree with the index, whatever it contains', () => {
    const model = buildCertificationsModel(certificates, EMPTY_CERTIFICATIONS_FILTERS);
    expect(model.totalCount).toBe(certificates.length);
    expect(model.filteredCount).toBe(certificates.length);
    expect(model.filterCategories[0].count).toBe(certificates.length);
    expect(model.certificates.map((c) => c.number)).toEqual(
      certificates.map((_, i) => `#${String(i + 1).padStart(2, '0')}`)
    );
  });
});

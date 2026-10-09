// Content edit model contract: the pure, synchronous planner behind the future
// interactive scripts/edit-content.js CLI (edit-content T1). It takes PLAIN
// data only — the current identity (kind/slug/platform), the raw markdown of
// the published document, the file names currently inside media/ and a
// declarative `changes` object — and returns a complete deterministic edit
// plan: collected problems, the resulting frontmatter, the body with every
// image reference kept in sync with the final media numbering and paths, the
// FINAL locations (after any slug/platform rename), the previous locations,
// the image conversions to run and the file operations to apply.
//
// Honesty rules under test (odd/tasks/edit-content.md + parent binding):
//   - Frontmatter validation is VERBATIM the pipeline vocabulary: missingFields
//     / assertValidGroup / assertValidTags / assertRequiredTags wording plus
//     the writeup `level` wordings of lib/content-ingest.js. Exact strings are
//     pinned below.
//   - Certificate `order` must be an integer (generator wording) and unique
//     against `siblings.certificateOrders` (generator's family).
//   - Adding/removing numbered evidence renumbers the survivors ascending from
//     01 and rewrites the body to the new numbering: a body reference NEVER
//     points at a file the plan does not produce.
//   - Renaming slug/platform updates the final locations, rewrites every body
//     image reference that lived under the old sitePath and refreshes the
//     frontmatter `image:` key; fileOps.move carries the .md AND the media/.
//   - Cover always lands at media/cover.webp and `image:` refreshes to
//     <finalSitePath>/media/cover.webp.
//   - No orphans, no dangling refs (mirrors tests/media.test.ts): every
//     resulting media file must be referenced by the rewritten body or by
//     `image:`; every body image reference must resolve to a planned file.
//   - changes: {} is a no-op: same frontmatter, same body, same paths and an
//     EMPTY fileOps. The module is pure: no fs/path/process, synchronous,
//     deterministic and inputs untouched.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeEditable, planContentEdit } from '../lib/content-edit.js';

// Raw markdown builder: YAML lines + body after the frontmatter block.
const doc = (yaml: string[], body = ''): string => `---\n${yaml.join('\n')}\n---\n${body}`;

// Published writeup: canonical media-convention body (imgN + absolute refs).
const WAVE_YAML = [
  'title: Wave',
  'date: "2026-09-15"',
  'draft: false',
  'description: Writeup de la máquina Wave en HackMyVM.',
  'categories:',
  '  - HackMyVM',
  'level: Medium',
  'tags:',
  '  - File Upload',
  '  - Privilege Escalation',
];

const WAVE_BODY = [
  'Evidencia inicial:',
  '',
  '![img1](/writeups/hackmyvm/wave/media/01.webp)',
  '',
  'Final:',
  '',
  '![img2](/writeups/hackmyvm/wave/media/02.webp)',
].join('\n');

const WAVE = {
  kind: 'writeup' as const,
  slug: 'wave',
  platform: 'hackmyvm',
  markdown: doc(WAVE_YAML, WAVE_BODY),
  media: ['01.webp', '02.webp'],
};

const APP_YAML = [
  'title: AutoRecon-NG',
  'date: "2026-09-15"',
  'image: "/projects/autorecon-ng/media/cover.webp"',
  'group: scripts',
  'tags:',
  '  - Recon',
];
const APP_BODY = '![img1](/projects/autorecon-ng/media/01.webp)';

const CERT_YAML = [
  'title: eJPT',
  'order: 2',
  'image: "/certificates/ejpt/media/cover.webp"',
  'description: Certificación eJPT.',
  'group: hack4u',
  'tags:',
  '  - Networking',
];

// ---------------------------------------------------------------------------
// describeEditable — the interactive inventory is derived from the real state
// ---------------------------------------------------------------------------

describe('describeEditable — writeup inventory', () => {
  const state = {
    frontmatter: {
      title: 'Wave',
      date: '2026-09-15',
      draft: false,
      description: 'Writeup de la máquina Wave en HackMyVM.',
      categories: ['HackMyVM'],
      level: 'Medium',
      tags: ['File Upload', 'Privilege Escalation'],
    },
    media: ['01.webp', '02.webp', 'cover.webp'],
    bodyHasImages: true,
    slug: 'wave',
    platform: 'hackmyvm',
  };

  it('offers every applicable aspect in order, with platform derived and the writeup cover not editable', () => {
    expect(describeEditable('writeup', state)).toEqual([
      { field: 'title', label: 'Title', current: 'Wave', editable: true },
      {
        field: 'description',
        label: 'Description',
        current: 'Writeup de la máquina Wave en HackMyVM.',
        editable: true,
      },
      {
        field: 'tags',
        label: 'Tags',
        current: ['File Upload', 'Privilege Escalation'],
        editable: true,
      },
      { field: 'draft', label: 'Draft', current: false, editable: true },
      { field: 'date', label: 'Date', current: '2026-09-15', editable: true },
      { field: 'level', label: 'Level', current: 'Medium', editable: true },
      { field: 'platform', label: 'Platform', current: 'hackmyvm', editable: true, derived: true },
      // Writeup covers derive from `level` in the UI: the CLI may omit the
      // change, so the aspect is display-only (`editable: false`).
      { field: 'cover', label: 'Cover image', current: 'cover.webp', editable: false },
      { field: 'evidence', label: 'Evidence images', current: ['01.webp', '02.webp'], editable: true },
      { field: 'rename', label: 'Rename slug / platform', current: 'wave', editable: true },
    ]);
  });

  it('never offers group or order for a writeup', () => {
    const fields = describeEditable('writeup', state).map((aspect) => aspect.field);
    expect(fields).not.toContain('group');
    expect(fields).not.toContain('order');
  });
});

describe('describeEditable — project inventory', () => {
  const state = {
    frontmatter: {
      title: 'AutoRecon-NG',
      date: '2026-09-15',
      description: 'Herramienta de reconocimiento.',
      group: 'scripts',
      tags: ['Recon'],
      draft: true,
    },
    media: ['01.webp', 'cover.webp'],
    bodyHasImages: true,
    slug: 'autorecon-ng',
  };

  it('offers date and group but never level/platform/order', () => {
    expect(describeEditable('project', state)).toEqual([
      { field: 'title', label: 'Title', current: 'AutoRecon-NG', editable: true },
      {
        field: 'description',
        label: 'Description',
        current: 'Herramienta de reconocimiento.',
        editable: true,
      },
      { field: 'tags', label: 'Tags', current: ['Recon'], editable: true },
      { field: 'draft', label: 'Draft', current: true, editable: true },
      { field: 'date', label: 'Date', current: '2026-09-15', editable: true },
      { field: 'group', label: 'Group', current: 'scripts', editable: true },
      { field: 'cover', label: 'Cover image', current: 'cover.webp', editable: true },
      { field: 'evidence', label: 'Evidence images', current: ['01.webp'], editable: true },
      { field: 'rename', label: 'Rename slug', current: 'autorecon-ng', editable: true },
    ]);
  });
});

describe('describeEditable — certificate inventory (date optional)', () => {
  const base = {
    title: 'eJPT',
    order: 2,
    description: 'Certificación eJPT.',
    group: 'hack4u',
    tags: ['Networking'],
    draft: false,
  };

  it('offers order and group and the optional date only when present', () => {
    const withDate = describeEditable('certificate', {
      frontmatter: { ...base, date: '2025-04-01' },
      media: ['01.webp', 'cover.webp'],
      bodyHasImages: true,
      slug: 'ejpt',
    });
    expect(withDate).toEqual([
      { field: 'title', label: 'Title', current: 'eJPT', editable: true },
      { field: 'description', label: 'Description', current: 'Certificación eJPT.', editable: true },
      { field: 'tags', label: 'Tags', current: ['Networking'], editable: true },
      { field: 'draft', label: 'Draft', current: false, editable: true },
      { field: 'order', label: 'Order', current: 2, editable: true },
      { field: 'group', label: 'Group', current: 'hack4u', editable: true },
      { field: 'date', label: 'Date', current: '2025-04-01', editable: true },
      { field: 'cover', label: 'Cover image', current: 'cover.webp', editable: true },
      { field: 'evidence', label: 'Evidence images', current: ['01.webp'], editable: true },
      { field: 'rename', label: 'Rename slug', current: 'ejpt', editable: true },
    ]);

    const withoutDate = describeEditable('certificate', {
      frontmatter: { ...base },
      media: ['cover.webp'],
      bodyHasImages: false,
      slug: 'ejpt',
    });
    expect(withoutDate.map((aspect) => aspect.field)).not.toContain('date');
  });
});

describe('describeEditable — evidence aspect detection', () => {
  const base = {
    frontmatter: { title: 'eJPT', order: 2, description: 'Certificación eJPT.', group: 'hack4u', tags: ['Networking'] },
    slug: 'ejpt',
  };

  it('is absent when the body has no images and media has no numbered files', () => {
    const aspects = describeEditable('certificate', {
      ...base,
      media: ['cover.webp'],
      bodyHasImages: false,
    });
    expect(aspects.map((aspect) => aspect.field)).not.toContain('evidence');
  });

  it('is offered when the body references images even without numbered files', () => {
    const aspects = describeEditable('certificate', { ...base, media: [], bodyHasImages: true });
    const evidence = aspects.find((aspect) => aspect.field === 'evidence');
    expect(evidence).toEqual({ field: 'evidence', label: 'Evidence images', current: [], editable: true });
  });

  it('is offered when media carries numbered files even without body images', () => {
    const aspects = describeEditable('certificate', {
      ...base,
      media: ['02.webp', '01.webp'],
      bodyHasImages: false,
    });
    const evidence = aspects.find((aspect) => aspect.field === 'evidence');
    expect(evidence?.current).toEqual(['01.webp', '02.webp']);
  });
});

// ---------------------------------------------------------------------------
// planContentEdit — no-op idempotence (rule 7): changes {} rewrites nothing
// ---------------------------------------------------------------------------

describe('planContentEdit — no-op idempotence', () => {
  it('with changes: {} returns the document unchanged and an empty fileOps', () => {
    const input = { ...WAVE, changes: {} };
    const before = structuredClone(input);
    const plan = planContentEdit(input);

    expect(plan.problems).toEqual([]);
    expect(plan.frontmatter).toEqual({
      title: 'Wave',
      date: '2026-09-15',
      draft: false,
      description: 'Writeup de la máquina Wave en HackMyVM.',
      categories: ['HackMyVM'],
      level: 'Medium',
      tags: ['File Upload', 'Privilege Escalation'],
    });
    expect(plan.rewrittenBody).toBe(WAVE_BODY);
    expect(plan.sitePath).toBe('/writeups/hackmyvm/wave');
    expect(plan.targetDir).toBe('public/writeups/hackmyvm/wave');
    expect(plan.markdownPath).toBe('public/writeups/hackmyvm/wave.md');
    expect(plan.previous).toEqual({
      sitePath: '/writeups/hackmyvm/wave',
      targetDir: 'public/writeups/hackmyvm/wave',
      markdownPath: 'public/writeups/hackmyvm/wave.md',
    });
    expect(plan.imagePlan).toEqual([]);
    expect(plan.fileOps).toEqual({ write: [], delete: [], move: [] });
    expect(plan.isDraft).toBe(false);
    expect(planContentEdit(input)).toEqual(plan);
    expect(input).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Frontmatter validation (rule 1): verbatim pipeline vocabulary
// ---------------------------------------------------------------------------

describe('planContentEdit — frontmatter validation', () => {
  it('reports a bad project group with the assertValidGroup wording', () => {
    const plan = planContentEdit({
      kind: 'project',
      slug: 'autorecon-ng',
      markdown: doc(APP_YAML, APP_BODY),
      media: ['01.webp', 'cover.webp'],
      changes: { fields: { group: 'exploits' } },
    });
    expect(plan.problems).toEqual([
      'Invalid project group in autorecon-ng.md: expected one of "scripts", "automatizaciones", "herramientas", got "exploits".',
    ]);
  });

  it('reports bad certificate tags with the assertRequiredTags wording', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes: { fields: { tags: ['Nope'] } },
    });
    expect(plan.problems).toEqual([
      'Invalid tag(s) in ejpt.md: "Nope". Tags must come from the certificate tag vocabulary in lib/taxonomy.js.',
    ]);
  });

  it('reports a missing and an invalid writeup level with the content-ingest wording', () => {
    const missing = planContentEdit({ ...WAVE, changes: { fields: { level: null } } });
    expect(missing.problems).toEqual([
      'Missing writeup level in wave.md: expected one of "Easy", "Medium", "Hard".',
    ]);

    const invalid = planContentEdit({ ...WAVE, changes: { fields: { level: 'Medio' } } });
    expect(invalid.problems).toEqual([
      'Invalid writeup level in wave.md: expected one of "Easy", "Medium", "Hard", got "Medio".',
    ]);
  });

  it('lists fields removed by the edit in the missingFields wording', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes: { fields: { title: null, order: null } },
    });
    // `order` removed → only the missingFields problem, never the generator's
    // "Invalid certificate order" (the generator would fail on missing first).
    expect(plan.problems).toEqual(['Missing required frontmatter field(s) in ejpt.md: title, order']);
  });

  it('reports a missing writeup date after removing it', () => {
    const plan = planContentEdit({ ...WAVE, changes: { fields: { date: undefined } } });
    expect(plan.problems).toEqual(['Missing required frontmatter field(s) in wave.md: date']);
  });

  it('degrades a platformless writeup to the flat form and reports it (ingest mirror)', () => {
    const plan = planContentEdit({
      kind: 'writeup',
      slug: 'wave',
      markdown: doc(['title: Wave', 'date: "2026-09-15"', 'level: Medium'], ''),
      media: [],
      changes: {},
    });
    expect(plan.problems).toEqual([
      'Missing writeup platform in wave.md: expected the platform option or categories[0] in the frontmatter.',
    ]);
    expect(plan.sitePath).toBe('/writeups/wave');
    expect(plan.targetDir).toBe('public/writeups/wave');
  });
});

// ---------------------------------------------------------------------------
// Certificate order (rule 2): integer + unique against siblings
// ---------------------------------------------------------------------------

describe('planContentEdit — certificate order', () => {
  const cert = (
    changes: { fields?: Record<string, unknown> },
    siblings?: { certificateOrders?: { order: unknown; slug: string }[] }
  ) =>
    planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes,
      siblings,
    });

  it('rejects a non-integer order with the generator wording', () => {
    const plan = cert({ fields: { order: '3' } });
    expect(plan.problems).toEqual(['Invalid certificate order in ejpt.md: expected an integer, got "3"']);
  });

  it('detects a collision with another slug in siblings.certificateOrders', () => {
    const plan = cert(
      { fields: { order: 3 } },
      { certificateOrders: [{ order: 2, slug: 'secplus' }, { order: 3, slug: 'secplus' }] }
    );
    expect(plan.problems).toEqual([
      'Duplicate certificate order in ejpt: 3 is already used by secplus',
    ]);
  });

  it('accepts an order no sibling uses', () => {
    const plan = cert(
      { fields: { order: 3 } },
      { certificateOrders: [{ order: 2, slug: 'secplus' }] }
    );
    expect(plan.problems).toEqual([]);
    expect(plan.frontmatter.order).toBe(3);
  });

  it('never collides an entry with itself', () => {
    // The published state is valid: the entry's OWN order must not collide.
    const plan = cert({}, { certificateOrders: [{ order: 2, slug: 'ejpt' }] });
    expect(plan.problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Evidence add/remove (rules 3 + 6): renumbering, body rewrite, no dangling
// ---------------------------------------------------------------------------

describe('planContentEdit — evidence renumbering', () => {
  it('adding an evidence image appends its reference and keeps the numbering', () => {
    const plan = planContentEdit({
      ...WAVE,
      changes: { images: { add: ['extra.png'] } },
    });
    expect(plan.problems).toEqual([]);
    // Survivors keep 01/02; the addition takes the next free number and its
    // reference is appended at the end of the body.
    expect(plan.rewrittenBody).toBe(
      [
        WAVE_BODY,
        '',
        '![img3](/writeups/hackmyvm/wave/media/03.webp)',
      ].join('\n')
    );
    expect(plan.imagePlan).toEqual([{ source: 'extra.png', target: 'media/03.webp' }]);
    expect(plan.fileOps).toEqual({
      write: ['public/writeups/hackmyvm/wave.md'],
      delete: [],
      move: [],
    });
  });

  it('removing an unreferenced evidence image renumbers the survivors and rewrites the body', () => {
    const body = [
      '![img2](/writeups/hackmyvm/wave/media/02.webp)',
      '![img3](/writeups/hackmyvm/wave/media/03.webp)',
    ].join('\n');
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, body),
      media: ['01.webp', '02.webp', '03.webp'],
      changes: { images: { remove: ['01.webp'] } },
    });
    expect(plan.problems).toEqual([]);
    // Survivors shift down: 02→01, 03→02, and EVERY body reference follows.
    expect(plan.rewrittenBody).toBe(
      [
        '![img1](/writeups/hackmyvm/wave/media/01.webp)',
        '![img2](/writeups/hackmyvm/wave/media/02.webp)',
      ].join('\n')
    );
    expect(plan.fileOps).toEqual({
      write: ['public/writeups/hackmyvm/wave.md'],
      delete: ['public/writeups/hackmyvm/wave/media/01.webp'],
      move: [
        {
          from: 'public/writeups/hackmyvm/wave/media/02.webp',
          to: 'public/writeups/hackmyvm/wave/media/01.webp',
        },
        {
          from: 'public/writeups/hackmyvm/wave/media/03.webp',
          to: 'public/writeups/hackmyvm/wave/media/02.webp',
        },
      ],
    });
  });

  it('removing a referenced evidence image produces a problem and never leaves a dangling ref', () => {
    const body = [
      '![img1](/writeups/hackmyvm/wave/media/01.webp)',
      '![img2](/writeups/hackmyvm/wave/media/02.webp)',
    ].join('\n');
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, body),
      changes: { images: { remove: ['02.webp'] } },
    });
    expect(plan.problems).toEqual([
      'Cannot remove referenced media file in wave: "02.webp" is still referenced by the body.',
    ]);
    // The stale reference is DROPPED (not rewritten to another file): the body
    // never points at a file the plan does not produce.
    expect(plan.rewrittenBody).toBe('![img1](/writeups/hackmyvm/wave/media/01.webp)\n');
    expect(plan.rewrittenBody).not.toContain('02.webp');
    expect(plan.fileOps.delete).toEqual(['public/writeups/hackmyvm/wave/media/02.webp']);
  });

  it('keeps custom alt texts while renumbering (only the canonical imgN alt follows)', () => {
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, '![evidencia](/writeups/hackmyvm/wave/media/02.webp)'),
      media: ['01.webp', '02.webp'],
      changes: { images: { remove: ['01.webp'] } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.rewrittenBody).toBe('![evidencia](/writeups/hackmyvm/wave/media/01.webp)');
  });

  it('preserves a stale imgN alt on a no-op plan (rule 7 holds for every body)', () => {
    // Real published drift: the alt may not match the file number. With
    // changes: {} the body must still come back byte for byte.
    const stale = [
      '![img1](/writeups/hackmyvm/wave/media/02.webp)',
      '![img2](/writeups/hackmyvm/wave/media/01.webp)',
    ].join('\n');
    const plan = planContentEdit({ ...WAVE, markdown: doc(WAVE_YAML, stale), changes: {} });
    expect(plan.problems).toEqual([]);
    expect(plan.rewrittenBody).toBe(stale);
    expect(plan.fileOps).toEqual({ write: [], delete: [], move: [] });
  });

  it('add + remove together renumber, rewrite and append in one plan', () => {
    const body = [
      '![img2](/writeups/hackmyvm/wave/media/02.webp)',
      '![img3](/writeups/hackmyvm/wave/media/03.webp)',
    ].join('\n');
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, body),
      media: ['01.webp', '02.webp', '03.webp'],
      changes: { images: { remove: ['01.webp'], add: ['extra.png'] } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.rewrittenBody).toBe(
      [
        '![img1](/writeups/hackmyvm/wave/media/01.webp)',
        '![img2](/writeups/hackmyvm/wave/media/02.webp)',
        '',
        '![img3](/writeups/hackmyvm/wave/media/03.webp)',
      ].join('\n')
    );
    expect(plan.imagePlan).toEqual([{ source: 'extra.png', target: 'media/03.webp' }]);
    expect(plan.fileOps.delete).toEqual(['public/writeups/hackmyvm/wave/media/01.webp']);
  });

  it('rejects removing a name that is not a numbered media file', () => {
    const plan = planContentEdit({
      ...WAVE,
      changes: { images: { remove: ['nope.webp'] } },
    });
    expect(plan.problems).toEqual([
      'Cannot remove unknown evidence image in wave: "nope.webp" is not a numbered media file.',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Renaming (rule 4): paths, body refs, image: refresh, fileOps.move
// ---------------------------------------------------------------------------

describe('planContentEdit — renaming', () => {
  it('slug rename updates the final locations and rewrites every body image reference', () => {
    const plan = planContentEdit({ ...WAVE, changes: { rename: { slug: 'wave-two' } } });
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/writeups/hackmyvm/wave-two');
    expect(plan.targetDir).toBe('public/writeups/hackmyvm/wave-two');
    expect(plan.markdownPath).toBe('public/writeups/hackmyvm/wave-two.md');
    expect(plan.previous).toEqual({
      sitePath: '/writeups/hackmyvm/wave',
      targetDir: 'public/writeups/hackmyvm/wave',
      markdownPath: 'public/writeups/hackmyvm/wave.md',
    });
    expect(plan.rewrittenBody).toBe(
      [
        'Evidencia inicial:',
        '',
        '![img1](/writeups/hackmyvm/wave-two/media/01.webp)',
        '',
        'Final:',
        '',
        '![img2](/writeups/hackmyvm/wave-two/media/02.webp)',
      ].join('\n')
    );
    // fileOps.move carries BOTH the .md and the media/ directory.
    expect(plan.fileOps.move).toEqual([
      {
        from: 'public/writeups/hackmyvm/wave.md',
        to: 'public/writeups/hackmyvm/wave-two.md',
      },
      {
        from: 'public/writeups/hackmyvm/wave/media',
        to: 'public/writeups/hackmyvm/wave-two/media',
      },
    ]);
    expect(plan.fileOps.delete).toEqual([]);
    expect(plan.fileOps.write).toEqual(['public/writeups/hackmyvm/wave-two.md']);
  });

  it('platform move (writeup) carries the platform segment and rewrites the body too', () => {
    const plan = planContentEdit({ ...WAVE, changes: { rename: { platform: 'TryHackMe' } } });
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/writeups/tryhackme/wave');
    expect(plan.targetDir).toBe('public/writeups/tryhackme/wave');
    expect(plan.markdownPath).toBe('public/writeups/tryhackme/wave.md');
    expect(plan.rewrittenBody).toContain('![img1](/writeups/tryhackme/wave/media/01.webp)');
    expect(plan.rewrittenBody).toContain('![img2](/writeups/tryhackme/wave/media/02.webp)');
    expect(plan.rewrittenBody).not.toContain('/writeups/hackmyvm/');
    expect(plan.fileOps.move).toEqual([
      { from: 'public/writeups/hackmyvm/wave.md', to: 'public/writeups/tryhackme/wave.md' },
      {
        from: 'public/writeups/hackmyvm/wave/media',
        to: 'public/writeups/tryhackme/wave/media',
      },
    ]);
  });

  it('refreshes the frontmatter image key when it lived under the old sitePath', () => {
    const markdown = doc(
      [...WAVE_YAML, 'image: "/writeups/hackmyvm/wave/media/cover.webp"'],
      WAVE_BODY
    );
    const plan = planContentEdit({
      ...WAVE,
      markdown,
      media: ['01.webp', '02.webp', 'cover.webp'],
      changes: { rename: { slug: 'wave-two' } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.frontmatter.image).toBe('/writeups/hackmyvm/wave-two/media/cover.webp');
  });

  it('normalizes a renamed slug like the ingestion does (lowercase, spaces → "-")', () => {
    const plan = planContentEdit({ ...WAVE, changes: { rename: { slug: 'Wave Two.md' } } });
    expect(plan.sitePath).toBe('/writeups/hackmyvm/wave-two');
    expect(plan.markdownPath).toBe('public/writeups/hackmyvm/wave-two.md');
  });

  it('ignores a platform rename for flat kinds (only writeups carry platform)', () => {
    const plan = planContentEdit({
      kind: 'project',
      slug: 'autorecon-ng',
      markdown: doc(APP_YAML, APP_BODY),
      media: ['01.webp', 'cover.webp'],
      changes: { rename: { platform: 'nope' } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/projects/autorecon-ng');
    expect(plan.fileOps.move).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cover (rule 5): always media/cover.webp, image: under the FINAL sitePath
// ---------------------------------------------------------------------------

describe('planContentEdit — cover replacement', () => {
  it('plans the cover as media/cover.webp and refreshes image under the final sitePath', () => {
    const plan = planContentEdit({
      kind: 'certificate',
      slug: 'ejpt',
      markdown: doc(CERT_YAML, ''),
      media: ['cover.webp'],
      changes: { cover: { source: 'scan.png' }, rename: { slug: 'ejpt-v2' } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.imagePlan).toEqual([{ source: 'scan.png', target: 'media/cover.webp' }]);
    expect(plan.frontmatter.image).toBe('/certificates/ejpt-v2/media/cover.webp');
    expect(plan.targetDir).toBe('public/certificates/ejpt-v2');
    // The overwritten cover is neither moved nor deleted.
    expect(plan.fileOps.delete).toEqual([]);
    expect(plan.fileOps.move).toEqual([
      { from: 'public/certificates/ejpt.md', to: 'public/certificates/ejpt-v2.md' },
      {
        from: 'public/certificates/ejpt/media',
        to: 'public/certificates/ejpt-v2/media',
      },
    ]);
    expect(plan.fileOps.write).toEqual(['public/certificates/ejpt-v2.md']);
  });

  it('a writeup cover change still plans the file and refreshes image (never an orphan)', () => {
    const plan = planContentEdit({
      ...WAVE,
      changes: { cover: { source: 'shot.png' } },
    });
    expect(plan.problems).toEqual([]);
    expect(plan.imagePlan).toEqual([{ source: 'shot.png', target: 'media/cover.webp' }]);
    expect(plan.frontmatter.image).toBe('/writeups/hackmyvm/wave/media/cover.webp');
  });
});

// ---------------------------------------------------------------------------
// Orphans and dangling refs (rule 6): mirrors tests/media.test.ts
// ---------------------------------------------------------------------------

describe('planContentEdit — orphans and dangling refs', () => {
  it('reports a media file left unreferenced as a would-be orphan', () => {
    const body = [
      '![img1](/writeups/hackmyvm/wave/media/01.webp)',
      '![img2](/writeups/hackmyvm/wave/media/02.webp)',
    ].join('\n');
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, body),
      media: ['01.webp', '02.webp', '03.webp'],
      changes: {},
    });
    expect(plan.problems).toEqual([
      'Unreferenced media file in wave: "03.webp" would become an orphan.',
    ]);
    // The problem does not invent file operations: nothing changes silently.
    expect(plan.fileOps).toEqual({ write: [], delete: [], move: [] });
  });

  it('reports an unmatched body reference with the images-list wording and leaves it alone', () => {
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, 'Texto [[ghost.png]] y más texto.'),
      media: [],
      changes: {},
    });
    expect(plan.problems).toEqual([
      'Unmatched image reference in wave.md: "ghost.png" has no file in the images list.',
    ]);
    expect(plan.rewrittenBody).toBe('Texto [[ghost.png]] y más texto.');
  });

  it('flags every image reference that does not resolve under the final sitePath', () => {
    // tests/media.test.ts requires EVERY image reference to live under the
    // per-content media folder: an external URL is a real convention problem.
    const plan = planContentEdit({
      ...WAVE,
      markdown: doc(WAVE_YAML, '![badge](https://example.com/a.png)'),
      media: [],
      changes: {},
    });
    expect(plan.problems).toEqual([
      'Unmatched image reference in wave.md: "https://example.com/a.png" has no file in the images list.',
    ]);
    expect(plan.rewrittenBody).toBe('![badge](https://example.com/a.png)');
  });
});

// ---------------------------------------------------------------------------
// Purity and hard input errors (rule 8)
// ---------------------------------------------------------------------------

describe('planContentEdit — purity and hard input errors', () => {
  it('imports no node builtin (no fs/path/process access in the module source)', () => {
    const source = readFileSync(new URL('../lib/content-edit.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"](?:node:)?(?:fs|path|os|child_process|url)['"]/);
    expect(source).not.toMatch(/require\s*\(/);
    expect(source).not.toMatch(/\bprocess\./);
  });

  it('is pure and synchronous: same output twice, inputs untouched', () => {
    const input = {
      ...WAVE,
      media: ['02.webp', '01.webp'],
      changes: { images: { add: ['extra.png'] }, rename: { slug: 'wave-two' } },
    };
    const before = structuredClone(input);

    const first = planContentEdit(input);
    const second = planContentEdit(input);

    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.imagePlan).not.toBe(second.imagePlan); // fresh output objects
    expect(input).toEqual(before);
  });

  it('throws fail-loud on an unknown kind or unparseable YAML', () => {
    expect(() => planContentEdit({ ...WAVE, kind: 'book' as 'writeup' })).toThrow(
      'Unknown content kind: "book"'
    );
    expect(() => planContentEdit({ ...WAVE, markdown: '---\ntitle: [unclosed\n---\n' })).toThrow(
      /^Failed to parse wave.md: /
    );
  });
});

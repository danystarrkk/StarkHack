// Content ingestion model contract: the pure, synchronous builder behind the
// future scripts/add-content.js CLI (T2). It takes PLAIN data only — the raw
// markdown text, the source file name, the plain list of image file names in
// the source folder and the CLI options — and returns a complete deterministic
// ingestion plan: collected frontmatter problems, the derived slug/site path/
// target directory, the ordered media plan, the body with image references
// rewritten to the site convention, the normalized frontmatter to write back
// and the draft flag.
//
// Honesty rules under test (odd/tasks/content-ingestion.md, human decisions):
//   - ALL frontmatter problems are collected in one pass (never throw on the
//     first one) and reuse the pipeline vocabulary verbatim (missingFields /
//     assertValidGroup / assertValidTags wording of lib/content-kinds.js and
//     lib/taxonomy.js). Exact strings are pinned below.
//   - `level` is REQUIRED for writeups (their cover is standardized by level)
//     and must be exactly 'Easy' | 'Medium' | 'Hard' when present.
//   - Writeups NEVER get a cover image (the UI derives it from `level`); the
//     `cover` option is ignored for them. Projects/certificates REQUIRE the
//     `cover` option; projects additionally require cover ∈ images.
//   - Body image references ([[name.png]], ![alt](name.png), ![alt](./name.png))
//     are rewritten to ![imgN](<sitePath>/media/NN.webp) in image-plan order;
//     absolute /... and http(s) URLs are NEVER touched; unmatched references
//     stay untouched AND push a problem (never silently drop evidence); no
//     references at all → body unchanged (never invent insertions).
//   - The module is pure: no fs/path/process access, synchronous, deterministic
//     and inputs untouched (pinned by the source-scan + purity tests below).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WRITEUP_LEVELS, planContentIngestion } from '../lib/content-ingest.js';

// Raw markdown builder: YAML lines + body after the frontmatter block.
const doc = (yaml: string[], body = ''): string => `---\n${yaml.join('\n')}\n---\n${body}`;

// Minimal valid writeup frontmatter (level and platform derivable).
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

// ---------------------------------------------------------------------------
// Writeup happy path: slug/sitePath/targetDir/imagePlan/rewritten body
// ---------------------------------------------------------------------------

describe('planContentIngestion — writeup happy path', () => {
  const body = ['Evidencia inicial:', '', '[[01.png]]', '', 'Final:', '', '![](02.jpg)'].join('\n');
  const plan = planContentIngestion('writeup', doc(WAVE_YAML, body), 'Wave.md', ['02.jpg', '01.png']);

  it('derives slug, sitePath and targetDir from the file name and the kind root', () => {
    expect(plan.problems).toEqual([]);
    expect(plan.slug).toBe('wave'); // strip .md, lowercase, spaces → '-'
    expect(plan.sitePath).toBe('/writeups/hackmyvm/wave');
    expect(plan.targetDir).toBe('public/writeups/hackmyvm/wave');
  });

  it('numbers every source image in ascending name order (byte-stable)', () => {
    // Input order ['02.jpg', '01.png'] must not matter: ascending by name.
    expect(plan.imagePlan).toEqual([
      { source: '01.png', target: 'media/01.webp' },
      { source: '02.jpg', target: 'media/02.webp' },
    ]);
  });

  it('rewrites Obsidian and relative markdown references to the site convention', () => {
    expect(plan.rewrittenBody).toBe(
      [
        'Evidencia inicial:',
        '',
        `![img1](${plan.sitePath}/media/01.webp)`,
        '',
        'Final:',
        '',
        `![img2](${plan.sitePath}/media/02.webp)`,
      ].join('\n')
    );
  });

  it('never adds cover data to a writeup frontmatter (level is the cover)', () => {
    expect(plan.isDraft).toBe(false);
    expect(plan.frontmatter).not.toHaveProperty('image'); // no cover invented
    expect(plan.frontmatter).not.toHaveProperty('platform'); // derived, never written
    expect(plan.frontmatter.title).toBe('Wave');
    expect(plan.frontmatter.level).toBe('Medium');
    expect(plan.imagePlan.some((entry) => entry.target === 'media/cover.webp')).toBe(false);
  });

  it('ignores the cover option for writeups', () => {
    const withCover = planContentIngestion('writeup', doc(WAVE_YAML, ''), 'wave.md', ['01.png'], {
      cover: '01.png',
    });
    expect(withCover.problems).toEqual([]);
    expect(withCover.imagePlan).toEqual([{ source: '01.png', target: 'media/01.webp' }]);
  });

  it('keeps an existing writeup image key untouched', () => {
    const withImage = planContentIngestion(
      'writeup',
      doc([...WAVE_YAML, 'image: "/writeups/hackmyvm/wave/media/cover.webp"']),
      'wave.md',
      []
    );
    expect(withImage.problems).toEqual([]);
    expect(withImage.frontmatter.image).toBe('/writeups/hackmyvm/wave/media/cover.webp');
  });
});

// ---------------------------------------------------------------------------
// level: required for writeups, exactly 'Easy' | 'Medium' | 'Hard'
// ---------------------------------------------------------------------------

describe('planContentIngestion — writeup level validation', () => {
  const withoutLevel = WAVE_YAML.filter((line) => !line.startsWith('level:'));

  it('reports a missing level naming it and the allowed values', () => {
    const plan = planContentIngestion('writeup', doc(withoutLevel), 'wave.md', []);
    expect(plan.problems).toEqual([
      'Missing writeup level in wave.md: expected one of "Easy", "Medium", "Hard".',
    ]);
  });

  it('reports an invalid level naming the 3 allowed values', () => {
    const plan = planContentIngestion(
      'writeup',
      doc(withoutLevel.concat('level: Medio')),
      'wave.md',
      []
    );
    expect(plan.problems).toEqual([
      'Invalid writeup level in wave.md: expected one of "Easy", "Medium", "Hard", got "Medio".',
    ]);
  });

  it('accepts exactly Easy, Medium and Hard', () => {
    for (const level of ['Easy', 'Medium', 'Hard']) {
      const plan = planContentIngestion(
        'writeup',
        doc(withoutLevel.concat(`level: ${level}`)),
        'wave.md',
        []
      );
      expect(plan.problems).toEqual([]);
    }
  });

  it('rejects near-miss casing (the vocabulary is verbatim)', () => {
    const plan = planContentIngestion(
      'writeup',
      doc(withoutLevel.concat('level: easy')),
      'wave.md',
      []
    );
    expect(plan.problems).toEqual([
      'Invalid writeup level in wave.md: expected one of "Easy", "Medium", "Hard", got "easy".',
    ]);
    expect(WRITEUP_LEVELS).toEqual(['Easy', 'Medium', 'Hard']);
  });

  it('accepts the level option and writes it back to the frontmatter', () => {
    const plan = planContentIngestion('writeup', doc(withoutLevel), 'wave.md', [], {
      level: 'Hard',
    });
    expect(plan.problems).toEqual([]);
    expect(plan.frontmatter.level).toBe('Hard');
  });
});

// ---------------------------------------------------------------------------
// platform derivation: option wins, else categories[0] lowercased
// ---------------------------------------------------------------------------

describe('planContentIngestion — writeup platform derivation', () => {
  const base = WAVE_YAML.filter((line) => !line.startsWith('categories:') && line !== '  - HackMyVM');

  it('prefers the platform option over categories[0]', () => {
    const plan = planContentIngestion('writeup', doc(WAVE_YAML), 'wave.md', [], {
      platform: 'TryHackMe',
    });
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/writeups/tryhackme/wave');
    expect(plan.targetDir).toBe('public/writeups/tryhackme/wave');
  });

  it('falls back to categories[0] lowercased', () => {
    const plan = planContentIngestion('writeup', doc(WAVE_YAML), 'wave.md', []);
    expect(plan.sitePath).toBe('/writeups/hackmyvm/wave');
  });

  it('reports a problem when neither the option nor categories[0] yields a platform', () => {
    const plan = planContentIngestion('writeup', doc(base), 'wave.md', []);
    expect(plan.problems).toEqual([
      'Missing writeup platform in wave.md: expected the platform option or categories[0] in the frontmatter.',
    ]);
    // Deterministic degradation to the flat form; the CLI must not ingest
    // while the problems list is non-empty anyway.
    expect(plan.sitePath).toBe('/writeups/wave');
    expect(plan.targetDir).toBe('public/writeups/wave');
  });
});

// ---------------------------------------------------------------------------
// Project: cover required, cover ∈ images, group vocabulary, image key
// ---------------------------------------------------------------------------

describe('planContentIngestion — project', () => {
  const APP_YAML = [
    'title: AutoRecon-NG',
    'date: "2026-09-15"',
    'image: "/projects/autorecon-ng/media/cover.webp"',
    'group: scripts',
    'tags:',
    '  - Recon',
  ];

  it('plans the numbered media plus the required cover and refreshes image', () => {
    const plan = planContentIngestion(
      'project',
      doc(APP_YAML),
      'autorecon-ng.md',
      ['cover.jpg', '01.png'],
      { cover: 'cover.jpg' }
    );
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/projects/autorecon-ng');
    expect(plan.targetDir).toBe('public/projects/autorecon-ng');
    expect(plan.imagePlan).toEqual([
      { source: '01.png', target: 'media/01.webp' },
      { source: 'cover.jpg', target: 'media/02.webp' },
      { source: 'cover.jpg', target: 'media/cover.webp' },
    ]);
    expect(plan.frontmatter.image).toBe('/projects/autorecon-ng/media/cover.webp');
    expect(plan.frontmatter.group).toBe('scripts');
  });

  it('reports a missing cover naming it', () => {
    const plan = planContentIngestion('project', doc(APP_YAML), 'autorecon-ng.md', ['01.png']);
    expect(plan.problems).toEqual([
      'Missing project cover in autorecon-ng.md: expected the cover option naming an image file.',
    ]);
    expect(plan.imagePlan).toEqual([{ source: '01.png', target: 'media/01.webp' }]);
  });

  it('rejects a project cover that is not among the folder images', () => {
    const plan = planContentIngestion('project', doc(APP_YAML), 'autorecon-ng.md', ['01.png'], {
      cover: 'nope.png',
    });
    expect(plan.problems).toEqual([
      'Invalid project cover in autorecon-ng.md: "nope.png" is not among the source images.',
    ]);
    // The unusable cover never reaches the plan.
    expect(plan.imagePlan).toEqual([{ source: '01.png', target: 'media/01.webp' }]);
  });

  it('validates group against PROJECT_GROUPS with the assertValidGroup wording', () => {
    const yaml = APP_YAML.map((line) => (line === 'group: scripts' ? 'group: exploits' : line));
    const plan = planContentIngestion('project', doc(yaml), 'autorecon-ng.md', ['cover.jpg'], {
      cover: 'cover.jpg',
    });
    expect(plan.problems).toEqual([
      'Invalid project group in autorecon-ng.md: expected one of "scripts", "automatizaciones", "herramientas", got "exploits".',
    ]);
  });

  it('reports a missing group with the same vocabulary', () => {
    const yaml = APP_YAML.filter((line) => line !== 'group: scripts');
    const plan = planContentIngestion('project', doc(yaml), 'autorecon-ng.md', ['cover.jpg'], {
      cover: 'cover.jpg',
    });
    expect(plan.problems).toEqual([
      'Invalid project group in autorecon-ng.md: expected one of "scripts", "automatizaciones", "herramientas", got undefined.',
    ]);
  });

  it('accepts the group option and writes it back to the frontmatter', () => {
    const yaml = APP_YAML.filter((line) => line !== 'group: scripts');
    const plan = planContentIngestion('project', doc(yaml), 'autorecon-ng.md', ['cover.jpg'], {
      cover: 'cover.jpg',
      group: 'herramientas',
    });
    expect(plan.problems).toEqual([]);
    expect(plan.frontmatter.group).toBe('herramientas');
  });

  it('validates project tags against PROJECT_TAGS (assertRequiredTags wording)', () => {
    const yaml = APP_YAML.map((line) => (line === '  - Recon' ? '  - Nope' : line));
    const plan = planContentIngestion('project', doc(yaml), 'autorecon-ng.md', ['cover.jpg'], {
      cover: 'cover.jpg',
    });
    expect(plan.problems).toEqual([
      'Invalid tag(s) in autorecon-ng.md: "Nope". Tags must come from the project tag vocabulary in lib/taxonomy.js.',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Certificate: cover outside the folder is accepted, order is the generator's
// ---------------------------------------------------------------------------

describe('planContentIngestion — certificate', () => {
  const CERT_YAML = [
    'title: eJPT',
    'order: 2',
    'image: "/certificates/ejpt/media/cover.webp"',
    'description: Certificación eJPT.',
    'group: hack4u',
    'tags:',
    '  - Networking',
  ];

  it('accepts a cover that is not among the source images (path-ish name)', () => {
    const plan = planContentIngestion(
      'certificate',
      doc(CERT_YAML),
      'ejpt.md',
      ['cert.png'],
      { cover: 'cert-scan.png' }
    );
    expect(plan.problems).toEqual([]);
    expect(plan.sitePath).toBe('/certificates/ejpt');
    expect(plan.targetDir).toBe('public/certificates/ejpt');
    expect(plan.imagePlan).toEqual([
      { source: 'cert.png', target: 'media/01.webp' },
      { source: 'cert-scan.png', target: 'media/cover.webp' },
    ]);
    expect(plan.frontmatter.image).toBe('/certificates/ejpt/media/cover.webp');
  });

  it('leaves certificate order validity/duplicates to the generator', () => {
    // '3' is not an integer: generate-index rejects it with its own
    // "Invalid certificate order" error. This pure plan never checks it.
    const yaml = CERT_YAML.map((line) => (line === 'order: 2' ? "order: '3'" : line));
    const plan = planContentIngestion('certificate', doc(yaml), 'ejpt.md', ['cert.png'], {
      cover: 'cert-scan.png',
    });
    expect(plan.problems).toEqual([]);
  });

  it('lists every missing required field in missingFields order', () => {
    const yaml = ['group: hack4u', 'tags:', '  - Networking'];
    const plan = planContentIngestion('certificate', doc(yaml), 'ejpt.md', ['cert.png'], {
      cover: 'cert-scan.png',
    });
    expect(plan.problems).toEqual([
      'Missing required frontmatter field(s) in ejpt.md: title, order, image, description',
    ]);
  });

  it('reports missing required fields of a writeup with the same exact wording', () => {
    const plan = planContentIngestion(
      'writeup',
      doc(['level: Medium', 'categories:', '  - HackMyVM']),
      'wave.md',
      []
    );
    expect(plan.problems).toEqual(['Missing required frontmatter field(s) in wave.md: title, date']);
  });
});

// ---------------------------------------------------------------------------
// Body rewriting: only relative references, fail-loud on unmatched names
// ---------------------------------------------------------------------------

describe('planContentIngestion — body rewriting', () => {
  const BODY = [
    'Intro [[01.png]] inline.',
    '',
    '![alt](02.jpg)',
    '',
    '![local](./03.png)',
    '',
    '![abs](/writeups/hackmyvm/wave/media/01.webp)',
    '',
    '![remote](https://example.com/a.png)',
    '',
    '[[ghost.png]]',
    '',
    '![[01.png]]',
  ].join('\n');
  const plan = planContentIngestion('writeup', doc(WAVE_YAML, BODY), 'wave.md', [
    '01.png',
    '02.jpg',
    '03.png',
  ]);

  it('rewrites Obsidian and relative refs but never absolute or http(s) URLs', () => {
    expect(plan.rewrittenBody).toBe(
      [
        'Intro ![img1](/writeups/hackmyvm/wave/media/01.webp) inline.',
        '',
        '![img2](/writeups/hackmyvm/wave/media/02.webp)',
        '',
        '![img3](/writeups/hackmyvm/wave/media/03.webp)',
        '',
        '![abs](/writeups/hackmyvm/wave/media/01.webp)',
        '',
        '![remote](https://example.com/a.png)',
        '',
        '[[ghost.png]]',
        '',
        '![img1](/writeups/hackmyvm/wave/media/01.webp)',
      ].join('\n')
    );
  });

  it('leaves unmatched references untouched AND pushes one problem per name', () => {
    expect(plan.problems).toEqual([
      'Unmatched image reference in wave.md: "ghost.png" has no file in the images list.',
    ]);
  });

  it('dedupes unmatched problems for repeated references', () => {
    const repeated = planContentIngestion(
      'writeup',
      doc(WAVE_YAML, '[[ghost.png]] y otra vez [[ghost.png]]'),
      'wave.md',
      []
    );
    expect(repeated.problems).toEqual([
      'Unmatched image reference in wave.md: "ghost.png" has no file in the images list.',
    ]);
    expect(repeated.rewrittenBody).toBe('[[ghost.png]] y otra vez [[ghost.png]]');
  });

  it('matches case-insensitively only after the case-sensitive match fails', () => {
    const folded = planContentIngestion('writeup', doc(WAVE_YAML, '[[01.PNG]]'), 'wave.md', [
      '01.png',
    ]);
    expect(folded.problems).toEqual([]);
    expect(folded.rewrittenBody).toBe('![img1](/writeups/hackmyvm/wave/media/01.webp)');

    // Both cases exist: the exact name wins its own slot.
    const cased = planContentIngestion('writeup', doc(WAVE_YAML, '[[a.png]] [[A.png]]'), 'wave.md', [
      'a.png',
      'A.png',
    ]);
    expect(cased.problems).toEqual([]);
    expect(cased.rewrittenBody).toBe(
      '![img2](/writeups/hackmyvm/wave/media/02.webp) ![img1](/writeups/hackmyvm/wave/media/01.webp)'
    );
  });

  it('leaves non-image wikilinks alone without a problem', () => {
    const wiki = planContentIngestion('writeup', doc(WAVE_YAML, 'Ver [[Otra máquina]].'), 'wave.md', [
      '01.png',
    ]);
    expect(wiki.problems).toEqual([]);
    expect(wiki.rewrittenBody).toBe('Ver [[Otra máquina]].');
  });

  it('returns an empty body unchanged', () => {
    const empty = planContentIngestion('writeup', doc(WAVE_YAML), 'wave.md', ['01.png']);
    expect(empty.rewrittenBody).toBe('');
  });

  it('returns a body without references unchanged (never invents insertions)', () => {
    const plain = planContentIngestion(
      'writeup',
      doc(WAVE_YAML, 'Solo texto, sin evidencias.'),
      'wave.md',
      ['01.png']
    );
    expect(plain.rewrittenBody).toBe('Solo texto, sin evidencias.');
  });

  it('numbers unreferenced images too (the folder plan is complete)', () => {
    const partial = planContentIngestion('writeup', doc(WAVE_YAML, 'Solo [[b.png]].'), 'wave.md', [
      'b.png',
      'a.png',
    ]);
    expect(partial.imagePlan).toEqual([
      { source: 'a.png', target: 'media/01.webp' },
      { source: 'b.png', target: 'media/02.webp' },
    ]);
    expect(partial.rewrittenBody).toBe('Solo ![img2](/writeups/hackmyvm/wave/media/02.webp).');
  });
});

// ---------------------------------------------------------------------------
// Drafts: reported as a flag, never a problem (the CLI decides)
// ---------------------------------------------------------------------------

describe('planContentIngestion — draft flag', () => {
  const draftYaml = WAVE_YAML.map((line) => (line === 'draft: false' ? 'draft: true' : line));

  it('reports isDraft without pushing a problem', () => {
    const plan = planContentIngestion('writeup', doc(draftYaml), 'wave.md', []);
    expect(plan.isDraft).toBe(true);
    expect(plan.problems).toEqual([]);
  });

  it('still collects every validation problem for a draft (complete plan)', () => {
    const noLevel = draftYaml.filter((line) => !line.startsWith('level:'));
    const plan = planContentIngestion('writeup', doc(noLevel), 'wave.md', []);
    expect(plan.isDraft).toBe(true);
    expect(plan.problems).toEqual([
      'Missing writeup level in wave.md: expected one of "Easy", "Medium", "Hard".',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Purity: no node builtins, sync, deterministic, inputs untouched
// ---------------------------------------------------------------------------

describe('planContentIngestion — purity', () => {
  it('imports no node builtin (no fs/path/process access in the module source)', () => {
    const source = readFileSync(new URL('../lib/content-ingest.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"](?:node:)?(?:fs|path|os|child_process|url)['"]/);
    expect(source).not.toMatch(/require\s*\(/);
    expect(source).not.toMatch(/\bprocess\./);
  });

  it('is pure and synchronous', () => {
    const markdown = doc(WAVE_YAML, 'Evidencia [[01.png]].');
    const images = ['02.jpg', '01.png'];
    const options = { platform: 'HackMyVM', level: 'Medium' };
    const before = { markdown, images: structuredClone(images), options: structuredClone(options) };

    const first = planContentIngestion('writeup', markdown, 'wave.md', images, options);
    const second = planContentIngestion('writeup', markdown, 'wave.md', images, options);

    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first.imagePlan).not.toBe(second.imagePlan); // fresh output objects
    expect(markdown).toBe(before.markdown);
    expect(images).toEqual(before.images);
    expect(options).toEqual(before.options);
  });
});

// Writeup detail view-model contract: the PURE builder `buildWriteupView`
// (src/lib/writeupView.ts) turns a writeup resolved from the REAL content
// pipeline — the index entry mapped with toUiWriteup plus its real markdown
// document body (pipeline doc.content, carried on `writeup.markdownContent`) —
// into exactly what WriteupPage renders: markdown body, chips, tags, links and
// the sections TOC.
//
// Hard rules under test:
//   1. The body is ALWAYS the real pipeline markdown. There is no template
//      data source at all anymore (the curated map was deleted once wave's
//      links were migrated verbatim into its frontmatter).
//   2. Chips render only what the real data has. The invented
//      "PWNED: ROOT (100%)" badge is gone for good; DIFICULTAD / OS render
//      only when the field exists.
//   3. Tags come from the real entry only, and absent os / difficulty /
//      vulnerabilities can NEVER crash the builder (the old tags useMemo
//      spread `...writeup.vulnerabilities`).
//   4. Links come from the writeup's frontmatter ONLY (writeup-links, single
//      source of truth): a present key renders verbatim — an explicit empty
//      array means "none"; an absent key resolves to [] (the page hides the
//      section). There is no fallback source; nothing is ever fabricated.
//   5. The TOC is extracted from the real markdown body: fenced-code comments
//      are not headings, and every TOC anchor matches the id MarkdownRenderer
//      actually renders (so the sidebar links scroll to the right place).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { toUiWriteup } from '../src/lib/contentAdapter';
import { MarkdownRenderer } from '../src/components/MarkdownRenderer';
import { buildWriteupView } from '../src/lib/writeupView';
import type { WriteupIndexItem } from '../types';
import type { Writeup } from '../src/types';

// ---------------------------------------------------------------------------
// Real fixtures straight from the repository (same sources the route loads).
// ---------------------------------------------------------------------------

const REAL_INDEX = JSON.parse(readFileSync('public/index.json', 'utf8')) as WriteupIndexItem[];
const WAVE_ENTRY = REAL_INDEX.find((item) => item.slug === 'wave') as WriteupIndexItem;
const WAVE_BODY = parseFrontmatter<Record<string, never>>(
  readFileSync('public/writeups/hackmyvm/wave.md', 'utf8')
).content;

// Exactly what detailRoutes resolves and passes to WriteupPage for a real
// writeup: the mapped index entry + the real markdown body.
const WAVE_SOURCE: Writeup = {
  ...toUiWriteup(WAVE_ENTRY),
  markdownContent: WAVE_BODY,
};

// The smallest object the pipeline can resolve (no tags / os / difficulty /
// vulnerabilities / summary / markdown body at all).
const BARE_SOURCE: Writeup = {
  id: 'krustykrab',
  title: 'KrustyKrab',
  iconType: 'wave',
};

// Real-shaped frontmatter links (writeup-links): what toUiWriteup maps onto the
// Writeup when the human authors the keys — the ONLY link source.
const FRONTMATTER_LINKS: {
  machineLinks: NonNullable<Writeup['machineLinks']>;
  toolLinks: NonNullable<Writeup['toolLinks']>;
} = {
  machineLinks: [
    {
      title: 'HackMyVM // Wave (Perfil Oficial)',
      url: 'https://hackmyvm.eu/machines/machine.php?vm=Wave',
      type: 'platform',
    },
  ],
  toolLinks: [
    { name: 'ffuf', url: 'https://github.com/ffuf/ffuf', description: 'fuzzer de rutas web' },
  ],
};

// ---------------------------------------------------------------------------
// 1. Body: the REAL markdown, never template content
// ---------------------------------------------------------------------------

describe('buildWriteupView — body source', () => {
  it('renders the real pipeline markdown as the body', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.markdownContent).toBe(WAVE_BODY);
    expect(view.markdownContent).toContain('# Enumeración');
    expect(view.markdownContent).toContain('sudo arp-scan');
  });

  // The old "never takes the body from the retired curated sample map" pin
  // died with that deleted map: nothing imports that data anymore, so the
  // concern is extinct (not merely untested) — the body has no other source by
  // construction.

  it('an absent markdown body yields an empty body', () => {
    const view = buildWriteupView({ ...BARE_SOURCE, markdownContent: undefined });
    expect(view.markdownContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. Chips: only what the real data has — PWNED badge deleted for good
// ---------------------------------------------------------------------------

describe('buildWriteupView — chips', () => {
  it('renders only the platform chip for pipeline data (no difficulty / os source)', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.chips).toEqual([
      { kind: 'platform', label: 'HACKMYVM', tone: 'platform' },
    ]);
  });

  it('renders DIFICULTAD / OS chips only when the fields exist', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      platformId: 'hackmyvm',
      difficulty: 'MEDIO',
      os: 'LINUX',
    });
    expect(view.chips).toEqual([
      { kind: 'platform', label: 'HACKMYVM', tone: 'platform' },
      { kind: 'difficulty', label: 'DIFICULTAD: MEDIO', tone: 'medium' },
      { kind: 'os', label: 'OS: LINUX', tone: 'neutral' },
    ]);
  });

  it('maps difficulty to honest tones', () => {
    const chipFor = (difficulty: Writeup['difficulty']) =>
      buildWriteupView({ ...BARE_SOURCE, difficulty }).chips.find((c) => c.kind === 'difficulty');
    expect(chipFor('FÁCIL')?.tone).toBe('easy');
    expect(chipFor('MEDIO')?.tone).toBe('medium');
    expect(chipFor('DIFÍCIL')?.tone).toBe('hard');
    expect(chipFor('INSANE')?.tone).toBe('hard');
  });

  it('never emits the invented PWNED / ROOT (100%) badge or any fabricated value', () => {
    const sources: Writeup[] = [
      BARE_SOURCE,
      WAVE_SOURCE,
      { ...BARE_SOURCE, platformId: 'hackmyvm', difficulty: 'DIFÍCIL', os: 'WINDOWS' },
    ];
    for (const source of sources) {
      const labels = buildWriteupView(source).chips.map((chip) => chip.label).join(' | ');
      expect(labels).not.toMatch(/PWNED/i);
      expect(labels).not.toMatch(/100%/);
      expect(labels).not.toMatch(/ROOT/);
      expect(labels).not.toMatch(/undefined/);
      expect(labels).not.toMatch(/:\s*$/); // no empty "DIFICULTAD: " / "OS: " chips
    }
  });

  it('has no platform chip when the pipeline supplies no platform', () => {
    const view = buildWriteupView(BARE_SOURCE);
    expect(view.platformName).toBeUndefined();
    expect(view.chips).toEqual([]);
  });

  it('derives the platform label honestly and never relabels unknown platforms', () => {
    const labelFor = (platformId: Writeup['platformId']) =>
      buildWriteupView({ ...BARE_SOURCE, platformId }).platformName;
    expect(labelFor('hackmyvm')).toBe('HackMyVM');
    expect(labelFor('HackTheBox')).toBe('HackTheBox');
    expect(labelFor('some-oscp-lab')).toBe('some-oscp-lab');
  });
});

// ---------------------------------------------------------------------------
// 3. Tags: real entry data only, crash-safe on absent optional fields
// ---------------------------------------------------------------------------

describe('buildWriteupView — tags', () => {
  it('does not crash when os / difficulty / vulnerabilities are all absent (old tags memo regression)', () => {
    expect(() => buildWriteupView(BARE_SOURCE)).not.toThrow();
    expect(buildWriteupView(BARE_SOURCE).tags).toEqual([]);
  });

  it('uses only the real tags of the entry, normalized', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      tags: ['#Privilege Escalation', '  File Upload  ', ''],
    });
    expect(view.tags).toEqual(['Privilege Escalation', 'File Upload']);
  });

  it('takes no tags from anywhere but the real entry (no template source exists)', () => {
    expect(buildWriteupView(BARE_SOURCE).tags).toEqual([]);
    expect(buildWriteupView({ ...WAVE_SOURCE, tags: undefined }).tags).toEqual([]);
  });

  it('maps the real metadata the entry supplies and nothing more', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.title).toBe('Wave');
    expect(view.summary).toBe(WAVE_ENTRY.description);
    expect(view.id).toBe('wave');
  });
});

// ---------------------------------------------------------------------------
// 4. Links: frontmatter is the ONLY source (no template/fallback data exists)
// ---------------------------------------------------------------------------

describe('buildWriteupView — machineLinks / toolLinks (frontmatter only)', () => {
  it('frontmatter links render verbatim (the single source of truth)', () => {
    const view = buildWriteupView({ ...WAVE_SOURCE, ...FRONTMATTER_LINKS });
    expect(view.machineLinks).toEqual(FRONTMATTER_LINKS.machineLinks);
    expect(view.toolLinks).toEqual(FRONTMATTER_LINKS.toolLinks);
  });

  it('wave renders its migrated frontmatter links verbatim (1 machine + 5 tool links, categories kept)', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.machineLinks).toEqual(WAVE_SOURCE.machineLinks);
    expect(view.toolLinks).toEqual(WAVE_SOURCE.toolLinks);
    expect(view.machineLinks).toHaveLength(1); // migrated machineLinks entry
    expect(view.toolLinks).toHaveLength(5); // migrated toolLinks entries
    expect(view.toolLinks.every((link) => link.category !== undefined)).toBe(true); // incl. category
  });

  it('absent links keys resolve to [] for ANY slug — wave included (no fallback source exists)', () => {
    const stripped = { ...WAVE_SOURCE, machineLinks: undefined, toolLinks: undefined };
    const view = buildWriteupView(stripped);
    expect(view.machineLinks).toEqual([]);
    expect(view.toolLinks).toEqual([]);
    const bare = buildWriteupView({ ...BARE_SOURCE, id: 'krustykrab' });
    expect(bare.machineLinks).toEqual([]);
    expect(bare.toolLinks).toEqual([]);
  });

  it('an explicit empty frontmatter array means "none" (never filled from anywhere)', () => {
    const view = buildWriteupView({ ...WAVE_SOURCE, machineLinks: [], toolLinks: [] });
    expect(view.machineLinks).toEqual([]);
    expect(view.toolLinks).toEqual([]);
  });

  it('never fabricates links: no option, argument or slug lookup can inject them', () => {
    const stripped = { ...WAVE_SOURCE, machineLinks: undefined, toolLinks: undefined };
    // The retired template override passed extras as a second argument; any
    // such argument must be inert — links come from the writeup or not at all.
    const withStaleArgument = (
      buildWriteupView as unknown as (
        w: Writeup,
        o?: Record<string, unknown>
      ) => ReturnType<typeof buildWriteupView>
    )(stripped, {
      template: {
        markdown: 'MARKDOWN DE PLANTILLA — NUNCA debe ser el cuerpo',
        machineLinks: [
          { title: 'Inyectado', url: 'https://example.test/injected', badge: 'FALSO', type: 'platform' },
        ],
        toolLinks: [
          { name: 'inyectada', url: 'https://example.test/injected-tool', description: 'falso' },
        ],
      },
    });
    expect(withStaleArgument).toEqual(buildWriteupView(stripped));
    const urls = [...withStaleArgument.machineLinks, ...withStaleArgument.toolLinks].map((l) => l.url);
    expect(urls).not.toContain(
      'https://github.com/danystark/stark-recon-suite' // the old generated fallback's fake link
    );
    expect(urls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Sections TOC from the real markdown — correct and anchored
// ---------------------------------------------------------------------------

describe('buildWriteupView — sections TOC', () => {
  it('extracts the real section list from the pipeline markdown', () => {
    const view = buildWriteupView(WAVE_SOURCE);
    expect(view.headings).toHaveLength(9);
    expect(view.headings.map((h) => h.cleanText)).toEqual([
      'Enumeración',
      'Explotación',
      'Escalando Privilegios 1',
      'Escalada de Privilegios 2',
      'Mitigaciones',
      'Exposición de información sensible y copias de seguridad',
      'Ausencia de control de integridad y detección de webshells',
      'Configuración insegura de servicios y escritura en directorios críticos',
      'Configuración permisiva de Sudo',
    ]);
    expect(view.headings[0].level).toBe(1);
    expect(view.headings[5].level).toBe(2);
  });

  it('fenced-code comments are not headings', () => {
    const view = buildWriteupView({
      ...BARE_SOURCE,
      markdownContent: [
        '# Real',
        '',
        '```bash',
        '# comentario de shell, no es un encabezado',
        'echo "# tampoco"',
        '```',
        '',
        '## También real',
        '',
        '# Real',
      ].join('\n'),
    });
    expect(view.headings.map((h) => h.cleanText)).toEqual(['Real', 'También real', 'Real']);
  });

  it('every TOC anchor matches the id MarkdownRenderer renders', () => {
    const fixtures = [WAVE_BODY, buildWriteupView({
      ...BARE_SOURCE,
      markdownContent: [
        '# Duplicado',
        '',
        '```bash',
        '# comentario dentro de código',
        '```',
        '',
        '## Duplicado',
        '',
        '# Duplicado',
        '',
        '# !!',
        '',
        '## Válido',
      ].join('\n'),
    }).markdownContent];
    for (const markdown of fixtures) {
      const { headings } = buildWriteupView({ ...BARE_SOURCE, markdownContent: markdown });
      const markup = renderToStaticMarkup(createElement(MarkdownRenderer, { content: markdown }));
      expect(headings.length).toBeGreaterThan(0);
      for (const heading of headings) {
        expect(markup, `anchor ${heading.id} must exist in the rendered document`).toContain(
          `id="${heading.id}"`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Purity + the page itself (rendered): real body in, invented badges out
// ---------------------------------------------------------------------------

describe('buildWriteupView — purity', () => {
  it('is pure and synchronous', () => {
    const before = structuredClone(WAVE_SOURCE);
    const first = buildWriteupView(WAVE_SOURCE);
    const second = buildWriteupView(WAVE_SOURCE);
    expect(first).not.toBeInstanceOf(Promise);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(WAVE_SOURCE).toEqual(before); // input untouched
  });
});

describe('WriteupPage (rendered with real pipeline data)', () => {
  // Dynamic import keeps the RED failure honest: today the view module does not
  // exist yet, and WriteupPage must consume it instead of template content.
  const renderPage = async (source: Writeup): Promise<string> => {
    const { WriteupPage } = await import('../src/components/WriteupPage');
    return renderToStaticMarkup(
      createElement(WriteupPage, { writeup: source, onBack: () => undefined })
    );
  };

  it('renders the real markdown body for /writeups/hackmyvm/wave', async () => {
    const markup = await renderPage(WAVE_SOURCE);
    expect(markup).toContain('Enumeración');
    expect(markup).toContain('sudo arp-scan');
  });

  it('shows no invented badges and hides DIFICULTAD / OS on real data', async () => {
    const markup = await renderPage(WAVE_SOURCE);
    expect(markup).not.toMatch(/PWNED/i);
    expect(markup).not.toContain('DIFICULTAD:');
    expect(markup).not.toContain('OS:');
  });

  it('renders link sections exactly when the resolved view carries them (frontmatter links for wave)', async () => {
    const withLinks = await renderPage(WAVE_SOURCE);
    expect(withLinks).toContain('ENLACES DE LA MÁQUINA');
    expect(withLinks).toContain('HERRAMIENTAS');
    expect(withLinks).toContain('OTROS LINKS');
    const withoutLinks = await renderPage({
      ...BARE_SOURCE,
      id: 'krustykrab',
      markdownContent: '# Hola',
    });
    expect(withoutLinks).not.toContain('ENLACES DE LA MÁQUINA');
    expect(withoutLinks).not.toContain('OTROS LINKS');
    expect(withoutLinks).toContain('Hola'); // body still renders
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentIndexError,
  fetchIndex,
  fetchIndexByKind,
  fetchWriteup,
  getCertificates,
  getMachinesByPlatform,
  getPlatforms,
  getProjects,
  getRecentWriteups,
  mostRecentByDate,
} from '../lib/content';
import type { WriteupIndexItem } from '../types';

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function textResponse(body: string): Response {
  return { ok: true, text: async () => body } as unknown as Response;
}

function notOkResponse(): Response {
  return { ok: false } as unknown as Response;
}

function makeItem(overrides: Partial<WriteupIndexItem> = {}): WriteupIndexItem {
  return {
    kind: 'writeup',
    title: 'Writeup',
    date: '2026-01-01',
    platform: 'hackmyvm',
    slug: 'writeup',
    path: '/writeups/hackmyvm/writeup.md',
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  // fetchIndex/fetchWriteup log to console.error on failure; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchIndex', () => {
  it('returns the parsed index when the request succeeds', async () => {
    const items = [makeItem({ slug: 'wave' })];
    fetchMock.mockResolvedValue(jsonResponse(items));

    await expect(fetchIndex()).resolves.toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith('/index.json');
  });

  // CONTRACT CHANGE (R3-index-kind-silent-empty): the old contract resolved [] on
  // a failed response, indistinguishable from "this kind has no entries". The
  // index accessors now REJECT with ContentIndexError so callers can tell a
  // broken deployment from empty content.
  it('rejects with a ContentIndexError when the index response is not ok', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchIndex()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(fetchIndex()).rejects.toThrow("Did you run 'node scripts/generate-index.js'?");
  });

  it('rejects with a ContentIndexError when the request rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(fetchIndex()).rejects.toBeInstanceOf(ContentIndexError);
  });

  it('rejects with a ContentIndexError when the index body is not parseable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response);

    await expect(fetchIndex()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(fetchIndex()).rejects.toThrow("Did you run 'node scripts/generate-index.js'?");
  });

  it('rejects with a ContentIndexError when the index JSON is not an array', async () => {
    // JSON válido no implica índice válido: sin validación de forma, el filtro
    // el filtro de abajo revienta con un TypeError sin el hint (R3-001).
    fetchMock.mockResolvedValue(jsonResponse({ not: 'an array' }));

    await expect(fetchIndex()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(fetchIndex()).rejects.toThrow('expected an array');
    await expect(fetchIndex()).rejects.toThrow("Did you run 'node scripts/generate-index.js'?");
  });

  it('still resolves [] for a legitimately empty index', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await expect(fetchIndex()).resolves.toEqual([]);
    await expect(getPlatforms()).resolves.toEqual([]);
    await expect(getRecentWriteups()).resolves.toEqual([]);
  });
});

// CONTRACT CHANGE (R3-array-entry-shape-unvalidated): the index boundary also
// validates every ENTRY. A corrupt entry must fail loudly with ContentIndexError
// naming the offending entry — never degrade into "no content" via the cast and
// a silent filter (or a bare TypeError in getPlatforms on item.platform).
describe('index entry shape validation (R3-array-entry-shape-unvalidated)', () => {
  it('rejects an entry missing its required fields, naming entry 0 and the missing fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ kind: 'writeup' }]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('title');
    await expect(rejection).rejects.toThrow('date');
    await expect(rejection).rejects.toThrow('platform');
    await expect(rejection).rejects.toThrow("Did you run 'node scripts/generate-index.js'?");
  });

  it('rejects non-object entries, naming the first offending entry index', async () => {
    fetchMock.mockResolvedValue(jsonResponse([1, 2, 3]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow("Did you run 'node scripts/generate-index.js'?");
  });

  it('still resolves a valid writeup index (regression guard)', async () => {
    const items = [makeItem()];
    fetchMock.mockResolvedValue(jsonResponse(items));

    await expect(fetchIndex()).resolves.toEqual(items);
  });

  it('names the offending entry index even when earlier entries are valid', async () => {
    fetchMock.mockResolvedValue(jsonResponse([makeItem(), 7]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toThrow(/entry 1/);
    await expect(rejection).rejects.toThrow('expected a plain object entry, got number');
  });

  it('rejects a null entry', async () => {
    fetchMock.mockResolvedValue(jsonResponse([null]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('null');
  });

  it('rejects an unknown kind, naming the offending value and every valid kind', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...makeItem(), kind: 'book' }]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('book');
    await expect(rejection).rejects.toThrow('"writeup", "project", "certificate"');
  });

  it('rejects a blank index-level slug', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...makeItem(), slug: '   ' }]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('slug');
  });

  it('rejects a blank platform on a platformed kind', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...makeItem(), platform: '  ' }]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('platform');
  });

  it('applies the required-field rule to certificates too: an entry without `order` rejects (R3-order-fallback-unproved seam)', async () => {
    fetchMock.mockResolvedValue(jsonResponse([
      {
        kind: 'certificate',
        title: 'Cert',
        slug: 'cert',
        path: '/certificates/cert.md',
        image: '/certificates/cert/media/cover.webp',
        description: 'd',
      },
    ]));

    const rejection = getCertificates();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('order');
  });

  it('rejects a project entry without a group, naming the valid options', async () => {
    // `group` no vive en `required`: el generador lo valida con assertValidGroup,
    // así que el borde tiene que chequearlo aparte o un proyecto sin grupo
    // pasa en silencio y la UI no puede seccionarlo.
    fetchMock.mockResolvedValue(jsonResponse([
      {
        kind: 'project',
        title: 'Proj',
        date: '2026-02-02',
        slug: 'proj',
        path: '/projects/proj.md',
        image: '/projects/proj/media/cover.webp',
      },
    ]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow(/entry 0/);
    await expect(rejection).rejects.toThrow('group');
    await expect(rejection).rejects.toThrow('scripts');
  });

  it('rejects a group outside PROJECT_GROUPS, naming the offending value', async () => {
    fetchMock.mockResolvedValue(jsonResponse([
      {
        kind: 'project',
        title: 'Proj',
        date: '2026-02-02',
        slug: 'proj',
        path: '/projects/proj.md',
        image: '/projects/proj/media/cover.webp',
        group: 'no-existe',
      },
    ]));

    const rejection = fetchIndex();

    await expect(rejection).rejects.toBeInstanceOf(ContentIndexError);
    await expect(rejection).rejects.toThrow('no-existe');
    await expect(rejection).rejects.toThrow('herramientas');
  });
});

describe('index accessors reject on infrastructure failure (R3-index-kind-silent-empty)', () => {
  it('fetchIndexByKind, getPlatforms, getMachinesByPlatform, getRecentWriteups, getProjects and getCertificates reject instead of resolving []', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchIndexByKind('writeup')).rejects.toBeInstanceOf(ContentIndexError);
    await expect(getPlatforms()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(getMachinesByPlatform('hackmyvm')).rejects.toBeInstanceOf(ContentIndexError);
    await expect(getRecentWriteups()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(getProjects()).rejects.toBeInstanceOf(ContentIndexError);
    await expect(getCertificates()).rejects.toBeInstanceOf(ContentIndexError);
  });
});

describe('getPlatforms', () => {
  it('aggregates writeup counts per platform with lowercased ids', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        makeItem({ slug: 'a', platform: 'HackMyVM' }),
        makeItem({ slug: 'b', platform: 'hackmyvm' }),
        makeItem({ slug: 'c', platform: 'TryHackMe' }),
      ])
    );

    await expect(getPlatforms()).resolves.toEqual([
      { id: 'hackmyvm', name: 'hackmyvm', count: 2 },
      { id: 'tryhackme', name: 'tryhackme', count: 1 },
    ]);
  });
});

describe('getMachinesByPlatform', () => {
  it('filters machines by platform case-insensitively', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        makeItem({ slug: 'wave', platform: 'hackmyvm' }),
        makeItem({ slug: 'blue', platform: 'TryHackMe' }),
      ])
    );

    const upper = await getMachinesByPlatform('HACKMYVM');
    const lower = await getMachinesByPlatform('tryhackme');

    expect(upper.map((item) => item.slug)).toEqual(['wave']);
    expect(lower.map((item) => item.slug)).toEqual(['blue']);
  });
});

describe('mostRecentByDate', () => {
  const entry = (id: string, date?: string): { id: string; date?: string } =>
    date === undefined ? { id } : { id, date };

  it('returns entries sorted by date descending within the limit', () => {
    const items = [
      entry('old', '2024-01-01'),
      entry('new', '2026-05-05'),
      entry('mid', '2025-03-03'),
      entry('extra', '2026-01-01'),
    ];

    expect(mostRecentByDate(items, 2).map((item) => item.id)).toEqual(['new', 'extra']);
  });

  it('keeps the input order for tied dates (stable tie-break)', () => {
    const items = [
      entry('a', '2026-01-01'),
      entry('b', '2026-01-01'),
      entry('x', '2026-06-01'),
      entry('c', '2026-01-01'),
    ];

    expect(mostRecentByDate(items, 4).map((item) => item.id)).toEqual(['x', 'a', 'b', 'c']);
    expect(mostRecentByDate(items, 3).map((item) => item.id)).toEqual(['x', 'a', 'b']);
  });

  it('sorts missing or unparseable dates after every dated entry, never inventing a date', () => {
    const items = [
      entry('undated'),
      entry('bad', 'not-a-date'),
      entry('new', '2026-01-02'),
      entry('old', '2025-01-01'),
    ];

    const result = mostRecentByDate(items, 4);

    expect(result.map((item) => item.id)).toEqual(['new', 'old', 'undated', 'bad']);
    // Never invented: the undated entry stays undated, the bad date passes through verbatim.
    expect(result[2].date).toBeUndefined();
    expect(result[3].date).toBe('not-a-date');
    // Dated entries always outrank undated/unparseable ones inside the limit.
    expect(mostRecentByDate(items, 2).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('returns everything when the limit exceeds the input, and [] for limit <= 0', () => {
    const items = [entry('a', '2025-01-01'), entry('b', '2026-01-01')];

    expect(mostRecentByDate(items, 10).map((item) => item.id)).toEqual(['b', 'a']);
    expect(mostRecentByDate(items, 0)).toEqual([]);
    expect(mostRecentByDate(items, -1)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [entry('undated'), entry('a', '2025-01-01'), entry('b', '2026-01-01')];
    const snapshot = [...items];

    mostRecentByDate(items, 2);

    expect(items).toEqual(snapshot);
    expect(items.map((item) => item.id)).toEqual(['undated', 'a', 'b']);
  });
});

describe('getRecentWriteups', () => {
  it('returns the most recent writeups by date descending within the limit', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        makeItem({ slug: 'old', date: '2024-01-01' }),
        makeItem({ slug: 'new', date: '2026-05-05' }),
        makeItem({ slug: 'mid', date: '2025-03-03' }),
      ])
    );

    const result = await getRecentWriteups(2);

    expect(result.map((item) => item.slug)).toEqual(['new', 'mid']);
  });

  it('returns every writeup when the limit exceeds the index size', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        makeItem({ slug: 'old', date: '2024-01-01' }),
        makeItem({ slug: 'new', date: '2026-05-05' }),
      ])
    );

    const result = await getRecentWriteups(10);

    expect(result.map((item) => item.slug)).toEqual(['new', 'old']);
  });
});

describe('fetchWriteup', () => {
  it('merges frontmatter data with the raw body and the requested platform', async () => {
    const markdown =
      '---\ntitle: "Wave"\ndate: 2026-09-15\nlevel: Medium\ntags: ["a"]\n---\n\n# Body\n\nText.\n';
    fetchMock.mockResolvedValue(textResponse(markdown));

    const result = await fetchWriteup('hackmyvm', 'wave');

    expect(fetchMock).toHaveBeenCalledWith('/writeups/hackmyvm/wave.md');
    expect(result).toEqual({
      slug: 'wave',
      content: '\n# Body\n\nText.\n',
      title: 'Wave',
      date: '2026-09-15',
      level: 'Medium',
      tags: ['a'],
      platform: 'hackmyvm',
    });
  });

  it('prefers the requested platform over any platform in the frontmatter', async () => {
    fetchMock.mockResolvedValue(textResponse('---\ntitle: "T"\nplatform: tryhackme\n---\nbody\n'));

    const result = await fetchWriteup('hackmyvm', 't');

    expect(result?.platform).toBe('hackmyvm');
  });

  it('falls back to slug title and today date when the file has no frontmatter', async () => {
    const markdown = '# Bare body\n\nNo frontmatter.\n';
    fetchMock.mockResolvedValue(textResponse(markdown));

    const result = await fetchWriteup('hackmyvm', 'bare');
    const today = new Date().toISOString().split('T')[0];

    expect(result).toEqual({
      slug: 'bare',
      content: markdown,
      title: 'bare',
      date: today,
      platform: 'hackmyvm',
    });
  });

  it('returns null when the response is not ok', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchWriteup('hackmyvm', 'missing')).resolves.toBeNull();
  });
});

describe('fetchWriteup metadata guarantees (R3-04)', () => {
  it('falls back to slug title and today date when the frontmatter omits both', async () => {
    fetchMock.mockResolvedValue(textResponse('---\nlevel: Medium\n---\nbody\n'));

    const result = await fetchWriteup('hackmyvm', 'wave');

    expect(result).toEqual({
      slug: 'wave',
      content: 'body\n',
      level: 'Medium',
      title: 'wave',
      date: new Date().toISOString().split('T')[0],
      platform: 'hackmyvm',
    });
  });

  it('keeps a present title but falls back for a missing date', async () => {
    fetchMock.mockResolvedValue(textResponse('---\ntitle: "Wave"\n---\nbody\n'));

    const result = await fetchWriteup('hackmyvm', 'wave');

    expect(result?.title).toBe('Wave');
    expect(result?.date).toBe(new Date().toISOString().split('T')[0]);
    expect(result?.platform).toBe('hackmyvm');
  });

  it('keeps a present date but falls back for a missing title', async () => {
    fetchMock.mockResolvedValue(textResponse('---\ndate: 2026-09-15\n---\nbody\n'));

    const result = await fetchWriteup('hackmyvm', 'wave');

    expect(result?.title).toBe('wave');
    expect(result?.date).toBe('2026-09-15');
  });

  it('does not let frontmatter override the slug or the markdown body (R3-001)', async () => {
    fetchMock.mockResolvedValue(
      textResponse('---\ntitle: "Wave"\nslug: evil\ncontent: corrupto\n---\nbody\n'),
    );

    const result = await fetchWriteup('hackmyvm', 'wave');

    expect(result?.slug).toBe('wave');
    expect(result?.content).toBe('body\n');
    expect(result?.title).toBe('Wave');
  });
});

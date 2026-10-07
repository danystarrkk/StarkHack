import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchIndex,
  fetchWriteup,
  getMachinesByPlatform,
  getPlatforms,
  getRecentWriteups,
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

  it('returns an empty list when the index response is not ok', async () => {
    fetchMock.mockResolvedValue(notOkResponse());

    await expect(fetchIndex()).resolves.toEqual([]);
  });

  it('returns an empty list when the request rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(fetchIndex()).resolves.toEqual([]);
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

import { parseFrontmatter } from './frontmatter.js';
import {
  ContentDoc,
  ContentIndexItem,
  ContentKind,
  Frontmatter,
  WriteupIndexItem,
  WriteupContent,
  PlatformStats,
} from '../types';

const INDEX_URL = '/index.json';

// Raw fetch of the generated index (every content kind, exactly as generated).
const fetchRawIndex = async (): Promise<ContentIndexItem[]> => {
  try {
    const response = await fetch(INDEX_URL);
    if (!response.ok) {
      console.error("Index not found. Did you run 'node scripts/generate-index.js'?");
      return [];
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch content index:", error);
    return [];
  }
};

// Raw accessor: every index entry of one content kind, in index order.
export const fetchIndexByKind = async (kind: ContentKind): Promise<ContentIndexItem[]> => {
  const index = await fetchRawIndex();
  return index.filter((item) => item.kind === kind);
};

// Fetch the writeup index — and ONLY writeups.
//
// Phase 1 contract: public/index.json carries all three content kinds, but the
// untouched UI (Directory, Home, Machines) calls this function directly and
// renders the result as machines. Returning projects/certificates here would
// list them as machines, so this intentionally stays writeup-only. Use
// fetchIndexByKind()/getProjects()/getCertificates() for the other kinds.
export const fetchIndex = async (): Promise<WriteupIndexItem[]> => {
  // Writeup entries are guaranteed title/date/platform by the generator,
  // hence the narrowing cast on top of the raw accessor.
  return (await fetchIndexByKind('writeup')) as WriteupIndexItem[];
};

// All project entries (flat kind: /projects/<slug>.md, no platform level).
export const getProjects = async (): Promise<ContentIndexItem[]> => {
  return fetchIndexByKind('project');
};

// All certificate entries, sorted ascending by `order` (the display order).
export const getCertificates = async (): Promise<ContentIndexItem[]> => {
  const certificates = await fetchIndexByKind('certificate');
  return certificates.sort((a, b) => {
    if (a.order === undefined) return b.order === undefined ? 0 : 1;
    if (b.order === undefined) return -1;
    return a.order - b.order;
  });
};

// Get list of platforms from the index
export const getPlatforms = async (): Promise<PlatformStats[]> => {
  const index = await fetchIndex();
  const platforms: Record<string, number> = {};

  index.forEach(item => {
    const p = item.platform.toLowerCase();
    platforms[p] = (platforms[p] || 0) + 1;
  });

  return Object.entries(platforms).map(([name, count]) => ({
    id: name,
    name: name, // Capitalization could be improved here or in CSS
    count
  }));
};

// Get machines for a specific platform
export const getMachinesByPlatform = async (platformId: string): Promise<WriteupIndexItem[]> => {
  const index = await fetchIndex();
  return index.filter(item => item.platform.toLowerCase() === platformId.toLowerCase());
};

// Get the N most recent writeups regardless of platform
export const getRecentWriteups = async (limit: number = 3): Promise<WriteupIndexItem[]> => {
  const index = await fetchIndex();
  // Ensure sorting by date descending just in case index.json isn't perfectly sorted
  const sorted = index.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  return sorted.slice(0, limit);
};

// Shared loader for one markdown document: fetch, parse the frontmatter with the
// shared implementation (lib/frontmatter.js) and guarantee `slug`, `content`,
// `title` and `date` on every path (missing title falls back to the slug, missing
// date to today). Used by fetchWriteup, fetchProject and fetchCertificate so the
// three fetchers cannot drift apart; fetchWriteup's observable behaviour is
// unchanged.
async function fetchMarkdownDoc(
  filePath: string,
  slug: string,
  label: string
): Promise<ContentDoc | null> {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("File not found");
    const text = await response.text();

    const { data, content } = parseFrontmatter<Partial<Frontmatter>>(text);

    return {
      // El spread va primero: lo que el frontmatter aporte llena el resto,
      // pero slug y content se declaran después para que una clave `slug:` o
      // `content:` escrita en el YAML no pueda pisar el id ni el cuerpo real.
      ...data,
      slug,
      content,
      // Required metadata is guaranteed on every path: fall back to the slug
      // and to today's date when the frontmatter leaves either field unset.
      title: data.title ?? slug,
      date: data.date ?? new Date().toISOString().split('T')[0],
    };

  } catch (error) {
    console.error(`Error fetching ${label} ${filePath}:`, error);
    return null;
  }
}

// Fetch and parse a specific writeup markdown file
export const fetchWriteup = async (platform: string, slug: string): Promise<WriteupContent | null> => {
  const doc = await fetchMarkdownDoc(`/writeups/${platform}/${slug}.md`, slug, 'writeup');
  // platform se aplica al final: la plataforma pedida manda sobre cualquier
  // `platform:` del frontmatter (comportamiento histórico de fetchWriteup).
  return doc ? { ...doc, platform } : null;
};

// Fetch and parse a project markdown file (flat: /projects/<slug>.md)
export const fetchProject = async (slug: string): Promise<ContentDoc | null> => {
  return fetchMarkdownDoc(`/projects/${slug}.md`, slug, 'project');
};

// Fetch and parse a certificate markdown file (flat: /certificates/<slug>.md)
export const fetchCertificate = async (slug: string): Promise<ContentDoc | null> => {
  return fetchMarkdownDoc(`/certificates/${slug}.md`, slug, 'certificate');
};

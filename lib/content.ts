import { parseFrontmatter } from './frontmatter.js';
import { CERTIFICATE_GROUPS, PROJECT_GROUPS, indexEntryProblems } from './content-kinds.js';
import {
  CertificateDoc,
  ContentDoc,
  ContentIndexItem,
  ContentKind,
  Frontmatter,
  GroupStats,
  WriteupIndexItem,
  WriteupContent,
  PlatformStats,
} from '../types';

const INDEX_URL = '/index.json';

// Actionable hint kept verbatim from the old console-only path: without a
// generated index the fix is always to run the generator.
const INDEX_HINT = "Did you run 'node scripts/generate-index.js'?";

// Infrastructure failure while loading the generated content index (missing or
// unreadable public/index.json). Thrown instead of resolving [] so callers can
// tell a broken deployment apart from "this kind legitimately has no entries"
// (R3-index-kind-silent-empty).
export class ContentIndexError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ContentIndexError';
    if (options !== undefined && options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

// Raw fetch of the generated index (every content kind, exactly as generated).
// REJECTS with ContentIndexError when the response is not ok, the body cannot
// be parsed, or the request itself fails — never a silent [].
const fetchRawIndex = async (): Promise<ContentIndexItem[]> => {
  let response: Response;
  try {
    response = await fetch(INDEX_URL);
  } catch (error) {
    throw new ContentIndexError(
      `Failed to fetch content index: ${error instanceof Error ? error.message : String(error)}. ${INDEX_HINT}`,
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new ContentIndexError(`Index not found. ${INDEX_HINT}`);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new ContentIndexError(
      `Failed to parse content index: ${error instanceof Error ? error.message : String(error)}. ${INDEX_HINT}`,
      { cause: error }
    );
  }

  // JSON válido no implica índice válido: si no es array, un cast mentiría y
  // el filtro de abajo revienta con un TypeError sin el hint. Fallamos acá,
  // con el mismo error tipado (R3-001).
  if (!Array.isArray(data)) {
    throw new ContentIndexError(
      `Invalid content index: expected an array, got ${typeof data}. ${INDEX_HINT}`,
      { cause: data }
    );
  }

  // Un array JSON válido tampoco implica entradas válidas: sin validar la forma
  // de cada entry, un index corrupto pasa el cast y degrada en silencio a "no
  // content" (o revienta con un TypeError pelado en getPlatforms sobre
  // item.platform). Fallamos acá nombrando la entrada ofensora y el problema
  // (R3-array-entry-shape-unvalidated). El vocabulario vive en
  // lib/content-kinds.js; acá solo se arma el error con el hint accionable.
  data.forEach((entry, index) => {
    const problems = indexEntryProblems(entry);
    if (problems.length > 0) {
      throw new ContentIndexError(
        `Invalid content index entry ${index}: ${problems.join('; ')}. ${INDEX_HINT}`,
        { cause: entry }
      );
    }
  });

  return data as ContentIndexItem[];
};

// Raw accessor: every index entry of one content kind, in index order.
// Rejects with ContentIndexError on infrastructure failure (R3-index-kind-silent-empty).
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

// All project entries (flat kind: /projects/<slug>.md, no platform level),
// optionally filtered to exactly one project group.
//
// Fail-loud: a `group` outside PROJECT_GROUPS rejects with an Error naming the
// offending value and every valid option (same wording family as
// assertValidGroup), so a caller typo never looks like "this group is empty".
// Passing undefined / omitting the argument is not a group: it returns all
// projects (R3-unknown-group-silent-empty).
export const getProjects = async (group?: string): Promise<ContentIndexItem[]> => {
  if (group !== undefined && !PROJECT_GROUPS.includes(group)) {
    const listed = PROJECT_GROUPS.map((entry) => JSON.stringify(entry)).join(', ');
    throw new Error(
      `Invalid project group: expected one of ${listed}, got ${JSON.stringify(group)}.`
    );
  }
  const projects = await fetchIndexByKind('project');
  return group === undefined ? projects : projects.filter((item) => item.group === group);
};

// Group stats of one content kind, in the kind's canonical group order and
// INCLUDING groups with count 0: the frontend renders one stable section per
// canonical group regardless of which groups currently hold content.
const groupStats = async (
  kind: ContentKind,
  canonicalGroups: readonly string[]
): Promise<GroupStats[]> => {
  const items = await fetchIndexByKind(kind);
  return canonicalGroups.map((id) => ({
    id,
    count: items.filter((item) => item.group === id).length,
  }));
};

// All project groups in PROJECT_GROUPS canonical order, with counts.
export const getProjectGroups = async (): Promise<GroupStats[]> =>
  groupStats('project', PROJECT_GROUPS);

// All certificate groups in CERTIFICATE_GROUPS canonical order, with counts.
export const getCertificateGroups = async (): Promise<GroupStats[]> =>
  groupStats('certificate', CERTIFICATE_GROUPS);

// Canonical certificate ordering (R3-order-fallback-unproved): real integer
// orders ascending; an entry with no `order` sorts after every ordered entry;
// ties keep input order. The no-order fallback is UNREACHABLE for validated
// indexes — the entry-shape validator requires `order` on certificates — kept
// as defense and pinned directly on this helper by its tests.
export const sortCertificatesByOrder = (certificates: ContentIndexItem[]): ContentIndexItem[] =>
  [...certificates].sort((a, b) => {
    if (a.order === undefined) return b.order === undefined ? 0 : 1;
    if (b.order === undefined) return -1;
    return a.order - b.order;
  });

// All certificate entries, sorted ascending by `order` (the display order).
export const getCertificates = async (): Promise<ContentIndexItem[]> =>
  sortCertificatesByOrder(await fetchIndexByKind('certificate'));

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
// shared implementation (lib/frontmatter.js) and guarantee `slug`, `content` and
// `title` on every path. Used by fetchWriteup, fetchProject and fetchCertificate
// so the three fetchers cannot drift apart.
//
// Date policy deliberately lives in the fetchers, not here (R3-cert-date-fabricated):
// `date` is REQUIRED for writeups and projects, so those fetchers keep the
// today fallback (unreachable for validated content, pinned by tests); it is
// OPTIONAL for certificates, so fetchCertificate must never invent one.
//
// The title -> slug fallback STAYS for every kind, certificates included:
// `title` is required for all three kinds, so the fallback is unreachable for
// validated content and cannot fabricate user-supplied metadata the way a date
// could. It keeps the shared loader uniform and `title: string` honest (a value
// derived from the user-supplied slug always exists).
async function fetchMarkdownDoc(
  filePath: string,
  slug: string,
  label: string
): Promise<CertificateDoc | null> {
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
      // `title` is required for every kind: falling back to the slug can never
      // fabricate metadata on validated content (see the note above).
      title: data.title ?? slug,
      // `date` is NOT set here: present frontmatter dates arrive via ...data;
      // absent ones stay absent and the dated fetchers apply their fallback.
    };

  } catch (error) {
    console.error(`Error fetching ${label} ${filePath}:`, error);
    return null;
  }
}

// Today's date (UTC, YYYY-MM-DD): the documented fallback for the `date` field
// the writeup/project kinds require and validated content always supplies.
const today = (): string => new Date().toISOString().split('T')[0];

// Fetch and parse a specific writeup markdown file
export const fetchWriteup = async (platform: string, slug: string): Promise<WriteupContent | null> => {
  const doc = await fetchMarkdownDoc(`/writeups/${platform}/${slug}.md`, slug, 'writeup');
  // platform se aplica al final: la plataforma pedida manda sobre cualquier
  // `platform:` del frontmatter (comportamiento histórico de fetchWriteup).
  // date es obligatorio para writeups: se completa con hoy si el frontmatter no
  // lo trae (fallback histórico, sin cambios).
  return doc ? { ...doc, date: doc.date ?? today(), platform } : null;
};

// Fetch and parse a project markdown file (flat: /projects/<slug>.md)
export const fetchProject = async (slug: string): Promise<ContentDoc | null> => {
  const doc = await fetchMarkdownDoc(`/projects/${slug}.md`, slug, 'project');
  // date es obligatorio para projects: mismo fallback de hoy que fetchWriteup.
  return doc ? { ...doc, date: doc.date ?? today() } : null;
};

// Fetch and parse a certificate markdown file (flat: /certificates/<slug>.md).
// Certificates do not require `date`: this NEVER fabricates one — a certificate
// without a date in its frontmatter is returned without a date (R3-cert-date-fabricated).
export const fetchCertificate = async (slug: string): Promise<CertificateDoc | null> => {
  return fetchMarkdownDoc(`/certificates/${slug}.md`, slug, 'certificate');
};

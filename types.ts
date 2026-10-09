export type ContentKind = 'writeup' | 'project' | 'certificate';

// Writeup link sections (writeup-links): structural mirrors of the validated
// frontmatter contract — assertValidWriteupLinks (lib/content-kinds.js) is the
// single source of truth and the pipeline never imports UI types (src/).

/**
 * One `machineLinks` entry: required non-empty `title` and `url`, optional
 * `badge` and `type` in the closed platform | download | ip | cve vocabulary —
 * exactly what assertValidWriteupLinks enforces.
 */
export interface MachineLinkFm {
  title: string;
  url: string;
  badge?: string;
  type?: 'platform' | 'download' | 'ip' | 'cve';
}

/**
 * One `toolLinks` entry: required non-empty `name` and `url`, optional string
 * `description`, boolean `developedByAuthor`, string-or-number `githubStars`
 * and string `badge` — exactly what assertValidWriteupLinks enforces.
 */
export interface ToolLinkFm {
  name: string;
  url: string;
  description?: string;
  developedByAuthor?: boolean;
  githubStars?: string | number;
  badge?: string;
}

export interface Frontmatter {
  title: string;
  date: string;
  draft?: boolean;
  description?: string;
  categories?: string[];
  tags?: string[];
  group?: string; // Projects/certificates: one classifier of the kind's closed group list
  cve?: string; // CVE identifier, moved out of tags into its own key
  image?: string;
  githubUrl?: string; // Projects: optional repository URL, feeds the detail GITHUB REPO link
  level?: 'Easy' | 'Medium' | 'Hard';
  platform?: string; // Often inferred from folder, but can be explicit
  // Writeup sidebar link sections, human-authored and round-trip verbatim
  // through the index. Validated fail-loud by assertValidWriteupLinks; absent
  // keys mean "no links" and nothing is ever auto-populated.
  machineLinks?: MachineLinkFm[]; // [{title*, url*, badge?, type?}]
  toolLinks?: ToolLinkFm[]; // [{name*, url*, description?, developedByAuthor?, githubStars?, badge?}]
}

// One entry of public/index.json, for any content kind. `kind` is required on
// every entry (the generator forces it, frontmatter cannot override it).
// Kind-specific keys stay optional: `platform` only exists on writeups (the only
// platformed kind), `order` only on certificates, which may also omit `date`.
export interface ContentIndexItem extends Partial<Frontmatter> {
  kind: ContentKind;
  slug: string;
  path: string; // Site path to the .md file
  title: string;
  order?: number; // Certificates only: real integer, unique across certificates
}

// Writeup entries: the generator guarantees title, date and platform.
export interface WriteupIndexItem extends ContentIndexItem {
  date: string;
  platform: string;
}

export interface WriteupContent extends Frontmatter {
  slug: string;
  content: string; // The raw markdown body
}

// A parsed markdown document whose `date` is guaranteed (fetchWriteup /
// fetchProject): `date` is REQUIRED for those kinds, so their fetchers keep the
// today fallback and the required `date` here is honest.
export interface ContentDoc extends Frontmatter {
  slug: string;
  content: string; // The raw markdown body
  order?: number; // Certificates only
}

// A parsed certificate document (fetchCertificate). Certificates do NOT require
// `date`, and the fetcher must never invent one, so `date` is honestly optional
// here: when the frontmatter omits it, the document carries no date at all and
// the UI renders nothing (R3-cert-date-fabricated).
export interface CertificateDoc extends Omit<ContentDoc, 'date'> {
  date?: string;
}

export interface PlatformStats {
  id: string;
  name: string;
  count: number;
}

// One canonical group of a content kind with its entry count. Groups come in
// the kind's canonical order and include the empty ones (count 0), so the
// frontend can render stable sections.
export interface GroupStats {
  id: string;
  count: number;
}

export interface Section {
  id: string;
  title: string;
}

export interface WriteupSummary {
  title: string;
  platform: string;
  hash: string;
  date: string;
  tags: string[];
  icon: string;
}
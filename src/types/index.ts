export interface MachineLink {
  title: string;
  url: string;
  badge?: string;
  type?: 'platform' | 'download' | 'ip' | 'cve';
}

export interface ToolLink {
  name: string;
  url: string;
  description: string;
  category?: 'CUSTOM_TOOL' | 'EXPLOIT' | 'RECON' | 'WORDLIST' | 'REFERENCE';
  developedByAuthor?: boolean;
  githubStars?: string;
  badge?: string;
}

export interface Writeup {
  id: string;
  title: string;
  // Real pipeline fields (public/index.json frontmatter via toUiWriteup):
  // present only when the source really supplies them.
  platformId?: string;
  tags?: string[];
  // Real pipeline cover image (frontmatter `image`), when one exists.
  image?: string;
  summary?: string;
  releaseDate?: string;
  // Real pipeline markdown body (doc.content), attached by the detail route.
  // Optional: when absent the detail page renders an empty body — it NEVER
  // falls back to template content. All template-only fields below have NO
  // source in the real content pipeline, so they are optional too:
  // pipeline-backed writeups leave them absent and the UI hides their
  // chips/labels (the detail page renders only fields that exist).
  markdownContent?: string;
  iconType: 'wave' | 'bug' | 'network' | 'server' | 'database';
  // Template-only fields (no pipeline source — never invented for real data).
  os?: 'LINUX' | 'WINDOWS';
  ports?: string;
  difficulty?: 'FÁCIL' | 'MEDIO' | 'DIFÍCIL' | 'INSANE';
  vulnerabilities?: string[];
  ipAddress?: string;
  points?: number;
  author?: string;
  readTime?: string;
  machineLinks?: MachineLink[];
  toolLinks?: ToolLink[];
  steps?: {
    phase: string;
    description: string;
    command?: string;
    output?: string;
  }[];
  userFlag?: string;
  rootFlag?: string;
}

export interface Platform {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  lastDeploy: string;
  icon: 'share' | 'cube' | 'flame' | 'docker' | 'hard-drive' | 'shield';
  status?: string;
  color?: string;
}

export interface ProjectLink {
  title: string;
  url: string;
  badge?: string;
  type?: 'github' | 'demo' | 'docs' | 'crates' | 'pypi';
}

export interface RichProjectData {
  markdown: string;
  projectLinks: ProjectLink[];
  toolLinks: ToolLink[];
  technicalSpecs?: {
    language: string;
    license: string;
    architecture: string;
    buildStatus: string;
    requirements: string;
  };
}

export interface Project {
  id: string;
  // Template-only fields below have NO source in the real content pipeline:
  // they are optional so pipeline-backed projects can render without invented
  // data (stars, versions, badges...) and the UI hides their chips/labels.
  number?: string;
  title: string;
  tagCategory?: 'HERRAMIENTA' | 'SCRIPT' | 'AUTOMATIZACIÓN' | 'EXPLOIT';
  version?: string;
  isNew?: boolean;
  statusBadge?: string;
  subBadge?: string;
  iconType: 'scan' | 'kernel' | 'gear' | 'shield' | 'code';
  description?: string;
  tags?: string[];
  stars?: number;
  forks?: number;
  releaseVersion?: string;
  // Real pipeline fields (frontmatter), present when the source supplies them.
  image?: string;
  date?: string;
  githubUrl?: string;
  readme?: string;
  codeSnippet?: string;
  projectLinks?: ProjectLink[];
  toolLinks?: ToolLink[];
}

/**
 * The project the detail page is built from: the pipeline `Project`
 * (toUiProject mapping) plus its REAL raw `group`, exactly as
 * ProjectDetailRoute assembles it (entry.group and doc.content ride along).
 *
 * `group` is the raw pipeline classifier — a free string (root types.ts
 * Frontmatter.group), because matching against the kind's documented
 * vocabulary (lib/projectsModel.ts PROJECT_GROUP_LABELS) is case-insensitive
 * and unknown groups must stay visible-but-unlabeled, never relabeled. It is
 * deliberately NOT on `Project`: lib/projectsModel.ts narrows `group` to the
 * canonical `ProjectGroup` union in `ProjectsViewProject extends Project`, and
 * widening the shared `Project` with a free string breaks that contract.
 */
export interface ProjectViewSource extends Project {
  group?: string;
}

export interface Certification {
  id: string;
  // Derived display position ('#01', '#02', ...) from the real loaded order
  // (toUiCertification's documented contract) — ordering data, not invented.
  number: string;
  title: string;
  // Display label derived from the REAL pipeline `group` (certificationsModel).
  // Absent when the group is missing or non-canonical — never an invented
  // category. The legacy template values below stay in the union only for the
  // old mock data; the pipeline never produces them.
  category?: 'UNIVERSIDAD' | 'HACK4U' | 'CISCO' | 'UDEMY' | 'OFFSEC';
  // Real pipeline fields (frontmatter), present only when the source supplies
  // them — never filled with placeholders.
  description?: string;
  tags?: string[];
  date?: string;
  // Template-only fields (no pipeline source — never invented for real data):
  // optional so pipeline-backed certificates render without fake metadata and
  // the UI hides their chips/labels.
  version?: string;
  statusBadge?: string;
  subBadge?: string;
  iconType?: 'grad-cap' | 'code' | 'shield';
  statValue?: string;
  year?: string;
  issueDate?: string;
  issuer?: string;
  badgeId?: string;
  pdfUrl?: string;
  verificationUrl?: string;
  status?: 'VERIFIED' | 'ACTIVE' | 'PENDING';
  isPending?: boolean;
  skills?: string[];
}

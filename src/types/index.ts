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
  platformId?: string;
  // Template-only fields below have NO source in the real content pipeline
  // (public/index.json / lib/content.ts), so they are optional: pipeline-backed
  // writeups leave them absent and the UI hides their chips/labels.
  os?: 'LINUX' | 'WINDOWS';
  ports?: string;
  difficulty?: 'FÁCIL' | 'MEDIO' | 'DIFÍCIL' | 'INSANE';
  vulnerabilities?: string[];
  tags?: string[];
  // Real pipeline cover image (frontmatter `image`), when one exists.
  image?: string;
  iconType: 'wave' | 'bug' | 'network' | 'server' | 'database';
  ipAddress?: string;
  points?: number;
  releaseDate?: string;
  author?: string;
  readTime?: string;
  summary?: string;
  markdownContent?: string;
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

export interface Certification {
  id: string;
  number: string;
  title: string;
  category: 'UNIVERSIDAD' | 'HACK4U' | 'UDEMY' | 'OFFSEC';
  version: string;
  statusBadge: string;
  subBadge: string;
  iconType: 'grad-cap' | 'code' | 'shield';
  description: string;
  tags: string[];
  statValue: string;
  year: string;
  issueDate?: string;
  issuer: string;
  badgeId?: string;
  pdfUrl?: string;
  verificationUrl?: string;
  status: 'VERIFIED' | 'ACTIVE' | 'PENDING';
  isPending?: boolean;
  skills?: string[];
  date?: string;
}

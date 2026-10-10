// Detail route elements for /writeups/:platformId/:slug and /projects/:slug.
//
// Data contract (per task): entries are resolved ONLY from the real content
// pipeline — public/index.json via lib/content.ts (fetchIndex, fetchWriteup,
// fetchProject, getProjects) — and mapped with the pure adapters in
// src/lib/contentAdapter.ts. Nothing is fabricated: fields the pipeline does
// not supply stay absent.
//
// Writeup detail (real markdown):
// WriteupPage renders the REAL markdown body (writeup.markdownContent = the
// pipeline doc.content) through the pure view-model builder in
// src/lib/writeupView.ts. Every writeup that resolves from the pipeline gets
// the full detail page — there is no template-content gate and no curated
// template source anymore: the sidebar links come from the writeup's own
// frontmatter alone (wave's curated links were migrated there verbatim).
//
// Project detail (real readme, mirrors the writeup port):
// ProjectPage renders the REAL markdown body (project.readme = the pipeline
// doc.content) through the pure view-model builder in src/lib/projectView.ts.
// Every project that resolves from the pipeline gets the full detail page —
// there is no template-content gate anymore. The template content map
// (SAMPLE_PROJECTS_CONTENT) is only consulted by hasTemplateProjectContent to
// report whether curated template content EXISTS for a slug; it is never a
// rendering source. Loading, missing and error states are always honest, and a
// render error boundary converts any residual render crash into an honest
// visible state instead of crashing the app.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchIndex, fetchProject, fetchWriteup, getProjects } from '../../lib/content';
import { toUiProject, toUiWriteup } from './contentAdapter';
import { ProjectPage } from '../components/ProjectPage';
import { WriteupPage } from '../components/WriteupPage';
import { SAMPLE_PROJECTS_CONTENT } from '../data/projectContents';
import type { Project, ProjectViewSource, Writeup } from '../types';
import type { ContentDoc, ContentIndexItem, WriteupContent, WriteupIndexItem } from '../../types';
import { projectDetailPath, writeupDetailPath } from './paths';

// ---------------------------------------------------------------------------
// Real pipeline resolution
// ---------------------------------------------------------------------------

export interface ResolvedWriteupDetail {
  entry: WriteupIndexItem;
  doc: WriteupContent;
}

export interface ResolvedProjectDetail {
  entry: ContentIndexItem;
  doc: ContentDoc;
  /** 1-based display position inside the real project listing (ordering data
   * the caller really has — same contract as toUiProject). */
  position: number;
}

// Resolve a writeup detail route from the real pipeline: the index entry (the
// authority on existence) plus the real markdown document. Resolves null when
// either side is missing (honest not-found); rejects on infrastructure
// failure (ContentIndexError from the index) so callers can show an honest
// error state instead of "not found".
export const resolveWriteupDetail = async (
  platformId: string,
  slug: string
): Promise<ResolvedWriteupDetail | null> => {
  const [index, doc] = await Promise.all([fetchIndex(), fetchWriteup(platformId, slug)]);
  const entry = index.find(
    (item) => item.platform.toLowerCase() === platformId.toLowerCase() && item.slug === slug
  );
  if (!entry || !doc) return null;
  return { entry, doc };
};

// Resolve a project detail route from the real pipeline (flat kind:
// /projects/<slug>). Resolves null when the entry or the document is missing.
export const resolveProjectDetail = async (slug: string): Promise<ResolvedProjectDetail | null> => {
  const [projects, doc] = await Promise.all([getProjects(), fetchProject(slug)]);
  const index = projects.findIndex((item) => item.slug === slug);
  if (index === -1 || !doc) return null;
  return { entry: projects[index], doc, position: index + 1 };
};

// ---------------------------------------------------------------------------
// Curated-template availability report (projects)
// ---------------------------------------------------------------------------

// True when the project template content map holds CURATED content for the
// slug (lookup key: id only, mirroring getProjectContent). Availability report
// only — the detail routes never gate rendering on it and the template content
// is never the source of a rendered body (see the file header). Writeup-side
// there is no template source anymore: links come from the writeup's own
// frontmatter alone.
export const hasTemplateProjectContent = (slug: string): boolean =>
  SAMPLE_PROJECTS_CONTENT[slug] !== undefined;

// ---------------------------------------------------------------------------
// Honest async states (same aesthetic as the Home loading/error panels)
// ---------------------------------------------------------------------------

const StatePanel: React.FC<{ children: React.ReactNode; tone?: 'default' | 'error' | 'pending' }> = ({
  children,
  tone = 'default',
}) => {
  const toneClass =
    tone === 'error'
      ? 'border-[#f07178]/30 bg-[#f07178]/5'
      : tone === 'pending'
      ? 'border-[#e6b450]/30 bg-[#e6b450]/5'
      : 'border-[#1b1f29] bg-[#10141c]';
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12 flex-1">
      <div className={`rounded-lg border px-6 py-10 text-center ${toneClass}`}>{children}</div>
    </div>
  );
};

export const DetailLoading: React.FC<{ requestedPath: string }> = ({ requestedPath }) => (
  <StatePanel>
    <p className="font-mono text-xs text-[#879299]">
      <span className="text-[#39bae6]">&gt;</span> CARGANDO CONTENIDO DESDE EL PIPELINE ...
    </p>
    <p className="mt-2 break-all font-mono text-[11px] text-[#5a6673]">{requestedPath}</p>
  </StatePanel>
);

export const DetailMissing: React.FC<{
  kind: string;
  identifier: string;
  backTo: string;
  backLabel: string;
}> = ({ kind, identifier, backTo, backLabel }) => (
  <StatePanel>
    <p className="font-mono text-sm font-bold tracking-wider text-[#e0e2ec]">
      {kind} NO ENCONTRADO
    </p>
    <p className="mt-2 break-all font-mono text-[11px] text-[#879299]">
      <span className="text-[#f07178]">&gt;</span> {identifier} NO EXISTE EN EL PIPELINE DE
      CONTENIDO (/index.json)
    </p>
    <Link
      to={backTo}
      className="mt-6 inline-flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
    >
      <span>&lt;</span> VOLVER A {backLabel}
    </Link>
  </StatePanel>
);

export const DetailProblem: React.FC<{ message: string; backTo: string; backLabel: string }> = ({
  message,
  backTo,
  backLabel,
}) => (
  <StatePanel tone="error">
    <p className="font-mono text-xs text-[#f07178]">
      <span className="text-[#39bae6]">&gt;</span> ERROR: NO SE PUDO CARGAR EL CONTENIDO
    </p>
    <p className="mt-2 break-words text-[11px] font-mono text-[#879299]">{message}</p>
    <Link
      to={backTo}
      className="mt-6 inline-flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
    >
      <span>&lt;</span> VOLVER A {backLabel}
    </Link>
  </StatePanel>
);

export interface ContenidoPendienteProps {
  kind: 'WRITEUP' | 'PROYECTO';
  requestedPath: string;
  title?: string;
  platformName?: string;
  date?: string;
  tags?: string[];
  summary?: string;
  backTo: string;
  backLabel: string;
}

// Honest fallback for detail entries the template-era viewer cannot render
// with real data yet. Shows the REAL resolved metadata (never invented fields)
// and states plainly that the detail body is pending.
export const ContenidoPendiente: React.FC<ContenidoPendienteProps> = ({
  kind,
  requestedPath,
  title,
  platformName,
  date,
  tags,
  summary,
  backTo,
  backLabel,
}) => (
  <StatePanel tone="pending">
    <p className="font-mono text-sm font-bold tracking-wider text-[#e6b450]">
      CONTENIDO PENDIENTE
    </p>
    <p className="mx-auto mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-[#879299]">
      <span className="text-[#39bae6]">&gt;</span> ESTA RUTA YA RESUELVE ESTE {kind} EN EL
      PIPELINE REAL, PERO EL VISOR DE DETALLE TODAVÍA NO ESTÁ CONECTADO AL MARKDOWN REAL (MUESTRA
      CONTENIDO DE PLANTILLA). HASTA QUE ESO QUEDE CONECTADO SE MUESTRAN ABAJO LOS DATOS REALES
      DISPONIBLES — SIN DATOS INVENTADOS.
    </p>
    <div className="mx-auto mt-6 max-w-2xl space-y-2 text-left">
      {title !== undefined && (
        <p className="font-mono text-xs text-[#bdc8cf]">
          <span className="text-[#5a6673]">TÍTULO:</span> {title}
        </p>
      )}
      {platformName !== undefined && (
        <p className="font-mono text-xs text-[#bdc8cf]">
          <span className="text-[#5a6673]">PLATAFORMA:</span> {platformName}
        </p>
      )}
      {date !== undefined && (
        <p className="font-mono text-xs text-[#bdc8cf]">
          <span className="text-[#5a6673]">FECHA:</span> {date}
        </p>
      )}
      {summary !== undefined && (
        <p className="font-mono text-xs text-[#bdc8cf]">
          <span className="text-[#5a6673]">RESUMEN:</span> {summary}
        </p>
      )}
      {tags !== undefined && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-mono text-[11px] text-[#5a6673]">TAGS:</span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-[#242936] bg-[#141821] px-2.5 py-1 text-[11px] font-mono text-[#879299]"
            >
              {tag.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
      <p className="break-all font-mono text-[11px] text-[#5a6673]">{requestedPath}</p>
    </div>
    <Link
      to={backTo}
      className="mt-6 inline-flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
    >
      <span>&lt;</span> VOLVER A {backLabel}
    </Link>
  </StatePanel>
);

// Converts a residual detail-render crash into an honest visible state
// ("must fail visibly and honestly ... not crash").
class DetailErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Detail viewer failed to render with real pipeline data:', error);
  }

  render(): React.ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Route elements
// ---------------------------------------------------------------------------

export const WriteupDetailRoute: React.FC = () => {
  const { platformId = '', slug = '' } = useParams();
  const navigate = useNavigate();
  const requestedPath = writeupDetailPath(platformId, slug);

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [detail, setDetail] = useState<ResolvedWriteupDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    resolveWriteupDetail(platformId, slug)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved === null) {
          setDetail(null);
          setStatus('missing');
          return;
        }
        setDetail(resolved);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setDetail(null);
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [platformId, slug]);

  if (status === 'loading') return <DetailLoading requestedPath={requestedPath} />;
  if (status === 'error') {
    return <DetailProblem message={errorMessage} backTo="/writeups" backLabel="WRITEUPS" />;
  }
  if (status === 'missing' || detail === null) {
    return (
      <DetailMissing
        kind="WRITEUP"
        identifier={`${platformId}/${slug}`}
        backTo="/writeups"
        backLabel="WRITEUPS"
      />
    );
  }

  // Real mapped data ONLY (toUiWriteup); the real markdown body rides along on
  // markdownContent (detail.doc.content) and is what WriteupPage renders as its
  // body through the pure view-model builder (src/lib/writeupView.ts).
  const writeup: Writeup = {
    ...toUiWriteup(detail.entry),
    markdownContent: detail.doc.content,
  };

  // Any writeup that resolves from the real pipeline renders the full detail
  // page — no template-content gate. A render crash becomes the honest error
  // state below instead of crashing the app.
  return (
    <DetailErrorBoundary
      fallback={
        <DetailProblem
          message="EL VISOR DE DETALLE FALLÓ AL RENDERIZAR ESTE WRITEUP CON LOS DATOS DEL PIPELINE."
          backTo="/writeups"
          backLabel="WRITEUPS"
        />
      }
    >
      <WriteupPage writeup={writeup} onBack={() => navigate('/writeups')} />
    </DetailErrorBoundary>
  );
};

export const ProjectDetailRoute: React.FC = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const requestedPath = projectDetailPath(slug);

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [detail, setDetail] = useState<ResolvedProjectDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    resolveProjectDetail(slug)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved === null) {
          setDetail(null);
          setStatus('missing');
          return;
        }
        setDetail(resolved);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setDetail(null);
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === 'loading') return <DetailLoading requestedPath={requestedPath} />;
  if (status === 'error') {
    return <DetailProblem message={errorMessage} backTo="/projects" backLabel="PROYECTOS" />;
  }
  if (status === 'missing' || detail === null) {
    return (
      <DetailMissing
        kind="PROYECTO"
        identifier={slug}
        backTo="/projects"
        backLabel="PROYECTOS"
      />
    );
  }

  // Real mapped data ONLY (toUiProject); the real group and the real markdown
  // body ride along (detail.entry.group / detail.doc.content) and are what
  // ProjectPage renders through the pure view-model builder
  // (src/lib/projectView.ts). The source type is ProjectViewSource = the
  // pipeline Project + its real raw group (src/types/index.ts).
  const project: ProjectViewSource = {
    ...toUiProject(detail.entry, detail.position),
    ...(detail.entry.group !== undefined ? { group: detail.entry.group } : {}),
    readme: detail.doc.content,
  };

  // Honest fallback kept for the error boundary below (and reusable for
  // missing/error states): shows the REAL resolved metadata, never invented
  // fields.
  const pendingFallback = (
    <ContenidoPendiente
      kind="PROYECTO"
      requestedPath={requestedPath}
      title={detail.entry.title}
      date={detail.entry.date}
      tags={detail.entry.tags}
      summary={detail.entry.description}
      backTo="/projects"
      backLabel="PROYECTOS"
    />
  );

  // Any project that resolves from the real pipeline renders the full detail
  // page — no template-content gate. A render crash becomes the honest
  // CONTENIDO PENDIENTE state below instead of crashing the app.
  return (
    <DetailErrorBoundary fallback={pendingFallback}>
      <ProjectPage project={project} onBack={() => navigate('/projects')} />
    </DetailErrorBoundary>
  );
};

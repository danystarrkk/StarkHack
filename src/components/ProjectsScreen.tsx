// /projects screen — real content pipeline, no mock data.
//
// Data flow: getProjects() (public/index.json project entries via
// lib/content.ts) in a useState/useEffect load with honest loading/error/
// empty states, then the PURE model builder (src/lib/projectsModel.ts)
// derives everything the screen renders: the featured/recientes slice, the
// full archive list, the filter categories and the "MOSTRANDO X DE Y"
// counts.
//
// Filters back REAL pipeline fields only: the category filter is driven by
// the real `group` (herramientas | scripts | automatizaciones) keeping the
// screen's uppercase Spanish labels; search matches real title/description/
// tags. Template-only fields (stars, versions, badges, ...) have no source
// in the pipeline, so their chips/labels are hidden — never placeholders.
import React, { useState, useEffect, useMemo } from 'react';
import { Project } from '../types';
import type { ContentIndexItem } from '../../types';
import { getProjects } from '../../lib/content';
import {
  buildProjectsModel,
  type ProjectFilterId,
  type ProjectGroupLabel,
} from '../lib/projectsModel';
import {
  Search,
  Code2,
  Settings,
  ArrowRight,
  ArrowLeft,
  Shield,
  Terminal,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ProjectsScreenProps {
  onSelectProject: (project: Project) => void;
  onExploreAll?: () => void;
  initialExploreAll?: boolean;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  onSelectProject,
  onExploreAll,
  initialExploreAll = false,
}) => {
  const [isExploringAll, setIsExploringAll] = useState(initialExploreAll);
  const [activeFilter, setActiveFilter] = useState<ProjectFilterId>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Real pipeline loading (same honest states as Home / WriteupsScreen).
  const [entries, setEntries] = useState<ContentIndexItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const projects = await getProjects();
        if (cancelled) return;
        setEntries(projects);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setStatus('error');
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  // Everything the screen renders comes from the pure model builder.
  const model = useMemo(
    () => buildProjectsModel(entries, { category: activeFilter, search: searchQuery }),
    [entries, activeFilter, searchQuery]
  );

  const displayedFeaturedProjects = model.featured;
  const allFilteredProjects = model.archive;

  const renderBannerCenterIcon = (type: Project['iconType']) => {
    switch (type) {
      case 'scan':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#39bae6]/35 bg-[#0d1017] text-[#39bae6] shadow-[0_0_14px_rgba(57,186,230,0.25)]">
            <Search className="h-5 w-5" />
          </div>
        );
      case 'code':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#7edc73]/35 bg-[#0d1017] text-[#7edc73] shadow-[0_0_14px_rgba(126,220,115,0.25)]">
            <span className="font-mono text-sm font-bold tracking-tight">&lt;/&gt;</span>
          </div>
        );
      case 'shield':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#39bae6]/35 bg-[#0d1017] text-[#39bae6] shadow-[0_0_14px_rgba(57,186,230,0.25)]">
            <Shield className="h-5 w-5" />
          </div>
        );
      case 'kernel':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#e6b450]/35 bg-[#0d1017] text-[#e6b450] shadow-[0_0_14px_rgba(230,180,80,0.25)]">
            <Terminal className="h-5 w-5" />
          </div>
        );
      case 'gear':
      default:
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#e6b450]/35 bg-[#0d1017] text-[#e6b450] shadow-[0_0_14px_rgba(230,180,80,0.25)]">
            <Settings className="h-5 w-5" />
          </div>
        );
    }
  };

  const getCategoryBadgeStyle = (category: ProjectGroupLabel) => {
    switch (category) {
      case 'HERRAMIENTA':
        return {
          bg: 'bg-[#93000a]/20',
          border: 'border-[#ffb4ab]/30',
          text: 'text-[#ffb4ab]',
        };
      case 'SCRIPT':
        return {
          bg: 'bg-[#7edc73]/15',
          border: 'border-[#7edc73]/30',
          text: 'text-[#7edc73]',
        };
      case 'AUTOMATIZACIÓN':
      default:
        return {
          bg: 'bg-[#e6b450]/15',
          border: 'border-[#e6b450]/30',
          text: 'text-[#e6b450]',
        };
    }
  };

  return (
    <div className="w-full space-y-7 font-mono">
      {/* Top Telemetry Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#879299]">
          <span className="h-2 w-2 rounded-full bg-[#39bae6] shadow-[0_0_8px_#39bae6]" />
          <span className="tracking-wider">
            // CODE VAULT &amp; OPEN SOURCE // TOOLS &amp; REPOSITORIES
          </span>
        </div>

        <div className="flex flex-col sm:items-end gap-1">
          <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 text-[11px] w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span className="text-[#39bae6] font-semibold">[SYSTEM: SECURE]</span>
            <span className="text-[#5a6673]">&gt; REPO // DB.12</span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-[#7edc73] px-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73]" />
            <span className="text-[#5a6673]">•</span>
            <span className="tracking-wider">PIPELINE: CI/CD PASSED</span>
          </div>
        </div>
      </div>

      {/* Title & Badges Row */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-[#6ad5ff] via-[#95e6cb] to-[#7edc73] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(106,213,255,0.35)]">
            PROJECTS
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-xs text-[#39bae6] font-medium">
              {isExploringAll ? 'ARCHIVOS COMPLETOS' : 'LATEST RELEASES'}
            </div>

            <div className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-xs text-[#39bae6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
              <span>[ STATUS: ACTIVE_DEVELOPMENT ]</span>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-[13px] text-[#879299] max-w-4xl leading-relaxed">
          // Herramientas de auditoría, scripts de automatización de exploits e investigaciones de seguridad defensiva y ofensiva desarrolladas por Stark.
        </p>
      </div>

      {/* Honest loading / error states (same pattern as Home / WriteupsScreen) */}
      {status === 'loading' && (
        <div className="rounded-lg border border-[#1b1f29] bg-[#10141c] px-6 py-10 text-center">
          <p className="font-mono text-xs text-[#879299]">
            <span className="text-[#39bae6]">&gt;</span> CARGANDO CONTENIDO DESDE /index.json ...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-[#f07178]/30 bg-[#f07178]/5 px-6 py-10 text-center">
          <p className="font-mono text-xs text-[#f07178]">
            <span className="text-[#39bae6]">&gt;</span> ERROR: NO SE PUDO CARGAR EL ÍNDICE DE CONTENIDO
          </p>
          <p className="mt-2 break-words text-[11px] font-mono text-[#879299]">{loadError}</p>
        </div>
      )}

      {/* Honest empty state: the real index has no project entries yet. */}
      {status === 'ready' && model.totalCount === 0 && (
        <div className="rounded-xl border border-dashed border-[#242936] bg-[#10141c]/50 p-12 text-center">
          <Terminal className="mx-auto h-8 w-8 text-[#5a6673] mb-3" />
          <h3 className="font-sans text-base font-bold text-white mb-1">
            Aún no hay proyectos publicados
          </h3>
          <p className="text-xs text-[#879299] max-w-md mx-auto">
            El índice de contenido real todavía no contiene proyectos. Cuando se publiquen aparecerán aquí, sin datos simulados.
          </p>
        </div>
      )}

      {/* DYNAMIC VIEW: Featured 3 Projects OR All Projects Explorer */}
      {status === 'ready' && model.totalCount > 0 && (!isExploringAll ? (
        /* 1. VISTA DESTACADOS (3 Proyectos iniciales) */
        <div className="space-y-7">
          {/* Filter Row matching screenshot */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-[#1b1f29]/80 py-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#5a6673] font-mono text-[11px] mr-1">• FILTRO:</span>

              {/* Button: TODOS */}
              <button
                onClick={() => setActiveFilter('TODOS')}
                className={`flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition-all ${
                  activeFilter === 'TODOS'
                    ? 'bg-[#39bae6] text-[#0b0e15] shadow-[0_0_12px_rgba(57,186,230,0.4)]'
                    : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    activeFilter === 'TODOS' ? 'bg-[#0b0e15]' : 'bg-[#39bae6] shadow-[0_0_6px_#39bae6]'
                  }`}
                />
                <span>TODOS</span>
              </button>

              {/* Button: HERRAMIENTAS */}
              <button
                onClick={() => setActiveFilter('HERRAMIENTAS')}
                className={`flex items-center gap-2 rounded px-3 py-1 text-xs transition-all ${
                  activeFilter === 'HERRAMIENTAS'
                    ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40 shadow-[0_0_10px_rgba(255,180,171,0.25)]'
                    : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#ffb4ab] shadow-[0_0_6px_#ffb4ab]" />
                <span>HERRAMIENTAS</span>
              </button>

              {/* Button: SCRIPTS */}
              <button
                onClick={() => setActiveFilter('SCRIPTS')}
                className={`flex items-center gap-2 rounded px-3 py-1 text-xs transition-all ${
                  activeFilter === 'SCRIPTS'
                    ? 'bg-[#7edc73]/20 text-[#7edc73] border border-[#7edc73]/40 shadow-[0_0_10px_rgba(126,220,115,0.25)]'
                    : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
                <span>SCRIPTS</span>
              </button>

              {/* Button: AUTOMATIZACIÓN */}
              <button
                onClick={() => setActiveFilter('AUTOMATIZACIÓN')}
                className={`flex items-center gap-2 rounded px-3 py-1 text-xs transition-all ${
                  activeFilter === 'AUTOMATIZACIÓN'
                    ? 'bg-[#e6b450]/20 text-[#e6b450] border border-[#e6b450]/40 shadow-[0_0_10px_rgba(230,180,80,0.25)]'
                    : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[#e6b450] shadow-[0_0_6px_#e6b450]" />
                <span>AUTOMATIZACIÓN</span>
              </button>
            </div>

            {/* Right count: MOSTRANDO: X RECIENTES // Y TOTALES */}
            <div className="text-[11px] text-[#5a6673] font-mono tracking-wider">
              MOSTRANDO: <span className="text-[#bdc8cf] font-semibold">{model.featuredCount} RECIENTES</span> // {model.totalCount} TOTALES
            </div>
          </div>

          {/* Grid of Featured Project Cards */}
          {displayedFeaturedProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#242936] bg-[#10141c]/50 p-12 text-center">
              <Terminal className="mx-auto h-8 w-8 text-[#5a6673] mb-3" />
              <h3 className="font-sans text-base font-bold text-white mb-1">
                No hay repositorios en esta categoría
              </h3>
              <p className="text-xs text-[#879299] max-w-md mx-auto">
                Ningún proyecto real del índice de contenido pertenece a esta categoría todavía.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayedFeaturedProjects.map((project) => {
              const catStyle = getCategoryBadgeStyle(project.groupLabel);
              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 sm:p-5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
                >
                  {/* Header inside card: Category pill group + status */}
                  <div className="mb-3 flex items-center justify-between font-mono text-[11px]">
                    {project.groupLabel && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded border ${catStyle.border} ${catStyle.bg} px-2 py-0.5 text-[10px] font-medium ${catStyle.text}`}
                        >
                          {project.groupLabel}
                        </span>
                      </div>
                    )}

                    {project.statusBadge && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#7edc73] font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
                        <span>• {project.statusBadge.replace('• • ', '')}</span>
                      </div>
                    )}
                  </div>

                  {/* Dotted Blueprint Grid Banner */}
                  <div className="relative mb-4 flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded border border-[#1b1f29] bg-[#0d1017] bg-grid-dots">
                    <div className="transition-transform duration-300 group-hover:scale-105">
                      {renderBannerCenterIcon(project.iconType)}
                    </div>

                    {project.subBadge && (
                      <span className="mt-2.5 text-[10px] font-mono tracking-wider text-[#5a6673] group-hover:text-[#879299] transition-colors">
                        {project.subBadge}
                      </span>
                    )}
                  </div>

                  {/* Title & Index #01 */}
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-sans text-xl font-bold tracking-tight text-white group-hover:text-[#6ad5ff] transition-colors">
                      {project.title}
                    </h3>
                    <span className="font-mono text-xs text-[#5a6673]">{project.number}</span>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="mb-4 text-xs font-mono leading-relaxed text-[#879299] line-clamp-3">
                      {project.description}
                    </p>
                  )}

                  {/* Tags with two dots matching screenshot: • • Tag */}
                  {project.tags && (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {project.tags.map((tag, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                        >
                          <span className="text-[#39bae6]">• •</span>
                          <span>{tag}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Button: LEER REPO full width */}
                  <button
                    onClick={() => onSelectProject(project)}
                    className="group/btn mt-auto flex w-full items-center justify-center gap-2 rounded border border-[#242936] bg-[#0d1017] py-2 text-xs font-mono font-semibold text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.25)]"
                  >
                    <span>LEER REPO</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#39bae6] transition-transform group-hover/btn:translate-x-1" />
                  </button>
                </div>
              );
            })}
          </div>
          )}

          {/* Bottom CTA Button: Triggers All Projects in-page deployment */}
          <div className="flex flex-col items-center justify-center pt-5 pb-2 text-center">
            <button
              onClick={() => {
                setIsExploringAll(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (onExploreAll) onExploreAll();
              }}
              className="group inline-flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-6 py-2.5 font-mono text-xs font-semibold tracking-wider text-[#39bae6] transition-all hover:border-[#39bae6] hover:bg-[#141821] hover:text-[#6ad5ff] hover:shadow-[0_0_16px_rgba(57,186,230,0.25)] active:translate-y-[1px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
              <span className="text-[#39bae6]">•</span>
              <span>EXPLORAR TODOS LOS REPOSITORIOS [ -&gt; ]</span>
            </button>

            <p className="mt-2.5 text-[11px] font-mono text-[#5a6673]">
              • MOSTRANDO {model.featuredCount} DE {model.totalCount} REPOSITORIOS // ARCHIVO PÚBLICO •
            </p>
          </div>
        </div>
      ) : (
        /* 2. VISTA EXPLORAR TODOS LOS REPOSITORIOS (Desplegado idéntico a entrar a una plataforma en writeups) */
        <div className="space-y-6 pt-2">
          {/* Breadcrumb & Return Action - Exact pattern from WriteupsScreen */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1b1f29] pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsExploringAll(false);
                  setSearchQuery('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1.5 text-xs text-[#879299] hover:border-[#39bae6] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>VOLVER A DESTACADOS</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-[#5a6673]">
                <span>/</span>
                <span className="text-[#39bae6] font-semibold">TODOS LOS REPOSITORIOS</span>
                <span>//</span>
                <span className="text-[#bdc8cf]">{model.archiveCount} DE {model.totalCount} PROYECTOS</span>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-[#5a6673] mr-1">• CATEGORÍA:</span>
              {model.filterCategories.map(({ id: cat }) => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeFilter === cat
                      ? 'bg-[#39bae6] text-[#0b0e15] shadow-[0_0_10px_rgba(57,186,230,0.4)]'
                      : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Search Bar inside All Projects View */}
          <div className="relative">
            <div className="group relative flex items-center overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] transition-all focus-within:border-[#39bae6] focus-within:shadow-[0_0_16px_rgba(57,186,230,0.2)]">
              <div className="flex items-center pl-4 pr-2 text-[#5a6673]">
                <Search className="h-4 w-4 text-[#5a6673] group-focus-within:text-[#39bae6]" />
              </div>

              <input
                type="text"
                placeholder="Buscar repositorios por nombre, etiquetas, lenguaje, categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-3 pr-20 text-xs sm:text-sm text-[#e0e2ec] placeholder-[#5a6673] focus:outline-none"
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-4 text-xs font-semibold text-[#5a6673] hover:text-[#ffb4ab] transition-colors"
                >
                  LIMPIAR
                </button>
              )}
            </div>
          </div>

          {/* All Projects Grid - every matching project rendered with cards */}
          {allFilteredProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#242936] bg-[#10141c]/50 p-12 text-center">
              <Terminal className="mx-auto h-8 w-8 text-[#5a6673] mb-3" />
              <h3 className="font-sans text-base font-bold text-white mb-1">
                No se encontraron repositorios
              </h3>
              <p className="text-xs text-[#879299] max-w-md mx-auto mb-4">
                No hay coincidencias para el filtro o término de búsqueda especificado.
              </p>
              <button
                onClick={() => {
                  setActiveFilter('TODOS');
                  setSearchQuery('');
                }}
                className="rounded border border-[#39bae6]/40 bg-[#39bae6]/10 px-4 py-2 text-xs text-[#39bae6] hover:bg-[#39bae6]/20 transition-colors"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {allFilteredProjects.map((project) => {
                const catStyle = getCategoryBadgeStyle(project.groupLabel);
                return (
                  <div
                    key={project.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 sm:p-5 transition-all duration-300 hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
                  >
                    {/* Header inside card: Category pill group + status */}
                    <div className="mb-3 flex items-center justify-between font-mono text-[11px]">
                      {project.groupLabel && (
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded border ${catStyle.border} ${catStyle.bg} px-2 py-0.5 text-[10px] font-medium ${catStyle.text}`}
                          >
                            {project.groupLabel}
                          </span>
                        </div>
                      )}

                      {project.statusBadge && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#7edc73] font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
                          <span>• {project.statusBadge.replace('• • ', '')}</span>
                        </div>
                      )}
                    </div>

                    {/* Dotted Blueprint Grid Banner */}
                    <div className="relative mb-4 flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded border border-[#1b1f29] bg-[#0d1017] bg-grid-dots">
                      <div className="transition-transform duration-300 group-hover:scale-105">
                        {renderBannerCenterIcon(project.iconType)}
                      </div>

                      {project.subBadge && (
                        <span className="mt-2.5 text-[10px] font-mono tracking-wider text-[#5a6673] group-hover:text-[#879299] transition-colors">
                          {project.subBadge}
                        </span>
                      )}
                    </div>

                    {/* Title & Index #01 */}
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="font-sans text-xl font-bold tracking-tight text-white group-hover:text-[#6ad5ff] transition-colors">
                        {project.title}
                      </h3>
                      <span className="font-mono text-xs text-[#5a6673]">{project.number}</span>
                    </div>

                    {/* Description */}
                    {project.description && (
                      <p className="mb-4 text-xs font-mono leading-relaxed text-[#879299] line-clamp-3">
                        {project.description}
                      </p>
                    )}

                    {/* Tags with two dots matching screenshot: • • Tag */}
                    {project.tags && (
                      <div className="mb-5 flex flex-wrap gap-2">
                        {project.tags.map((tag, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                          >
                            <span className="text-[#39bae6]">• •</span>
                            <span>{tag}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Button: LEER REPO full width */}
                    <button
                      onClick={() => onSelectProject(project)}
                      className="group/btn mt-auto flex w-full items-center justify-center gap-2 rounded border border-[#242936] bg-[#0d1017] py-2 text-xs font-mono font-semibold text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.25)]"
                    >
                      <span>LEER REPO</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#39bae6] transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

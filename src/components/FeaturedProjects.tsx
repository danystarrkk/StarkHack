import React from 'react';
import { Project } from '../types';
import { Search, Terminal, Settings, ArrowRight } from 'lucide-react';

interface FeaturedProjectsProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onExploreAll: () => void;
}

export const FeaturedProjects: React.FC<FeaturedProjectsProps> = ({
  projects,
  onSelectProject,
  onExploreAll,
}) => {
  const renderBannerIcon = (type: Project['iconType']) => {
    switch (type) {
      case 'scan':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-[#39bae6]/30 bg-[#0d1017] text-[#39bae6] shadow-[0_0_12px_rgba(57,186,230,0.2)]">
            <Search className="h-5 w-5" />
          </div>
        );
      case 'kernel':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-[#e6b450]/30 bg-[#0d1017] text-[#e6b450] shadow-[0_0_12px_rgba(230,180,80,0.2)]">
            <Terminal className="h-5 w-5" />
          </div>
        );
      case 'gear':
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-[#39bae6]/30 bg-[#0d1017] text-[#39bae6] shadow-[0_0_12px_rgba(57,186,230,0.2)]">
            <Settings className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <section id="projects" className="w-full space-y-6 pt-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b1f29] pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-[#39bae6]">//</span>
          <h2 className="font-mono text-base font-bold uppercase tracking-wider text-[#e0e2ec]">
            FEATURED PROJECTS
          </h2>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-[11px] font-mono text-[#879299]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
          <span>INDEX: 03 REPOSITORIOS</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
          >
            {/* Top metadata strip */}
            <div className="mb-2 flex items-center justify-between font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="rounded border border-[#e6b450]/30 bg-[#e6b450]/10 px-2 py-0.5 text-[10px] font-medium text-[#e6b450]">
                  {p.tagCategory}
                </span>
              </div>

              {p.isNew && (
                <div className="flex items-center gap-1.5 rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 text-[10px] text-[#39bae6]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
                  <span>NEW</span>
                </div>
              )}
            </div>

            {/* Dotted Blueprint Grid Banner */}
            <div className="relative mb-4 flex h-28 w-full flex-col items-center justify-center overflow-hidden rounded border border-[#1b1f29] bg-[#0d1017] bg-grid-dots">
              <div className="transition-transform duration-300 group-hover:scale-105">
                {renderBannerIcon(p.iconType)}
              </div>
              <span className="mt-2 text-[10px] font-mono tracking-wider text-[#5a6673] group-hover:text-[#879299] transition-colors">
                {p.subBadge}
              </span>
            </div>

            {/* Title & Index */}
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[#e0e2ec] group-hover:text-white transition-colors">
                {p.title}
              </h3>
              <span className="font-mono text-xs text-[#5a6673]">{p.number}</span>
            </div>

            {/* Description */}
            <p className="mb-4 text-xs font-mono leading-relaxed text-[#879299] line-clamp-3">
              {p.description}
            </p>

            {/* Language / Tech Tags */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {p.tags.map((tag, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 rounded border border-[#1b1f29] bg-[#0d1017]/80 px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  <span className="text-[#39bae6]">•</span>
                  <span>{tag}</span>
                </div>
              ))}
            </div>

            {/* Action Button: LEER REPO */}
            <button
              onClick={() => onSelectProject(p)}
              className="group/btn mt-auto flex w-full items-center justify-center gap-2 rounded border border-[#242936] bg-[#0d1017] py-2 text-xs font-mono font-semibold text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.2)]"
            >
              <span>LEER REPO</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#39bae6] transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Exploration CTA */}
      <div className="flex flex-col items-center justify-center pt-3 pb-2 text-center">
        <button
          onClick={onExploreAll}
          className="group inline-flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-6 py-2.5 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#141821] hover:text-[#39bae6] hover:shadow-[0_0_16px_rgba(57,186,230,0.2)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
          <span>EXPLORAR TODOS LOS PROYECTOS [ -&gt; ]</span>
        </button>

        <p className="mt-2 text-[11px] font-mono text-[#5a6673]">
          • MOSTRANDO 3 DE 12 REPOSITORIOS // ARCHIVO PÚBLICO •
        </p>
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { Project } from '../types';
import { X, Search, ArrowRight } from 'lucide-react';

interface AllProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

export const AllProjectsModal: React.FC<AllProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || p.tagCategory === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#242936] bg-[#10141c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#141821] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#879299]">
              <span className="text-[#39bae6]">&gt;_</span>
              <span>archive://repositories/public-index.git</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#879299] hover:bg-[#1b1f29] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-[#1b1f29] bg-[#0d1017] p-4 sm:p-5 font-mono text-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6673]" />
              <input
                type="text"
                placeholder="Buscar herramientas, scripts, tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border border-[#1b1f29] bg-[#10141c] py-2 pl-9 pr-3 text-xs text-[#e0e2ec] placeholder-[#5a6673] focus:border-[#39bae6] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#5a6673]">CAT:</span>
              {(['ALL', 'HERRAMIENTA', 'SCRIPT', 'AUTOMATIZACIÓN', 'EXPLOIT'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#39bae6] text-[#0b0e15] font-bold'
                      : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5a6673]">
            <span>COINCIDENCIAS: {filtered.length} REPOSITORIOS</span>
            <span>TOTAL PÚBLICOS: {projects.length} HERRAMIENTAS</span>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProject(p);
                  onClose();
                }}
                className="group cursor-pointer rounded border border-[#1b1f29] bg-[#0d1017] p-4 transition-all hover:border-[#39bae6] hover:bg-[#141821]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-base font-bold text-white group-hover:text-[#6ad5ff] transition-colors">
                      {p.title}
                    </span>
                    <span className="text-[11px] text-[#5a6673]">{p.number}</span>
                  </div>
                  <span className="rounded border border-[#e6b450]/30 bg-[#e6b450]/10 px-2 py-0.5 text-[10px] text-[#e6b450]">
                    {p.tagCategory}
                  </span>
                </div>

                <p className="text-[#879299] text-xs leading-relaxed line-clamp-2 mb-3">
                  {p.description}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-[#10141c] px-2 py-0.5 text-[10px] text-[#bdc8cf]"
                    >
                      • {t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-end border-t border-[#1b1f29]/60 pt-2 text-[10px] text-[#5a6673]">
                  <span className="text-[#39bae6] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-semibold">
                    VER REPOSITORIO <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-[#5a6673]">
              No se encontraron herramientas con esos criterios.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#1b1f29] bg-[#141821] px-5 py-3 font-mono text-xs">
          <button
            onClick={onClose}
            className="rounded border border-[#242936] px-4 py-1.5 text-[#bdc8cf] hover:bg-[#1b1f29] hover:text-white"
          >
            CERRAR ÍNDICE
          </button>
        </div>
      </div>
    </div>
  );
};

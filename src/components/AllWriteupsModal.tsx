import React, { useState } from 'react';
import { Writeup } from '../types';
import { X, Search, Terminal, Filter } from 'lucide-react';

interface AllWriteupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  writeups: Writeup[];
  onSelectWriteup: (writeup: Writeup) => void;
}

export const AllWriteupsModal: React.FC<AllWriteupsModalProps> = ({
  isOpen,
  onClose,
  writeups,
  onSelectWriteup,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState<'ALL' | 'LINUX' | 'WINDOWS'>('ALL');
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'FÁCIL' | 'MEDIO' | 'DIFÍCIL'>('ALL');

  if (!isOpen) return null;

  const filtered = writeups.filter((w) => {
    const matchesSearch =
      w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.vulnerabilities.some((v) => v.toLowerCase().includes(searchTerm.toLowerCase())) ||
      w.ports.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOs = osFilter === 'ALL' || w.os === osFilter;
    const matchesDiff = diffFilter === 'ALL' || w.difficulty === diffFilter;

    return matchesSearch && matchesOs && matchesDiff;
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
              <span>archive://writeups/ctf-audits.db</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#879299] hover:bg-[#1b1f29] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters & Search */}
        <div className="border-b border-[#1b1f29] bg-[#0d1017] p-4 sm:p-5 font-mono text-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5a6673]" />
              <input
                type="text"
                placeholder="Buscar por máquina, vulnerabilidad o puerto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border border-[#1b1f29] bg-[#10141c] py-2 pl-9 pr-3 text-xs text-[#e0e2ec] placeholder-[#5a6673] focus:border-[#39bae6] focus:outline-none"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#5a6673]">OS:</span>
              {(['ALL', 'LINUX', 'WINDOWS'] as const).map((os) => (
                <button
                  key={os}
                  onClick={() => setOsFilter(os)}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                    osFilter === os
                      ? 'bg-[#39bae6] text-[#0b0e15] font-bold'
                      : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                  }`}
                >
                  {os}
                </button>
              ))}

              <span className="ml-2 text-[#5a6673]">DIF:</span>
              {(['ALL', 'FÁCIL', 'MEDIO'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDiffFilter(diff)}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                    diffFilter === diff
                      ? 'bg-[#e6b450] text-[#0b0e15] font-bold'
                      : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5a6673]">
            <span>COINCIDENCIAS: {filtered.length} AUDITORÍAS</span>
            <span>TOTAL INDEXADO: {writeups.length} MÁQUINAS</span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((w) => (
              <div
                key={w.id}
                onClick={() => {
                  onSelectWriteup(w);
                  onClose();
                }}
                className="group cursor-pointer rounded border border-[#1b1f29] bg-[#0d1017] p-4 transition-all hover:border-[#39bae6] hover:bg-[#141821]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-base font-bold text-white group-hover:text-[#6ad5ff] transition-colors">
                    {w.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#1b1f29] px-2 py-0.5 text-[10px] text-[#879299]">
                      {w.os}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        w.difficulty === 'FÁCIL'
                          ? 'text-[#7edc73]'
                          : w.difficulty === 'MEDIO'
                          ? 'text-[#e6b450]'
                          : 'text-[#f07178]'
                      }`}
                    >
                      • {w.difficulty}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[#39bae6] mb-3">{w.ports}</div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {w.vulnerabilities.map((v, i) => (
                    <span
                      key={i}
                      className="rounded bg-[#10141c] px-2 py-0.5 text-[10px] text-[#bdc8cf]"
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-[#1b1f29]/60 pt-2 text-[10px] text-[#5a6673]">
                  <span>IP: {w.ipAddress || '10.10.11.x'}</span>
                  <span className="text-[#39bae6] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    ABRIR WRITEUP &gt;_
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-[#5a6673]">
              No se encontraron writeups con los filtros seleccionados.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#1b1f29] bg-[#141821] px-5 py-3 font-mono text-xs">
          <button
            onClick={onClose}
            className="rounded border border-[#242936] px-4 py-1.5 text-[#bdc8cf] hover:bg-[#1b1f29] hover:text-white"
          >
            CERRAR ARCHIVO
          </button>
        </div>
      </div>
    </div>
  );
};

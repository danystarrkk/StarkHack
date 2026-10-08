import React from 'react';
import { Writeup } from '../types';
import { Terminal, ArrowRight } from 'lucide-react';

interface NewsWriteupsProps {
  writeups: Writeup[];
  onSelectWriteup: (writeup: Writeup) => void;
  onExploreAll: () => void;
}

export const NewsWriteups: React.FC<NewsWriteupsProps> = ({
  writeups,
  onSelectWriteup,
  onExploreAll,
}) => {
  const renderIcon = (type: Writeup['iconType']) => {
    switch (type) {
      case 'wave':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded border border-[#39bae6]/30 bg-[#0d1017] text-[#39bae6] shadow-[0_0_12px_rgba(57,186,230,0.2)]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12c1.5-3 3-4.5 4.5-4.5 3 0 3 9 6 9s3-9 6-9 3 4.5 4.5 4.5" />
              <path d="M2 17c1.5-3 3-4.5 4.5-4.5 3 0 3 9 6 9s3-9 6-9 3 4.5 4.5 4.5" opacity="0.4" />
            </svg>
          </div>
        );
      case 'bug':
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded border border-[#d6a543]/30 bg-[#0d1017] text-[#e6b450] shadow-[0_0_12px_rgba(230,180,80,0.2)]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="8" height="12" x="8" y="8" rx="4" />
              <path d="m19 7-3 2" />
              <path d="m5 7 3 2" />
              <path d="m19 19-3-2" />
              <path d="m5 19 3-2" />
              <path d="M20 13h-4" />
              <path d="M4 13h4" />
              <path d="M10 4 8 2" />
              <path d="m14 4 2-2" />
            </svg>
          </div>
        );
      case 'network':
      default:
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded border border-[#7edc73]/30 bg-[#0d1017] text-[#7edc73] shadow-[0_0_12px_rgba(126,220,115,0.2)]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <line x1="8.5" y1="13.5" x2="15.5" y2="17.5" />
              <line x1="15.5" y1="6.5" x2="8.5" y2="10.5" />
            </svg>
          </div>
        );
    }
  };

  const getDifficultyColor = (diff: Writeup['difficulty']) => {
    switch (diff) {
      case 'FÁCIL':
        return {
          text: 'text-[#7edc73]',
          dot: 'bg-[#7edc73]',
          border: 'border-[#7edc73]/30',
          bg: 'bg-[#7edc73]/10',
        };
      case 'MEDIO':
        return {
          text: 'text-[#e6b450]',
          dot: 'bg-[#e6b450]',
          border: 'border-[#e6b450]/30',
          bg: 'bg-[#e6b450]/10',
        };
      case 'DIFÍCIL':
      case 'INSANE':
        return {
          text: 'text-[#f07178]',
          dot: 'bg-[#f07178]',
          border: 'border-[#f07178]/30',
          bg: 'bg-[#f07178]/10',
        };
    }
  };

  return (
    <section id="writeups" className="w-full space-y-6 pt-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b1f29] pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold text-[#39bae6]">//</span>
          <h2 className="font-mono text-base font-bold uppercase tracking-wider text-[#e0e2ec]">
            NEWS WRITEUPS
          </h2>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-[11px] font-mono text-[#879299]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
          <span>FEED: 03 ENTRIES</span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {writeups.map((w) => {
          const diffStyle = getDifficultyColor(w.difficulty);
          return (
            <div
              key={w.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
            >
              {/* Graphic Banner Top Box */}
              <div className="relative mb-4 flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded border border-[#1b1f29] bg-[#0d1017] bg-blueprint-grid">
                {/* Top Right OS Tag */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c]/90 px-2 py-0.5 text-[10px] font-mono text-[#879299]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6]" />
                  <span>{w.os}</span>
                </div>

                {/* Central Icon */}
                <div className="transition-transform duration-300 group-hover:scale-105">
                  {renderIcon(w.iconType)}
                </div>

                {/* Bottom Center Port Badge */}
                <div className="absolute bottom-2 flex items-center justify-center rounded border border-[#1b1f29] bg-[#0b0e15]/90 px-2.5 py-0.5 text-[10px] font-mono text-[#39bae6]">
                  <span>{w.ports}</span>
                </div>
              </div>

              {/* Title & Difficulty Row */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-sans text-lg font-semibold tracking-tight text-[#e0e2ec] group-hover:text-white transition-colors">
                  {w.title}
                </h3>
                <div
                  className={`flex items-center gap-1.5 rounded border ${diffStyle.border} ${diffStyle.bg} px-2 py-0.5 text-[10px] font-mono font-medium ${diffStyle.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${diffStyle.dot}`} />
                  <span>{w.difficulty}</span>
                </div>
              </div>

              {/* Vulnerabilities Chips */}
              <div className="mb-5 flex flex-1 flex-col gap-1.5">
                {w.vulnerabilities.map((vuln, idx) => (
                  <div
                    key={idx}
                    className="truncate rounded border border-[#1b1f29] bg-[#0d1017]/70 px-2.5 py-1 text-[11px] font-mono text-[#bdc8cf] transition-colors hover:border-[#242936]"
                    title={vuln}
                  >
                    {vuln}
                  </div>
                ))}
              </div>

              {/* Action Button: LEER WRITEUP */}
              <button
                onClick={() => onSelectWriteup(w)}
                className="group/btn mt-auto flex w-full items-center justify-center gap-2 rounded border border-[#242936] bg-[#0d1017] py-2 text-xs font-mono font-semibold text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.2)]"
              >
                <Terminal className="h-3.5 w-3.5 text-[#39bae6]" />
                <span>LEER WRITEUP</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Exploration CTA */}
      <div className="flex flex-col items-center justify-center pt-3 pb-2 text-center">
        <button
          onClick={onExploreAll}
          className="group inline-flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-6 py-2.5 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:bg-[#141821] hover:text-[#39bae6] hover:shadow-[0_0_16px_rgba(57,186,230,0.2)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
          <span>EXPLORAR TODOS LOS WRITEUPS [ -&gt; ]</span>
        </button>

        <p className="mt-2 text-[11px] font-mono text-[#5a6673]">
          • MOSTRANDO 3 DE 16 WRITEUPS // ARCHIVO DE AUDITORÍAS CTF •
        </p>
      </div>
    </section>
  );
};

// /writeups directory screen — real content pipeline, no mock data.
//
// Data flow: fetchIndex() (public/index.json via lib/content.ts) in a
// useState/useEffect load with honest loading/error states, then the PURE
// model builder (src/lib/directoryModel.ts) derives everything the screen
// renders: platform cards with real counts, the filtered writeup list, the
// global search hits and the real tag options.
//
// URL is the source of truth for the active platform: `?plataforma=<id>`
// (the /machines/:platformId redirect target, see src/lib/paths.ts). The
// filter UI reads it and writes it back via useSearchParams. Selecting a
// writeup routes via the existing path builder (writeupDetailPath, wired in
// src/lib/router.tsx) — never component state.
//
// Filters back REAL pipeline fields only: platform (real), level (real,
// displayed verbatim as 'Easy' | 'Medium' | 'Hard' — NOT translated into the
// template's FÁCIL|MEDIO|DIFÍCIL vocabulary), tags (real closed taxonomy),
// search over real title/description. The template's os/ports/ip/difficulty
// controls and chips are gone: those fields have no source in the pipeline,
// so their UI could never match anything real.
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Writeup } from '../types';
import type { WriteupIndexItem } from '../../types';
import { fetchIndex } from '../../lib/content';
import {
  DIRECTORY_LEVELS,
  EMPTY_DIRECTORY_FILTERS,
  buildDirectoryModel,
  normalizePlatformId,
  type DirectoryLevel,
  type DirectoryWriteup,
} from '../lib/directoryModel';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Terminal,
} from 'lucide-react';

interface WriteupsScreenProps {
  onSelectWriteup: (writeup: Writeup) => void;
}

const LEVEL_OPTIONS: Array<DirectoryLevel | 'ALL'> = ['ALL', ...DIRECTORY_LEVELS];

// Real level → badge colors, same Nord palette the screen already uses.
// The VALUES stay the real pipeline vocabulary (Easy/Medium/Hard), verbatim.
const LEVEL_BADGE: Record<DirectoryLevel, string> = {
  Easy: 'border-[#7edc73]/30 bg-[#7edc73]/10 text-[#7edc73]',
  Medium: 'border-[#e6b450]/30 bg-[#e6b450]/10 text-[#e6b450]',
  Hard: 'border-[#f07178]/30 bg-[#f07178]/10 text-[#f07178]',
};

const LEVEL_BADGE_FLAT: Record<DirectoryLevel, string> = {
  Easy: 'border-[#7edc73]/30 text-[#7edc73]',
  Medium: 'border-[#e6b450]/30 text-[#e6b450]',
  Hard: 'border-[#f07178]/30 text-[#f07178]',
};

export const WriteupsScreen: React.FC<WriteupsScreenProps> = ({ onSelectWriteup }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // URL is the source of truth for the active platform filter.
  const platformParam = searchParams.get('plataforma');
  const selectedPlatformId = normalizePlatformId(platformParam);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<DirectoryLevel | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Real pipeline loading (same honest states as Home).
  const [entries, setEntries] = useState<WriteupIndexItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadWriteups = async () => {
      try {
        const index = await fetchIndex();
        if (cancelled) return;
        setEntries(index);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setStatus('error');
      }
    };

    void loadWriteups();
    return () => {
      cancelled = true;
    };
  }, []);

  // Everything the screen renders comes from the pure model builder.
  const model = useMemo(
    () =>
      buildDirectoryModel(entries, {
        platformId: selectedPlatformId,
        level: levelFilter,
        tag: tagFilter,
        search: searchQuery,
      }),
    [entries, selectedPlatformId, levelFilter, tagFilter, searchQuery]
  );

  // Filter UI → URL (platform), URL stays the source of truth.
  const selectPlatform = (platformId: string): void => {
    setSearchParams({ plataforma: platformId });
  };

  const clearPlatform = (): void => {
    setSearchParams({});
    setSearchQuery('');
  };

  // Shortcut listener for CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('writeups-search-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Deterministic per-platform SVG icons are retired: every CTF platform
  // card now carries the same generic CTF logo (public/ui/logo-plataformas.webp),
  // so new platforms need no icon wiring at all.

  return (
    <div className="w-full space-y-8 font-mono">
      {/* Top Telemetry / Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#879299]">
          <span className="h-2 w-2 rounded-full bg-[#39bae6] shadow-[0_0_8px_#39bae6]" />
          <span className="tracking-wider">
            // REPOSITORY & KNOWLEDGE BASE // CVE &amp; CTF AUDITS
          </span>
        </div>

        <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
          <span className="text-[#39bae6] font-semibold">[SYSTEM: SECURE]</span>
          <span className="text-[#5a6673]">&gt; SEC_DOC // DB.04</span>
        </div>
      </div>

      {/* Title & Badges Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-[#6ad5ff] to-[#7edc73] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(106,213,255,0.35)]">
            Writeups
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-xs text-[#bdc8cf]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
              <span>ARCHIVES // v1.0</span>
            </div>

            <div className="flex items-center gap-1.5 rounded border border-[#e6b450]/40 bg-[#e6b450]/10 px-2.5 py-1 text-xs text-[#e6b450]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e6b450] shadow-[0_0_6px_#e6b450]" />
              <span className="font-semibold">LATEST AUDITS</span>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#879299] max-w-3xl leading-relaxed">
          &gt; Accessing high-security documentation, machine exploitation logs and vulnerability writeups.
        </p>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <div className="group relative flex items-center overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] transition-all focus-within:border-[#39bae6] focus-within:shadow-[0_0_16px_rgba(57,186,230,0.2)]">
          <div className="flex items-center pl-4 pr-2 text-[#5a6673]">
            <Search className="h-4 w-4 text-[#5a6673] group-focus-within:text-[#39bae6]" />
          </div>

          <input
            id="writeups-search-input"
            type="text"
            placeholder="Search archives (name, tag, level, platform)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
            className="w-full bg-transparent py-3.5 pr-20 text-xs sm:text-sm text-[#e0e2ec] placeholder-[#5a6673] focus:outline-none"
          />

          <div className="absolute right-3 flex items-center">
            <kbd className="hidden sm:inline-block rounded border border-[#242936] bg-[#0d1017] px-2 py-0.5 text-[10px] text-[#5a6673]">
              CTRL + K
            </kbd>
          </div>
        </div>

        {/* Live Search Instant Overlay (when typing globally outside platform view) */}
        {status === 'ready' && !selectedPlatformId && searchQuery.trim().length > 0 && searchFocused && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-[#242936] bg-[#0d1017] p-2 shadow-2xl">
            <div className="px-3 py-1.5 text-[10px] text-[#5a6673] border-b border-[#1b1f29] mb-1">
              {model.searchResults.length} RESULTADOS COINCIDENTES:
            </div>
            {model.searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5a6673]">
                No se encontraron auditorías con &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              model.searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectWriteup(item);
                    setSearchQuery('');
                  }}
                  className="group flex cursor-pointer items-center justify-between rounded p-2.5 hover:bg-[#141821] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Terminal className="h-3.5 w-3.5 text-[#39bae6]" />
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-[#6ad5ff]">
                        {item.title}
                      </div>
                      {item.summary && (
                        <div className="text-[10px] text-[#5a6673] truncate max-w-md">
                          {item.summary}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.level && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border ${LEVEL_BADGE_FLAT[item.level]}`}
                    >
                      {item.level}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Honest loading / error states (same pattern as Home) */}
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

      {/* Main View: Platform Grid OR Platform Node Explorer */}
      {status === 'ready' && (selectedPlatformId === null ? (
        /* PLATFORMS GRID (real platforms from the content index) */
        <div className="space-y-6 pt-2">
          {/* Section Kicker */}
          <div className="flex items-center gap-2 text-xs text-[#e0e2ec]">
            <span className="h-2 w-2 rounded-full bg-[#39bae6] shadow-[0_0_8px_#39bae6]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e0e2ec]">
              // PLATFORMS
            </h2>
          </div>

          {/* Platforms Grid */}
          {model.platformCards.length === 0 ? (
            <div className="py-20 text-center text-[#5a6673]">
              El índice de contenido no contiene writeups.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {model.platformCards.map((platform) => (
                <div
                  key={platform.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
                >
                  {/* Top Row: Icon + Node Count Pill */}
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-[#1b1f29] bg-[#0d1017]">
                      <img
                        src="/ui/logo-plataformas.webp"
                        alt="CTF"
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#0d1017] px-2.5 py-1 text-[11px] font-mono text-[#bdc8cf]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
                      <span>{platform.nodeCount} NODES</span>
                    </div>
                  </div>

                  {/* Platform Title & real level breakdown (no invented description) */}
                  <div className="mb-6 space-y-2">
                    <h3 className="font-sans text-xl font-bold tracking-tight text-white group-hover:text-[#6ad5ff] transition-colors">
                      {platform.name}
                    </h3>
                    <p className="text-xs font-mono leading-relaxed text-[#879299]">
                      LEVELS: Easy {platform.levelCounts.Easy} · Medium {platform.levelCounts.Medium} · Hard{' '}
                      {platform.levelCounts.Hard}
                    </p>
                  </div>

                  {/* Bottom Row: Last Deploy & ENTRAR Button */}
                  <div className="mt-auto flex items-center justify-between border-t border-[#1b1f29] pt-4 font-mono text-xs">
                    <span className="text-[11px] text-[#5a6673]">
                      {platform.lastDeploy ? `LAST DEPLOY: ${platform.lastDeploy}` : ''}
                    </span>

                    <button
                      onClick={() => selectPlatform(platform.id)}
                      className="group/btn flex items-center gap-1.5 rounded border border-[#242936] bg-[#0d1017] px-3.5 py-1.5 text-xs font-semibold text-[#39bae6] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.25)] active:translate-y-[1px]"
                    >
                      <span>ENTRAR</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* PLATFORM DETAIL NODE EXPLORER VIEW */
        <div className="space-y-6 pt-2">
          {/* Breadcrumb & Return Action */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1b1f29] pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={clearPlatform}
                className="group flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1.5 text-xs text-[#879299] hover:border-[#39bae6] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>VOLVER A PLATAFORMAS</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-[#5a6673]">
                <span>/</span>
                <span className="text-[#39bae6] font-semibold">
                  {model.activePlatform ? model.activePlatform.name : platformParam}
                </span>
                {model.activePlatform && (
                  <>
                    <span>//</span>
                    <span className="text-[#bdc8cf]">{model.activePlatform.nodeCount} NODES</span>
                  </>
                )}
              </div>
            </div>

            {/* Real filters: level (verbatim pipeline vocabulary) + tags (closed taxonomy) */}
            {model.activePlatform && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#5a6673] mr-1">LEVEL:</span>
                  {LEVEL_OPTIONS.map((level) => (
                    <button
                      key={level}
                      onClick={() => setLevelFilter(level)}
                      className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                        levelFilter === level
                          ? 'bg-[#39bae6] text-[#0b0e15] font-bold'
                          : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[#5a6673] mr-1">TAG:</span>
                  <select
                    value={tagFilter ?? ''}
                    onChange={(e) => setTagFilter(e.target.value === '' ? null : e.target.value)}
                    className="rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-[11px] text-[#879299] hover:text-white focus:outline-none"
                  >
                    <option value="">ALL</option>
                    {model.availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {!model.activePlatform ? (
            /* Honest unknown-platform state (URL param matches no real platform) */
            <div className="py-20 text-center text-[#5a6673]">
              La plataforma &ldquo;{platformParam}&rdquo; no existe en el índice de contenido.
            </div>
          ) : (
            /* Writeup Nodes Grid (real fields only) */
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {model.writeups.map((node: DirectoryWriteup) => (
                  <div
                    key={node.id}
                    onClick={() => onSelectWriteup(node)}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 transition-all hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)]"
                  >
                    {/* Cover image (level-derived generic cover, only when the
                        entry really carries one) */}
                    {node.image && (
                      <div className="relative mb-4 h-28 w-full overflow-hidden rounded border border-[#1b1f29]">
                        <img
                          src={node.image}
                          alt={node.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    )}
                    {/* Node Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-base font-bold text-white group-hover:text-[#6ad5ff] transition-colors">
                          {node.title}
                        </span>
                        {node.cve && (
                          <span className="rounded border border-[#1b1f29] bg-[#0d1017] px-1.5 py-0.5 text-[9px] text-[#879299]">
                            {node.cve}
                          </span>
                        )}
                      </div>

                      {node.level && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${LEVEL_BADGE[node.level]}`}
                        >
                          • {node.level}
                        </span>
                      )}
                    </div>

                    {/* Summary (real description) */}
                    {node.summary && (
                      <div className="text-[11px] text-[#39bae6] mb-3 line-clamp-2">{node.summary}</div>
                    )}

                    {/* Real tags (closed taxonomy) */}
                    {node.tags && node.tags.length > 0 && (
                      <div className="space-y-1.5 mb-4">
                        {node.tags.map((tag) => (
                          <div
                            key={tag}
                            className="truncate rounded bg-[#0d1017] px-2 py-0.5 text-[10px] text-[#bdc8cf] border border-[#1b1f29]/60"
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer metadata & Action Button */}
                    <div className="flex items-center justify-between border-t border-[#1b1f29] pt-3 text-[10px] text-[#5a6673]">
                      <div>
                        {node.releaseDate && (
                          <>
                            <span>RELEASE: </span>
                            <span className="text-[#6ad5ff] font-semibold">{node.releaseDate}</span>
                          </>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWriteup(node);
                        }}
                        className="group/btn flex items-center gap-1 rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#6ad5ff] transition-all hover:border-[#39bae6] hover:bg-[#39bae6] hover:text-[#0b0e15]"
                      >
                        <span>[&gt;] LEER WRITEUP</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {model.writeups.length === 0 && (
                <div className="py-20 text-center text-[#5a6673]">
                  No se encontraron nodos con los filtros especificados.
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
};

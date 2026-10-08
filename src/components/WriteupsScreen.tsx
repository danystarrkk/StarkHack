import React, { useState, useEffect, useMemo } from 'react';
import { Platform, Writeup } from '../types';
import { PLATFORMS, HACKMYVM_NODES, ALL_WRITEUPS_ARCHIVE } from '../data/portfolioData';
import {
  Search,
  Share2,
  Box,
  Flame,
  HardDrive,
  Shield,
  ArrowRight,
  ArrowLeft,
  Terminal,
  Filter,
  CheckCircle2,
  Hash,
} from 'lucide-react';

interface WriteupsScreenProps {
  onSelectWriteup: (writeup: Writeup) => void;
}

export const WriteupsScreen: React.FC<WriteupsScreenProps> = ({ onSelectWriteup }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [searchFocused, setSearchFocused] = useState(false);

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

  // Map icon names to Lucide icons
  const renderPlatformIcon = (icon: Platform['icon']) => {
    switch (icon) {
      case 'share':
        return <Share2 className="h-5 w-5 text-[#39bae6]" />;
      case 'cube':
        return <Box className="h-5 w-5 text-[#7edc73]" />;
      case 'flame':
        return <Flame className="h-5 w-5 text-[#f07178]" />;
      case 'hard-drive':
        return <HardDrive className="h-5 w-5 text-[#e6b450]" />;
      case 'shield':
      default:
        return <Shield className="h-5 w-5 text-[#39bae6]" />;
    }
  };

  // Get nodes for a specific platform
  const getPlatformNodes = (platformId: string): Writeup[] => {
    if (platformId === 'hackmyvm') {
      return HACKMYVM_NODES;
    }
    // Return sample or archived writeups for other platforms
    return ALL_WRITEUPS_ARCHIVE.filter(
      (w) => !w.platformId || w.platformId === platformId
    );
  };

  // Search results across everything
  const allAvailableWriteups = useMemo(() => {
    return [...HACKMYVM_NODES, ...ALL_WRITEUPS_ARCHIVE];
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allAvailableWriteups.filter((w) => {
      return (
        w.title.toLowerCase().includes(q) ||
        w.vulnerabilities.some((v) => v.toLowerCase().includes(q)) ||
        w.ports.toLowerCase().includes(q) ||
        (w.ipAddress && w.ipAddress.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, allAvailableWriteups]);

  // Nodes to display inside selected platform view
  const currentNodes = useMemo(() => {
    if (!selectedPlatform) return [];
    let list = getPlatformNodes(selectedPlatform.id);
    if (difficultyFilter !== 'ALL') {
      list = list.filter((n) => n.difficulty === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.vulnerabilities.some((v) => v.toLowerCase().includes(q)) ||
          n.ports.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedPlatform, difficultyFilter, searchQuery]);

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
        {!selectedPlatform && searchQuery.trim().length > 0 && searchFocused && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-[#242936] bg-[#0d1017] p-2 shadow-2xl">
            <div className="px-3 py-1.5 text-[10px] text-[#5a6673] border-b border-[#1b1f29] mb-1">
              {searchResults.length} RESULTADOS COINCIDENTES:
            </div>
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#5a6673]">
                No se encontraron auditorías con &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.map((item) => (
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
                      <div className="text-[10px] text-[#5a6673] flex gap-2">
                        <span>{item.ports}</span>
                        <span>•</span>
                        <span>{item.vulnerabilities.slice(0, 2).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border ${
                      item.difficulty === 'FÁCIL'
                        ? 'border-[#7edc73]/30 text-[#7edc73]'
                        : item.difficulty === 'MEDIO'
                        ? 'border-[#e6b450]/30 text-[#e6b450]'
                        : 'border-[#f07178]/30 text-[#f07178]'
                    }`}
                  >
                    {item.difficulty}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main View: Platform Grid OR Platform Node Explorer */}
      {!selectedPlatform ? (
        /* PLATFORMS GRID (Exact view matching user screenshot) */
        <div className="space-y-6 pt-2">
          {/* Section Kicker */}
          <div className="flex items-center gap-2 text-xs text-[#e0e2ec]">
            <span className="h-2 w-2 rounded-full bg-[#39bae6] shadow-[0_0_8px_#39bae6]" />
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e0e2ec]">
              // PLATFORMS
            </h2>
          </div>

          {/* Platforms Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] p-5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)]"
              >
                {/* Top Row: Icon + Node Count Pill */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[#1b1f29] bg-[#0d1017]">
                    {renderPlatformIcon(platform.icon)}
                  </div>

                  <div className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#0d1017] px-2.5 py-1 text-[11px] font-mono text-[#bdc8cf]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
                    <span>{platform.nodeCount} NODES</span>
                  </div>
                </div>

                {/* Platform Title & Description */}
                <div className="mb-6 space-y-2">
                  <h3 className="font-sans text-xl font-bold tracking-tight text-white group-hover:text-[#6ad5ff] transition-colors">
                    {platform.name}
                  </h3>
                  <p className="text-xs font-mono leading-relaxed text-[#879299]">
                    {platform.description}
                  </p>
                </div>

                {/* Bottom Row: Last Deploy & ENTRAR Button */}
                <div className="mt-auto flex items-center justify-between border-t border-[#1b1f29] pt-4 font-mono text-xs">
                  <span className="text-[11px] text-[#5a6673]">
                    LAST DEPLOY: {platform.lastDeploy}
                  </span>

                  <button
                    onClick={() => setSelectedPlatform(platform)}
                    className="group/btn flex items-center gap-1.5 rounded border border-[#242936] bg-[#0d1017] px-3.5 py-1.5 text-xs font-semibold text-[#39bae6] transition-all hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_12px_rgba(57,186,230,0.25)] active:translate-y-[1px]"
                  >
                    <span>ENTRAR</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* PLATFORM DETAIL NODE EXPLORER VIEW */
        <div className="space-y-6 pt-2">
          {/* Breadcrumb & Return Action */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1b1f29] pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedPlatform(null);
                  setSearchQuery('');
                }}
                className="group flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1.5 text-xs text-[#879299] hover:border-[#39bae6] hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>VOLVER A PLATAFORMAS</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-[#5a6673]">
                <span>/</span>
                <span className="text-[#39bae6] font-semibold">{selectedPlatform.name}</span>
                <span>//</span>
                <span className="text-[#bdc8cf]">{selectedPlatform.nodeCount} NODES</span>
              </div>
            </div>

            {/* Difficulty Filters */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#5a6673] mr-1">DIFICULTAD:</span>
              {(['ALL', 'FÁCIL', 'MEDIO', 'DIFÍCIL'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                    difficultyFilter === diff
                      ? 'bg-[#39bae6] text-[#0b0e15] font-bold'
                      : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Machine Nodes Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => onSelectWriteup(node)}
                className="group cursor-pointer rounded-lg border border-[#1b1f29] bg-[#10141c] p-4 transition-all hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.8)]"
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-base font-bold text-white group-hover:text-[#6ad5ff] transition-colors">
                      {node.title}
                    </span>
                    <span className="rounded border border-[#1b1f29] bg-[#0d1017] px-1.5 py-0.5 text-[9px] text-[#879299]">
                      {node.os}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      node.difficulty === 'FÁCIL'
                        ? 'border-[#7edc73]/30 bg-[#7edc73]/10 text-[#7edc73]'
                        : node.difficulty === 'MEDIO'
                        ? 'border-[#e6b450]/30 bg-[#e6b450]/10 text-[#e6b450]'
                        : 'border-[#f07178]/30 bg-[#f07178]/10 text-[#f07178]'
                    }`}
                  >
                    • {node.difficulty}
                  </span>
                </div>

                {/* Ports Info */}
                <div className="text-[11px] text-[#39bae6] mb-3">
                  {node.ports}
                </div>

                {/* Summary or Vulnerabilities */}
                <div className="space-y-1.5 mb-4">
                  {node.vulnerabilities.map((v, i) => (
                    <div
                      key={i}
                      className="truncate rounded bg-[#0d1017] px-2 py-0.5 text-[10px] text-[#bdc8cf] border border-[#1b1f29]/60"
                    >
                      {v}
                    </div>
                  ))}
                </div>

                {/* Footer metadata & Action Button */}
                <div className="flex items-center justify-between border-t border-[#1b1f29] pt-3 text-[10px] text-[#5a6673]">
                  <div>
                    <span>IP: </span>
                    <span className="text-[#6ad5ff] font-semibold">{node.ipAddress || '192.168.1.x'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#7edc73] flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      PWNED
                    </span>

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
              </div>
            ))}
          </div>

          {currentNodes.length === 0 && (
            <div className="py-20 text-center text-[#5a6673]">
              No se encontraron nodos con los filtros especificados.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

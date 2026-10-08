import React, { useState, useEffect, useMemo } from 'react';
import { Writeup, MachineLink, ToolLink } from '../types';
import {
  MarkdownRenderer,
  extractHeadingsFromMarkdown,
  TocHeading,
} from './MarkdownRenderer';
import { getWriteupContent, RichWriteupData } from '../data/writeupContents';
import {
  ArrowLeft,
  Share2,
  Check,
  ExternalLink,
  BookOpen,
  Wrench,
  Server,
  Hash,
  Tag,
} from 'lucide-react';

interface WriteupPageProps {
  writeup: Writeup;
  onBack: () => void;
  platformName?: string;
}

export const WriteupPage: React.FC<WriteupPageProps> = ({
  writeup,
  onBack,
  platformName = 'HackMyVM',
}) => {
  // Retrieve or compute full markdown and links
  const initialData: RichWriteupData = useMemo(() => {
    return getWriteupContent(writeup);
  }, [writeup]);

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Links lists
  const [machineLinks] = useState<MachineLink[]>(initialData.machineLinks);
  const [toolLinks] = useState<ToolLink[]>(initialData.toolLinks);

  // Headings extracted from markdown
  const headings: TocHeading[] = useMemo(() => {
    return extractHeadingsFromMarkdown(initialData.markdown);
  }, [initialData.markdown]);

  // Tags assigned to this writeup
  const writeupTags: string[] = useMemo(() => {
    if (writeup.tags && writeup.tags.length > 0) return writeup.tags;
    if (initialData.tags && initialData.tags.length > 0) return initialData.tags;
    return [writeup.os, writeup.difficulty, ...writeup.vulnerabilities];
  }, [writeup, initialData]);

  // Track scroll position & update active heading and reading progress
  useEffect(() => {
    const handleScroll = () => {
      // Calculate reading progress
      const scrollY = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, Math.round((scrollY / totalHeight) * 100)));
        setReadingProgress(progress);
      }

      // Detect active heading
      const headingElements = headings
        .map((h) => document.getElementById(h.id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) return;

      const triggerPosition = 180;
      let currentActiveId = headingElements[0].id;

      for (const el of headingElements) {
        const top = el.getBoundingClientRect().top;
        if (top <= triggerPosition) {
          currentActiveId = el.id;
        } else {
          break;
        }
      }

      setActiveHeadingId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const topOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setActiveHeadingId(id);
    }
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#10131a] text-[#e0e2ec] font-mono selection:bg-[#39bae6]/30 selection:text-white pb-24">
      {/* Top Floating Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#1d2027]">
        <div
          className="h-full bg-gradient-to-r from-[#39bae6] via-[#6ad5ff] to-[#7edc73] transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Top Navigation & Header Bar - Spacious Horizontal Layout */}
      <header className="sticky top-0 z-40 border-b border-[#1b1f29] bg-[#10131a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1720px] w-full items-center justify-between px-4 py-3 sm:px-8 lg:px-10">
          {/* Left: Back button & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-3.5 py-1.5 text-xs text-[#879299] transition-all hover:border-[#39bae6] hover:bg-[#1a202c] hover:text-[#6ad5ff] active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
              <span className="font-semibold uppercase tracking-wider">VOLVER</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-[#5a6673]">
              <span className="text-[#39bae6] font-semibold">// WRITEUPS</span>
              <span>/</span>
              <span className="text-[#bdc8cf] font-semibold">{platformName.toUpperCase()}</span>
              <span>/</span>
              <span className="text-white font-bold">{writeup.title.toUpperCase()}</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Quick jump to index on smaller screens */}
            <button
              onClick={() => {
                const el = document.getElementById('writeup-sidebar-index');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="lg:hidden flex items-center gap-1.5 rounded border border-[#242936] bg-[#141821] px-2.5 py-1.5 text-xs text-[#879299] transition-colors hover:text-[#6ad5ff]"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#39bae6]" />
              <span className="text-[11px]">VER ÍNDICE</span>
            </button>

            {/* Share / Copy URL button */}
            <button
              onClick={handleCopyShare}
              className="flex items-center gap-1.5 rounded border border-[#242936] bg-[#141821] px-3 py-1.5 text-xs text-[#879299] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
              title="Copiar enlace del writeup"
            >
              {copiedShare ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#7edc73]" />
                  <span className="text-[#7edc73] font-bold text-[11px]">COPIADO</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px] font-semibold">COMPARTIR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout - Expanded Horizontal Space */}
      <div className="mx-auto max-w-[1720px] w-full px-4 py-8 sm:px-8 lg:px-10">
        {/* Machine Metadata Hero Banner */}
        <div className="mb-8 rounded-xl border border-[#242936] bg-gradient-to-b from-[#141822] via-[#10141c] to-[#0c0e14] p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Subtle Cyber Grid Background overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#39bae6_1px,transparent_1px),linear-gradient(to_bottom,#39bae6_1px,transparent_1px)] bg-[size:24px_24px]" />

          <div className="relative z-10 space-y-4">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1.5 rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-3 py-1 text-[#39bae6] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-[#39bae6] shadow-[0_0_6px_#39bae6]" />
                {platformName.toUpperCase()}
              </span>

              <span
                className={`rounded border px-3 py-1 text-[11px] font-bold ${
                  writeup.difficulty === 'FÁCIL'
                    ? 'border-[#7edc73]/30 bg-[#7edc73]/10 text-[#7edc73]'
                    : writeup.difficulty === 'MEDIO'
                    ? 'border-[#f4c05b]/30 bg-[#f4c05b]/10 text-[#f4c05b]'
                    : 'border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]'
                }`}
              >
                DIFICULTAD: {writeup.difficulty}
              </span>

              <span className="rounded border border-[#242936] bg-[#0b0e15] px-3 py-1 text-[11px] text-[#879299]">
                OS: <strong className="text-white">{writeup.os}</strong>
              </span>

              <span className="rounded border border-[#7edc73]/30 bg-[#7edc73]/10 px-3 py-1 text-[11px] font-bold text-[#7edc73]">
                PWNED: ROOT (100%)
              </span>
            </div>

            {/* Machine Title with Glowing Gradient */}
            <h1 className="font-sans text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#6ad5ff] to-[#7edc73] bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(106,213,255,0.25)]">
              {writeup.title}
            </h1>

            {/* Summary description */}
            {writeup.summary && (
              <p className="text-sm sm:text-base text-[#bdc8cf] max-w-4xl leading-relaxed">
                {writeup.summary}
              </p>
            )}

            {/* Tags de la máquina en Hero */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-[#5a6673] uppercase tracking-wider mr-1 flex items-center gap-1.5 font-semibold">
                <Tag className="h-3 w-3 text-[#39bae6]" />
                TAGS:
              </span>
              {writeupTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#242936] bg-[#141821] px-2.5 py-1 text-[11px] font-mono text-[#879299] hover:border-[#39bae6]/40 hover:text-[#e0e2ec] transition-colors"
                >
                  {tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Content & Sidebar Grid Layout - Fixed to right, spacious, no internal scrollbars */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 xl:gap-10">
          {/* Main Article Content Column (Left, spacious) */}
          <main className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 min-w-0">
            <div className="rounded-xl border border-[#1b1f29] bg-[#121620]/70 p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-sm">
              <MarkdownRenderer
                content={initialData.markdown}
                machineTitle={writeup.title}
              />
            </div>
          </main>

          {/* Right Sidebar (Fixed on the right, fully rendered, no inner scrollbars) */}
          <aside
            id="writeup-sidebar-index"
            className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-6"
          >
            <div className="sticky top-20 space-y-6">
              {/* 1. SECCIÓN ÍNDICE // TABLE OF CONTENTS (Completo, sin barra de scroll interna) */}
              <div className="rounded-xl border border-[#242936] bg-[#121620] p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[#39bae6]" />
                    <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
                      ÍNDICE DEL WRITEUP
                    </h3>
                  </div>
                  <span className="rounded bg-[#1b202c] px-2 py-0.5 text-[10px] font-mono text-[#879299]">
                    {headings.length} SECCIONES
                  </span>
                </div>

                {/* Headings list rendered completely without scrollbars, with colors & level hierarchy */}
                <div className="space-y-1 text-xs">
                  {headings.length === 0 ? (
                    <p className="text-[11px] text-[#5a6673] italic">Sin encabezados identificados.</p>
                  ) : (
                    headings.map((h) => {
                      const isActive = activeHeadingId === h.id;
                      // Indent by level
                      const indentClass = {
                        1: 'pl-2 font-bold text-sm',
                        2: 'pl-4 font-semibold text-xs',
                        3: 'pl-6 font-medium text-xs',
                        4: 'pl-8 font-normal text-[11px]',
                        5: 'pl-10 font-normal text-[10.5px]',
                        6: 'pl-12 font-normal text-[10px]',
                      }[h.level];

                      // Colors by level
                      const levelColor = {
                        1: 'text-[#6ad5ff]',
                        2: 'text-[#7edc73]',
                        3: 'text-[#f4c05b]',
                        4: 'text-[#39bae6]',
                        5: 'text-[#bce9ff]',
                        6: 'text-[#bdc8cf]',
                      }[h.level];

                      return (
                        <button
                          key={h.id}
                          onClick={() => scrollToHeading(h.id)}
                          className={`group flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-all ${indentClass} ${
                            isActive
                              ? 'bg-[#39bae6]/15 text-[#6ad5ff] font-bold shadow-[inset_3px_0_0_#39bae6]'
                              : `${levelColor} hover:bg-[#181d29] hover:brightness-125`
                          }`}
                        >
                          <span className="truncate flex-1 leading-snug">
                            {h.cleanText}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 border-t border-[#1b1f29] pt-2.5 flex items-center justify-between text-[10px] text-[#5a6673]">
                  <span>PROGRESO DE LECTURA</span>
                  <span className="text-[#39bae6] font-bold">{readingProgress}%</span>
                </div>
              </div>

              {/* 2. SECCIÓN ENLACES DE LA MÁQUINA // TARGET MACHINE LINKS (Solo perfil oficial) */}
              <div className="rounded-xl border border-[#242936] bg-[#121620] p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-[#7edc73]" />
                    <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
                      ENLACES DE LA MÁQUINA
                    </h3>
                  </div>
                </div>

                <div className="space-y-2">
                  {machineLinks.slice(0, 1).map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target={link.url.startsWith('http') ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="group flex flex-col rounded-lg border border-[#1b1f29] bg-[#0c0f16] p-3 transition-all hover:border-[#7edc73]/40 hover:bg-[#141924]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-white group-hover:text-[#7edc73] transition-colors truncate">
                          {link.title}
                        </span>
                        <ExternalLink className="h-3 w-3 text-[#5a6673] group-hover:text-[#7edc73] shrink-0" />
                      </div>
                      {link.badge && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-[#879299]">
                          <span className="h-1 w-1 rounded-full bg-[#7edc73]" />
                          <span className="text-[#7edc73] font-semibold">{link.badge}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>

              {/* 3. SECCIÓN HERRAMIENTAS & OTROS LINKS // TOOLS & RESOURCES */}
              <div className="rounded-xl border border-[#242936] bg-[#121620] p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[#f4c05b]" />
                    <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-white">
                      HERRAMIENTAS & OTROS LINKS
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {toolLinks.map((tool, idx) => (
                    <a
                      key={idx}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg border border-[#1b1f29] bg-[#0c0f16] p-3 transition-all hover:border-[#f4c05b]/40 hover:bg-[#141924]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-white group-hover:text-[#f4c05b] transition-colors truncate">
                          {tool.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tool.githubStars && (
                            <span className="rounded bg-[#1a202c] px-1.5 py-0.5 text-[9px] text-[#f4c05b]">
                              {tool.githubStars}
                            </span>
                          )}
                          <ExternalLink className="h-3 w-3 text-[#5a6673] group-hover:text-[#f4c05b]" />
                        </div>
                      </div>

                      <p className="text-[11px] leading-relaxed text-[#879299] line-clamp-2">
                        {tool.description}
                      </p>

                      <div className="mt-2.5 flex items-center gap-1.5">
                        {tool.developedByAuthor ? (
                          <span className="rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 text-[9px] font-bold text-[#6ad5ff]">
                            [DESARROLLADA POR MÍ]
                          </span>
                        ) : (
                          <span className="rounded border border-[#1b1f29] bg-[#141822] px-2 py-0.5 text-[9px] text-[#879299]">
                            [RECURSO / REF]
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Check,
  Terminal,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertOctagon,
  Maximize2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export interface TocHeading {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  cleanText: string;
}

interface MarkdownRendererProps {
  content: string;
  onHeadingsExtracted?: (headings: TocHeading[]) => void;
  machineTitle?: string;
}

// Helper to slugify heading text for anchor IDs
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Shared anchor registration for the TOC extractor and the renderer: both call
// it with the same deterministic inputs (raw heading text, 1-based heading
// ordinal, seen ids) so every TOC entry's `id` always matches the `id` the
// renderer puts on the heading — duplicates and punctuation-only headings
// included.
function registerHeadingAnchor(
  rawText: string,
  ordinal: number,
  seenIds: Set<string>
): { id: string; cleanText: string } {
  // Remove basic markdown inside headings like ** or *
  const cleanText = rawText.replace(/[*_~`]/g, '');
  const baseId = slugify(cleanText) || `heading-${ordinal}`;
  let id = baseId;
  let counter = 1;
  while (seenIds.has(id)) {
    id = `${baseId}-${counter++}`;
  }
  seenIds.add(id);
  return { id, cleanText };
}

// Extract headings directly from markdown content. Fenced code blocks are
// skipped: shell `#` comments inside them are NOT headings (GFM), so the TOC
// holds exactly the sections the renderer shows.
export function extractHeadingsFromMarkdown(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];
  const seenIds = new Set<string>();
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const rawText = headingMatch[2].trim();
      const { id, cleanText } = registerHeadingAnchor(rawText, headings.length + 1, seenIds);

      headings.push({
        id,
        level,
        text: rawText,
        cleanText,
      });
    }
  }

  return headings;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  machineTitle = 'Target Machine',
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string; caption?: string } | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2200);
  };

  // Helper to parse inline markdown (bold, italic, underline, inline code, strike, links)
  const renderInlineFormatted = (text: string): React.ReactNode => {
    // Regex for inline elements
    // Tokens: `code`, **bold**, *italic*, <u>underline</u>, __underline__, ~~strike~~, [text](url)
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|<u>.*?<\/u>|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Inline code
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
        return (
          <code
            key={index}
            className="rounded border border-[#39bae6]/30 bg-[#0a0d14] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#6ad5ff] shadow-inner"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold
      if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
        return (
          <strong key={index} className="font-sans font-bold text-white tracking-wide">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Underline via <u>...</u>
      if (part.startsWith('<u>') && part.endsWith('</u>') && part.length > 6) {
        return (
          <span
            key={index}
            className="underline decoration-[#39bae6] decoration-2 underline-offset-4 text-[#e0e2ec] font-medium"
          >
            {part.slice(3, -4)}
          </span>
        );
      }

      // Underline via __...__
      if (part.startsWith('__') && part.endsWith('__') && part.length > 3) {
        return (
          <span
            key={index}
            className="underline decoration-[#39bae6] decoration-2 underline-offset-4 text-[#e0e2ec] font-medium"
          >
            {part.slice(2, -2)}
          </span>
        );
      }

      // Italic
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={index} className="italic text-[#bdc8cf]">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Strikethrough
      if (part.startsWith('~~') && part.endsWith('~~') && part.length > 3) {
        return (
          <span key={index} className="line-through text-[#879299]">
            {part.slice(2, -2)}
          </span>
        );
      }

      // Link [text](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#6ad5ff] hover:text-[#7edc73] underline decoration-[#6ad5ff]/50 decoration-1 underline-offset-2 transition-colors"
          >
            <span>{linkMatch[1]}</span>
            <ExternalLink className="h-3 w-3 inline-block" />
          </a>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Parse blocks
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  const seenHeadingIds = new Set<string>();
  let headingCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code blocks: ```lang ... ``` (or ~~~ fences)
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const langHeader = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (
        i < lines.length &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('~~~')
      ) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      const codeString = codeLines.join('\n');
      const blockId = `code-block-${renderedElements.length}`;

      // Check if lang header has custom filename like `bash:scan_network.sh`
      let lang = langHeader || 'bash';
      let filename = '';
      if (lang.includes(':')) {
        const parts = lang.split(':');
        lang = parts[0];
        filename = parts[1];
      } else if (lang.includes('//')) {
        const parts = lang.split('//');
        lang = parts[0].trim();
        filename = parts[1].trim();
      }

      const isTerminal = ['bash', 'sh', 'zsh', 'terminal', 'shell', 'console'].includes(lang.toLowerCase());

      renderedElements.push(
        <div
          key={`block-${blockId}`}
          className="my-5 overflow-hidden rounded-lg border border-[#242936] bg-[#0b0e15] shadow-lg transition-all hover:border-[#39bae6]/40"
        >
          {/* Code block console top bar */}
          <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#121620] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/80" />
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] text-[#879299]">
                <span className="rounded bg-[#1a202c] px-1.5 py-0.5 text-[10px] font-bold text-[#6ad5ff] uppercase tracking-wider">
                  {lang.toUpperCase()}
                </span>
                {filename ? (
                  <span className="text-[#e0e2ec] font-semibold">{filename}</span>
                ) : (
                  <span className="text-[#5a6673]">{isTerminal ? 'stark@defensive-station:~$' : 'payload.source'}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => copyToClipboard(codeString, blockId)}
              className="flex items-center gap-1.5 rounded border border-[#242936] bg-[#191e2b] px-2.5 py-1 text-[11px] font-mono text-[#879299] transition-all hover:border-[#39bae6] hover:bg-[#202738] hover:text-[#6ad5ff] active:scale-95"
              title="Copiar contenido al portapapeles"
            >
              {copiedCodeId === blockId ? (
                <>
                  <Check className="h-3 w-3 text-[#7edc73]" />
                  <span className="text-[#7edc73] font-bold">COPIADO</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-[#39bae6]" />
                  <span>COPIAR</span>
                </>
              )}
            </button>
          </div>

          {/* Code content */}
          <div className="relative overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">
            <pre className="text-[#bdc8cf]">
              {codeLines.map((cLine, cIdx) => (
                <div key={cIdx} className="flex group/line hover:bg-[#151b27]/40 -mx-2 px-2 rounded">
                  <span className="w-8 select-none text-[11px] text-[#424d57] text-right pr-3 font-mono">
                    {cIdx + 1}
                  </span>
                  <span
                    className={
                      cLine.startsWith('#') || cLine.startsWith('//')
                        ? 'text-[#5a6673] italic'
                        : cLine.startsWith('[+]') || cLine.includes('PWNED') || cLine.includes('SUCCESS')
                        ? 'text-[#7edc73] font-semibold'
                        : cLine.startsWith('[-]') || cLine.includes('ERROR') || cLine.includes('FAILED')
                        ? 'text-[#ffb4ab]'
                        : cLine.startsWith('[*]') || cLine.includes('INFO')
                        ? 'text-[#f4c05b]'
                        : isTerminal && (cLine.startsWith('$ ') || cLine.startsWith('# '))
                        ? 'text-[#6ad5ff] font-semibold'
                        : 'text-[#e0e2ec]'
                    }
                  >
                    {cLine}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      );
      continue;
    }

    // 2. Headings #, ##, ###, ####, #####, ###### (Without ## markers, styled with distinct level colors)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = headingMatch[2].trim();
      // Same registration as the TOC extractor: rendered ids === TOC anchors.
      const { id: headingId } = registerHeadingAnchor(text, headingCount + 1, seenHeadingIds);
      headingCount += 1;

      const headingColorClasses: Record<number, string> = {
        1: 'text-[#6ad5ff] text-2xl sm:text-3xl font-extrabold border-b border-[#242936] pb-3 pt-6 mt-8',
        2: 'text-[#7edc73] text-xl sm:text-2xl font-bold border-b border-[#1b1f29]/80 pb-2.5 pt-5 mt-7',
        3: 'text-[#f4c05b] text-lg sm:text-xl font-semibold pt-4 mt-6',
        4: 'text-[#39bae6] text-base sm:text-lg font-semibold pt-3 mt-5',
        5: 'text-[#bce9ff] text-sm sm:text-base font-medium pt-2 mt-4',
        6: 'text-[#bdc8cf] text-xs sm:text-sm font-medium uppercase tracking-wider pt-2 mt-3',
      };

      // First block in the card: drop the stacked top padding/margin so the
      // heading sits right below the card's own padding (no ~100px gap).
      const headingClasses =
        renderedElements.length === 0
          ? headingColorClasses[level].replace(/\b(?:mt|pt)-\d+\b\s*/g, '')
          : headingColorClasses[level];

      renderedElements.push(
        <div key={`heading-${headingId}-${renderedElements.length}`} id={headingId} className="group scroll-mt-24">
          <h2 className={`font-sans tracking-tight ${headingClasses}`}>
            {renderInlineFormatted(text)}
          </h2>
        </div>
      );
      i++;
      continue;
    }

    // 3. Notes & Callouts: > [!NOTE], > [!WARNING], > [!TIP], > [!DANGER], > [!INFO]
    if (trimmed.startsWith('>')) {
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        calloutLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }

      const firstLine = calloutLines[0] || '';
      let calloutType: 'note' | 'warning' | 'tip' | 'danger' | 'quote' = 'quote';
      let title = '';
      let remainingContent = calloutLines;

      const calloutMatch = firstLine.match(/^\[!(NOTE|INFO|WARNING|ALERTA|TIP|CONSEJO|DANGER|CRITICAL|CRÍTICO)\](?:\s+(.*))?$/i);
      if (calloutMatch) {
        const typeStr = calloutMatch[1].toUpperCase();
        if (['NOTE', 'INFO'].includes(typeStr)) calloutType = 'note';
        else if (['WARNING', 'ALERTA'].includes(typeStr)) calloutType = 'warning';
        else if (['TIP', 'CONSEJO'].includes(typeStr)) calloutType = 'tip';
        else if (['DANGER', 'CRITICAL', 'CRÍTICO'].includes(typeStr)) calloutType = 'danger';

        title = calloutMatch[2] || (calloutType === 'note' ? 'NOTA TÉCNICA // INFO' : calloutType === 'warning' ? 'ADVERTENCIA // SECURITY NOTICE' : calloutType === 'tip' ? 'CONSEJO DE AUDITORÍA' : 'CRITICAL FINDING // CVE ALERT');
        remainingContent = calloutLines.slice(1);
      } else {
        // Simple markdown blockquote
        calloutType = 'quote';
      }

      const calloutStyles = {
        note: {
          border: 'border-[#39bae6]/40 bg-[#39bae6]/5 text-[#6ad5ff]',
          icon: <Info className="h-4 w-4 text-[#39bae6] shrink-0" />,
          titleColor: 'text-[#39bae6]',
        },
        warning: {
          border: 'border-[#f4c05b]/40 bg-[#f4c05b]/5 text-[#f4c05b]',
          icon: <AlertTriangle className="h-4 w-4 text-[#f4c05b] shrink-0" />,
          titleColor: 'text-[#f4c05b]',
        },
        tip: {
          border: 'border-[#7edc73]/40 bg-[#7edc73]/5 text-[#7edc73]',
          icon: <Lightbulb className="h-4 w-4 text-[#7edc73] shrink-0" />,
          titleColor: 'text-[#7edc73]',
        },
        danger: {
          border: 'border-[#ffb4ab]/40 bg-[#ffb4ab]/5 text-[#ffb4ab]',
          icon: <AlertOctagon className="h-4 w-4 text-[#ffb4ab] shrink-0" />,
          titleColor: 'text-[#ffb4ab]',
        },
        quote: {
          border: 'border-[#3d484e] bg-[#10131a] text-[#879299]',
          icon: <span className="font-mono text-[#39bae6] font-bold">&gt;&gt;</span>,
          titleColor: 'text-[#879299]',
        },
      };

      const style = calloutStyles[calloutType];

      renderedElements.push(
        <div
          key={`callout-${renderedElements.length}`}
          className={`my-4 rounded-lg border-l-4 ${style.border} p-4 font-mono text-xs sm:text-[13px] leading-relaxed shadow-sm`}
        >
          {title && (
            <div className={`flex items-center gap-2 font-bold mb-2 ${style.titleColor}`}>
              {style.icon}
              <span className="uppercase tracking-wider text-[11px]">{title}</span>
            </div>
          )}
          <div className="space-y-1 text-[#bdc8cf]">
            {remainingContent.map((rLine, rIdx) => (
              <p key={rIdx}>{renderInlineFormatted(rLine)}</p>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // 4. Images: ![alt](url "caption")
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      const caption = imageMatch[3] || alt;

      renderedElements.push(
        <div
          key={`img-${renderedElements.length}`}
          className="group/img relative my-6 overflow-hidden rounded-lg border border-[#242936] bg-[#0c0f16] transition-all hover:border-[#39bae6]/50"
        >
          <img
            src={src}
            alt={alt}
            onClick={() => setZoomedImage({ src, alt, caption })}
            className="max-h-[480px] w-full cursor-zoom-in object-contain transition-transform duration-300 group-hover/img:scale-[1.01]"
            loading="lazy"
          />

          {/* Minimal label + zoom, overlaid on the frame */}
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-[#0b0e15]/80 px-2 py-0.5 font-mono text-[10px] tracking-wider text-[#879299] opacity-0 transition-opacity group-hover/img:opacity-100">
            captura
          </span>
          <button
            onClick={() => setZoomedImage({ src, alt, caption })}
            className="absolute right-2 top-2 flex items-center gap-1 rounded border border-[#242936] bg-[#0b0e15]/85 px-2 py-1 font-mono text-[10px] text-[#879299] opacity-0 transition-all hover:border-[#39bae6] hover:text-[#6ad5ff] group-hover/img:opacity-100"
            title="Ampliar captura"
          >
            <Maximize2 className="h-3 w-3" />
            <span>ZOOM</span>
          </button>
        </div>
      );
      i++;
      continue;
    }

    // 5. Tables: lines starting with |
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        // row 1 is separator |---|---|
        const bodyRows = tableLines.slice(2).map((rowStr) =>
          rowStr
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );

        renderedElements.push(
          <div key={`table-${renderedElements.length}`} className="my-5 overflow-x-auto rounded-lg border border-[#242936] bg-[#0c0f16]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-[#1b1f29] bg-[#121622] text-[#6ad5ff]">
                <tr>
                  {headerRow.map((th, thIdx) => (
                    <th key={thIdx} className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">
                      {renderInlineFormatted(th)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1f29]">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#151924] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 text-[#bdc8cf]">
                        {renderInlineFormatted(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 6. Checklists / Tasks: - [ ] or - [x]
    const taskMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      const text = taskMatch[2];

      renderedElements.push(
        <div
          key={`task-${renderedElements.length}`}
          className="my-1.5 flex items-center gap-3 rounded border border-[#1b1f29] bg-[#0c0f16] px-3.5 py-2 font-mono text-xs transition-colors hover:border-[#39bae6]/30"
        >
          <div
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              isChecked
                ? 'border-[#7edc73] bg-[#7edc73]/20 text-[#7edc73]'
                : 'border-[#3d484e] bg-[#10131a] text-transparent'
            }`}
          >
            {isChecked && <Check className="h-3 w-3" />}
          </div>
          <span className={isChecked ? 'text-[#e0e2ec] line-through decoration-[#7edc73]/40' : 'text-[#bdc8cf]'}>
            {renderInlineFormatted(text)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Bullet lists: - item or * item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* ')) &&
        !lines[i].trim().match(/^-\s+\[([ xX])\]/)
      ) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }

      renderedElements.push(
        <ul key={`list-${renderedElements.length}`} className="my-3 space-y-1.5 font-mono text-xs sm:text-[13px] text-[#bdc8cf]">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="text-[#39bae6] select-none mt-0.5">›</span>
              <div className="flex-1 leading-relaxed">{renderInlineFormatted(item)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Numbered lists: 1. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const numberedItems: { num: string; text: string }[] = [];
      while (i < lines.length && lines[i].trim().match(/^(\d+)\.\s+(.+)$/)) {
        const m = lines[i].trim().match(/^(\d+)\.\s+(.+)$/)!;
        numberedItems.push({ num: m[1], text: m[2] });
        i++;
      }

      renderedElements.push(
        <ol key={`ol-${renderedElements.length}`} className="my-3 space-y-2 font-mono text-xs sm:text-[13px]">
          {numberedItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="rounded border border-[#1b1f29] bg-[#10141c] px-1.5 py-0.5 text-[10px] font-bold text-[#39bae6] select-none shrink-0">
                [{item.num.padStart(2, '0')}]
              </span>
              <div className="flex-1 text-[#bdc8cf] leading-relaxed pt-0.5">
                {renderInlineFormatted(item.text)}
              </div>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Horizontal Rule: --- or ***
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      renderedElements.push(
        <div key={`hr-${renderedElements.length}`} className="my-8 flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#242936] to-transparent" />
          <span className="font-mono text-[10px] text-[#5a6673] tracking-widest">// SEC_SECTION_DIVIDER //</span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#242936] to-transparent" />
        </div>
      );
      i++;
      continue;
    }

    // 10. Empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // 11. Regular paragraph
    renderedElements.push(
      <p
        key={`p-${renderedElements.length}`}
        className="my-3 font-mono text-xs sm:text-[13.5px] leading-relaxed text-[#bdc8cf]"
      >
        {renderInlineFormatted(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div className="markdown-prose space-y-2 selection:bg-[#39bae6]/20 selection:text-white">
      {renderedElements}

      {/* Image Modal Lightbox — portaled to document.body so the fixed
          overlay covers the whole viewport (the article card's backdrop-blur
          would otherwise trap it and misalign the zoom). */}
      {zoomedImage &&
        createPortal(
          <div
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] max-w-5xl rounded-lg border border-[#39bae6]/40 bg-[#0d1017] p-4 shadow-2xl"
            >
              <div className="flex justify-end border-b border-[#1b1f29] pb-3 mb-3">
                <button
                  onClick={() => setZoomedImage(null)}
                  className="rounded border border-[#242936] bg-[#161a24] px-2 py-1 font-mono text-[11px] text-[#879299] hover:text-white"
                >
                  CERRAR [ESC]
                </button>
              </div>
              <img
                src={zoomedImage.src}
                alt={zoomedImage.alt}
                className="max-h-[78vh] w-full rounded object-contain"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

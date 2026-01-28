import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { fetchWriteup } from '../lib/content';
import { WriteupContent } from '../types';

const formatMachineName = (slug?: string) => {
  if (!slug) return '';
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

// Helper to extract plain text
const getNodeText = (node: any): string => {
  if (['string', 'number'].includes(typeof node)) return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node === 'object' && node?.props?.children)
    return getNodeText(node.props.children);
  return '';
};

// Helper to generate slug
const generateSlug = (text: string) =>
  text
    .replace(/[*_`\[\]]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

const MarkdownImage = ({ src, alt, ...props }: any) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [retry, setRetry] = useState(false);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setRetry(false);
    setError(false);
    setZoomed(false);
  }, [src]);

  const handleError = () => {
    if (!retry && src && src.startsWith('/images/')) {
      setImgSrc(`/public${src}`);
      setRetry(true);
    } else {
      setError(true);
    }
  };

  if (error) {
    return (
      <span className="block my-8 p-4 border border-nord11/30 bg-nord11/10 rounded-lg text-center">
        <span className="material-symbols-outlined text-nord11 text-2xl mb-2">
          broken_image
        </span>
        <span className="block text-nord11 text-xs font-mono">
          Image not found: {src}
        </span>
      </span>
    );
  }

  return (
    <>
      {/* Imagen normal */}
      <figure className="block my-8 group cursor-zoom-in">
        <img
          {...props}
          key={imgSrc}
          src={imgSrc}
          alt={alt}
          onError={handleError}
          loading="lazy"
          onClick={() => setZoomed(true)}
          className="w-full h-auto object-contain max-h-[600px] mx-auto transition-all"
        />
      </figure>

      {/* Overlay Zoom */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setZoomed(false)}
        >
          {/* Botón cerrar */}
          <button
            className="absolute top-6 right-6 text-white hover:text-nord11 transition"
            onClick={() => setZoomed(false)}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>

          {/* Imagen ampliada */}
          <img
            src={imgSrc}
            alt={alt}
            className="max-w-full max-h-full object-contain shadow-2xl cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const Heading = ({ level, children, ...props }: any) => {
  const text = getNodeText(children);
  const id = generateSlug(text);
  const Tag = `h${level}` as any;
  return (
    <Tag id={id} className="scroll-mt-28" {...props}>
      {children}
    </Tag>
  );
};

const CodeBlock = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(getNodeText(children)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group my-6">
      <pre
        {...props}
        className="
          bg-[#0b0f14]
          text-[#d8dee9]
          font-mono
          text-sm
          leading-relaxed
          p-5
          rounded-xl
          border border-nord3/30
          overflow-x-auto
          shadow-inner
        "
      >
        {children}
      </pre>

      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-nord4 hover:text-nord8 opacity-0 group-hover:opacity-100 transition"
      >
        <span className="material-symbols-outlined text-sm">
          {copied ? 'check' : 'content_copy'}
        </span>
      </button>
    </div>
  );
};

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

const WriteupViewPage: React.FC = () => {
  const { platformId, slug } = useParams<{ platformId: string; slug: string }>();
  const [data, setData] = useState<WriteupContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [toc, setToc] = useState<TOCItem[]>([]);

  useEffect(() => {
    if (!platformId || !slug) return;
    setLoading(true);
    fetchWriteup(platformId, slug).then(result => {
      setData(result);
      setLoading(false);
    });
  }, [platformId, slug]);

  useEffect(() => {
    if (!data?.content) return;

    const regex = /^(#{1,3})\s+(.+)$/gm;
    const items: TOCItem[] = [];

    for (const match of data.content.matchAll(regex)) {
      const level = match[1].length;
      const cleanText = match[2].replace(/[*_`\[\]]/g, '').trim();
      items.push({
        id: generateSlug(cleanText),
        text: cleanText,
        level,
      });
    }

    setToc(items);
  }, [data]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-nord8 animate-pulse">
        Decryption in progress...
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-nord11">
        File not found
      </div>
    );

  // 🔒 BLINDAJE REAL
  const safeTags = Array.isArray(data.tags) ? data.tags : [];

  return (
    <div className="flex-1 relative">
      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 flex flex-col lg:flex-row gap-12 relative">
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-32 p-6 rounded-lg bg-deep-card/40 border border-nord3/20 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-6 text-nord8">
              <span className="material-symbols-outlined text-sm">segment</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                Metadata
              </span>
            </div>

            <div className="space-y-4 text-sm font-mono text-nord4/70">
              <div className="flex justify-between">
                <span className="text-nord9">Date: {data.date || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nord14">Level: {data.level || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nord4">Platform: {platformId}</span>
              </div>
              <div>
                <span className="block mb-2">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {safeTags.map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-nord3/40 rounded text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {toc.length > 0 && (
              <div className="mt-8 pt-6 border-t border-nord3/10">
                <div className="flex items-center gap-2 mb-4 text-nord8">
                  <span className="material-symbols-outlined text-sm">toc</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Index
                  </span>
                </div>
                <nav className="flex flex-col gap-1">
                 {toc.map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(item.id);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className={`text-xs cursor-pointer hover:text-nord8
                      ${item.level === 1 ? 'text-nord6 font-bold' : ''}
                      ${item.level === 2 ? 'text-nord4/80 pl-3' : ''}
                      ${item.level === 3 ? 'text-nord4/60 pl-6 text-[11px]' : ''}
                    `}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>

              </div>
            )}

            <div className="mt-8 pt-6 border-t border-nord3/10">
              <Link
                to={`/machines/${platformId}`}
                className="flex items-center gap-2 text-[10px] font-mono text-nord3 hover:text-nord8"
              >
                <span className="material-symbols-outlined text-sm">
                  arrow_back
                </span>
                RETURN TO LIST
              </Link>
            </div>
          </div>
        </aside>

        <article className="flex-1 max-w-[800px] markdown-content">
          <header className="mb-12">
    <h1 className=" uppercase text-9xl font-black text-nord6 tracking-tight">
      {formatMachineName(slug)}
    </h1>
    <div className="mt-6 h-px bg-gradient-to-r from-nord3/40 via-nord3/10 to-transparent" />
  </header>
          <ReactMarkdown
            components={{
              img: props => <MarkdownImage {...props} />,
              h1: props => <Heading level={1} {...props} />,
              h2: props => <Heading level={2} {...props} />,
              h3: props => <Heading level={3} {...props} />,
              pre: props => <CodeBlock {...props} />,
            }}
          >
            {data.content}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
};

export default WriteupViewPage;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecentWriteups } from '../lib/content';
import { WriteupIndexItem } from '../types';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [recentWriteups, setRecentWriteups] = useState<WriteupIndexItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentWriteups(3).then(data => {
      setRecentWriteups(data);
      setLoading(false);
    });
  }, []);

  // Helper to generate a consistent looking pseudo-hash from slug
  const getPseudoHash = (slug: string) => {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = slug.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '0x' + '00000'.substring(0, 6 - c.length) + c + '...';
  };

  // Helper to pick an icon based on tags/platform
  const getIcon = (item: WriteupIndexItem) => {
    const tags = Array.isArray(item.tags)
      ? item.tags.map(t => t.toUpperCase())
      : [];

    if (tags.includes('WINDOWS')) return 'window';
    if (tags.includes('ANDROID')) return 'android';
    if (item.platform.toLowerCase() === 'hackthebox') return 'deployed_code';
    return 'terminal';
  };

  return (
    <main className="flex-1 flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-[1200px] space-y-12">
        <section className="w-full">
          <div className="rounded-xl border border-nord3/30 bg-nord1/40 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-nord1/80 px-4 py-2 flex items-center justify-between border-b border-nord3/20">
              <div className="flex gap-2">
                <div className="size-3 rounded-full bg-nord11"></div>
                <div className="size-3 rounded-full bg-nord12"></div>
                <div className="size-3 rounded-full bg-nord14"></div>
              </div>
              <span className="text-[10px] text-nord3 uppercase tracking-widest font-bold">
                zsh — deep-sea-v3
              </span>
              <div className="w-12"></div>
            </div>

            <div className="p-8 md:p-16 min-h-[450px] flex flex-col justify-end bg-gradient-to-br from-nord1/20 to-deep-bg">
              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-nord9 font-bold">➜</span>
                    <span className="text-nord7 font-bold">~</span>
                    <h1 className="text-nord6 text-4xl md:text-6xl font-black leading-tight tracking-tighter blinking-cursor">
                      whoami
                    </h1>
                  </div>
                  <div className="mt-6 border-l-2 border-nord8 pl-6 py-2">
                    <p className="text-nord4 text-lg md:text-xl font-medium tracking-wide space-y-2">
                      <span className="text-nord8">[USER]</span> Stark <br />
                      <span className="text-nord8">[ATTR]</span> Autodidacta en proceso <br />
                      <span className="text-nord8">[INFO]</span> Hackeando el sistema (legalmente)
                    </p>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => navigate('/directory')}
                    className="group flex items-center justify-center overflow-hidden rounded h-14 px-10 bg-nord8 text-deep-bg text-base font-black uppercase tracking-widest hover:bg-nord9 hover:shadow-[0_0_25px_rgba(136,192,208,0.5)] transition-all transform hover:-translate-y-1"
                  >
                    <span className="truncate">access_mainframe</span>
                    <span className="material-symbols-outlined ml-2 group-hover:translate-x-2 transition-transform">
                      terminal
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <div className="h-px bg-nord3/20 grow"></div>
          <h2 className="text-nord8 text-sm font-black tracking-[0.3em] uppercase whitespace-nowrap">
            News Writeups
          </h2>
          <div className="h-px bg-nord3/20 grow"></div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="font-mono text-nord3 animate-pulse">
              Scanning database...
            </span>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentWriteups.map((item, idx) => {
              const safeTags = Array.isArray(item.tags) ? item.tags : [];

              return (
                <div
                  key={idx}
                  onClick={() =>
                    navigate(`/writeup/${item.platform}/${item.slug}`)
                  }
                  className="flex flex-col gap-4 rounded-xl border border-nord3/30 bg-deep-card/50 p-6 hover:border-nord8/40 hover:bg-deep-card transition-all group cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-2">
                    <span className="material-symbols-outlined text-nord14/20 group-hover:text-nord14/40 transition-colors text-4xl">
                      verified
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded bg-nord1/50 flex items-center justify-center border border-nord3/30">
                      <span className="material-symbols-outlined text-nord8">
                        {getIcon(item)}
                      </span>
                    </div>
                    <div>
                      <p className="text-nord9 text-[10px] font-bold tracking-widest uppercase">
                        {item.platform}
                      </p>
                      <h3 className="text-nord6 text-xl font-bold truncate max-w-[180px]">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-nord4/60 text-xs font-mono">
                      HASH: {getPseudoHash(item.slug)}
                    </p>
                    <p className="text-nord3 text-[10px] font-bold uppercase tracking-tighter">
                      Date: {item.date}
                    </p>
                  </div>

                  <div className="pt-2 flex gap-2 flex-wrap">
                    {safeTags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 ${
                          tag.toUpperCase() === 'HARD'
                            ? 'bg-nord11/10 text-nord11'
                            : 'bg-nord10/10 text-nord10'
                        } text-[10px] rounded border border-current font-bold`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {recentWriteups.length === 0 && (
              <div className="col-span-3 text-center text-nord3 font-mono border border-nord3/20 rounded p-8">
                [NULL] No writeups found in the archives.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default HomePage;


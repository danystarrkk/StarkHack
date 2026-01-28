import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlatforms, fetchIndex } from '../lib/content';
import { PlatformStats, WriteupIndexItem } from '../types';

// Garantiza siempre array de strings
const safeTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) {
    return tags.filter(t => typeof t === 'string');
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
};

// Garantiza string seguro
const safeString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const DirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [allWriteups, setAllWriteups] = useState<WriteupIndexItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch both platforms stats and the full index for searching
    Promise.all([getPlatforms(), fetchIndex()]).then(([platformsData, indexData]) => {
    setPlatforms(Array.isArray(platformsData) ? platformsData : []);
    setAllWriteups(Array.isArray(indexData) ? indexData : []);
    setLoading(false);
});

  }, []);

  const getLevelColorClass = (level?: string) => {
    const l = level?.toLowerCase() || 'easy';
    switch(l) {
        case 'easy': return 'text-nord14 border-nord14/30 bg-nord14/10';
        case 'hard': return 'text-nord11 border-nord11/30 bg-nord11/10';
        case 'medium': return 'text-nord13 border-nord13/30 bg-nord13/10';
        default: return 'text-nord9 border-nord9/30 bg-nord9/10';
    }
  };

  const filteredResults = allWriteups.filter(item => {
  if (!searchQuery) return false;
  const q = searchQuery.toLowerCase();
  
  // Check various fields
  const inTitle = safeString(item.title).toLowerCase().includes(q);
  const inPlatform = safeString(item.platform).toLowerCase().includes(q);
  const inLevel = safeString(item.level).toLowerCase().includes(q);
  const inSlug = safeString(item.slug).toLowerCase().includes(q);
  const inDescription = safeString(item.description).toLowerCase().includes(q);
  const inTags = safeTags(item.tags).some(tag =>
    tag.toLowerCase().includes(q)
  );

  return inTitle || inPlatform || inLevel || inSlug || inTags || inDescription;
});


  return (
    <main className="flex flex-1 justify-center py-10 px-4 md:px-10 lg:px-40">
      <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
        <div className="mb-8">
          <h1 className="text-nord6 tracking-tight text-[32px] md:text-[40px] font-bold leading-tight px-4 pb-1">
            Writeups
          </h1>
          <p className="px-4 text-nord9/80 text-sm md:text-base font-medium">Accessing high-security documentation repository...</p>
        </div>
        
        {/* Search Bar */}
        <div className="px-3 py-0 mb-10 bg-deep-card/80 rounded-3xl border border-nord3/20 terminal-glow-nord backdrop-blur-sm">
          <div className="py-3">
            <label className="flex flex-col min-w-40 h-16 w-full group">
              <div className={`flex w-full flex-1 items-stretch rounded-2xl h-full overflow-hidden border transition-all duration-300 bg-deep-search shadow-inner ${searchQuery ? 'border-nord8 ring-2 ring-nord8/20' : 'border-nord3/30 focus-within:border-nord7 focus-within:ring-2 focus-within:ring-nord7/20'}`}>
                <div className={`flex items-center justify-center pl-6 transition-colors ${searchQuery ? 'text-nord8' : 'text-nord7'}`}>
                  <span className="material-symbols-outlined scale-100">search</span>
                </div>
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex w-full min-w-0 flex-1 bg-transparent px-3 pl-3 text-nord4 text-xl text-[16px] leading-normal placeholder:text-nord3/60 border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none appearance-none [-webkit-appearance:none] [-moz-appearance:none]"
                  placeholder="Search archives (name, tag, level, platform)..." 
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="pr-6 text-nord3 hover:text-nord11 transition-colors flex items-center"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="px-4">
          {loading ? (
             <div className="text-nord3 font-mono p-4 animate-pulse">Scanning filesystem...</div>
          ) : (
            <>
              {/* Conditional View: Search Results OR Platform Grid */}
              {searchQuery ? (
                // SEARCH RESULTS VIEW
                <div>
                  <div className="flex items-center gap-3 pb-6 pt-2">
                    <span className="material-symbols-outlined text-nord8">filter_list</span>
                    <h2 className="text-nord6 text-[22px] font-bold leading-tight tracking-[-0.015em] uppercase">
                      Search Results <span className="text-nord3 text-lg ml-2 normal-case">({filteredResults.length} found)</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-16">
                    {filteredResults.map((machine, i) => (
                      <div key={i} className="group relative flex flex-col bg-deep-card border border-nord3/20 rounded overflow-hidden shadow-xl hover:-translate-y-2 transition-all">
                        <div className="aspect-video w-full bg-nord0 relative overflow-hidden">
                          {machine.image ? (
                            <img className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all duration-700" src={machine.image} alt={machine.title} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-deep-search">
                              <span className="material-symbols-outlined text-4xl text-nord3">terminal</span>
                            </div>
                          )}
                          <div className="absolute top-2 right-2">
                            <span className="bg-deep-bg/80 backdrop-blur text-nord6 text-[10px] font-bold px-2 py-1 rounded border border-nord3/30 uppercase">
                              {machine.platform}
                            </span>
                          </div>
                        </div>
                        <div className="p-5 flex flex-col gap-4 flex-1">
                          <div className="flex justify-between items-start">
                            <h3 className="text-lg font-bold text-nord6 group-hover:text-nord9 transition-colors line-clamp-1" title={machine.title}>{machine.title}</h3>
                            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${getLevelColorClass(machine.level)} whitespace-nowrap`}>{machine.level || 'Unk'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-auto">
                              {safeTags(machine.tags).slice(0,3).map(tag => (
                              <span key={tag} className="text-[9px] text-nord4/60 border border-nord3/20 px-1 rounded">
                              {tag}
                              </span>
))}
                          </div>
                          <button onClick={() => navigate(`/writeup/${machine.platform}/${machine.slug}`)} className="mt-2 w-full py-2.5 border border-nord9/40 text-nord9 text-xs font-black uppercase tracking-[0.2em] hover:bg-nord9 hover:text-nord0 rounded flex items-center justify-center gap-2 transition-colors">
                            <span className="material-symbols-outlined text-sm">visibility</span> Read
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {filteredResults.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-16 border border-dashed border-nord3/30 rounded-lg bg-nord1/10 text-nord4/50">
                        <span className="material-symbols-outlined text-4xl mb-4 text-nord3">search_off</span>
                        <p className="font-mono text-lg">No assets found matching query "{searchQuery}"</p>
                        <p className="text-sm mt-2">Try different keywords or tags.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // DEFAULT PLATFORMS VIEW
                <div>
                  <div className="flex items-center gap-3 pb-6 pt-2">
                    <span className="material-symbols-outlined text-nord7">folder_open</span>
                    <h2 className="text-nord6 text-[22px] font-bold leading-tight tracking-[-0.015em] uppercase">platforms</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {platforms.map(platform => (
                      <div 
                        key={platform.id}
                        onClick={() => navigate(`/machines/${platform.id}`)} 
                        className="flex flex-col bg-deep-card p-8 rounded nord-border-blue transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-8 relative z-10">
                          <div className="size-16 bg-deep-search rounded-lg flex items-center justify-center border border-nord3/20 group-hover:border-nord7/30">
                            <span className="material-symbols-outlined text-4xl text-nord7">hub</span>
                          </div>
                          <div className="text-right">
                            <p className="text-nord14 text-[10px] font-black flex items-center gap-1.5 tracking-[0.2em]">
                              <span className="size-1.5 rounded-full bg-nord14 animate-pulse"></span> {platform.count} NODES
                            </p>
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold frosty-glow mb-3 capitalize">{platform.name}</h3>
                        <p className="text-nord4/60 text-sm mb-8 leading-relaxed font-medium">Access encrypted writeups and methodology for {platform.name} environments.</p>
                        <div className="mt-auto pt-6 border-t border-nord3/10 flex justify-end">
                          <div className="flex items-center gap-2 px-4 py-2 rounded border border-nord3/30 group-hover:bg-nord7 group-hover:text-deep-bg group-hover:border-nord7 transition-all">
                            <span className="text-xs font-black uppercase tracking-widest">Entrar</span>
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {platforms.length === 0 && (
                      <div className="col-span-2 border border-nord11/30 bg-nord11/10 p-6 rounded text-nord11 font-mono">
                        [ERROR] No platforms found. Ensure 'public/index.json' exists.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default DirectoryPage;

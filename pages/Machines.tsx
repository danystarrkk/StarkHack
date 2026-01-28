import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMachinesByPlatform } from '../lib/content';
import { WriteupIndexItem } from '../types';

const MachineListingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { platformId } = useParams<{ platformId: string }>();
  const [machines, setMachines] = useState<WriteupIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'latest'>('all');

  useEffect(() => {
    if (platformId) {
      setLoading(true);
      getMachinesByPlatform(platformId).then(data => {
        const sortedData = data.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setMachines(sortedData);
        setLoading(false);
      });
    }
  }, [platformId]);

  const getLevelColorClass = (level?: string) => {
    const l = level?.toLowerCase() || 'easy';
    switch (l) {
      case 'easy': return 'text-nord14 border-nord14/30 bg-nord14/10';
      case 'hard': return 'text-nord11 border-nord11/30 bg-nord11/10';
      case 'medium': return 'text-nord13 border-nord13/30 bg-nord13/10';
      default: return 'text-nord9 border-nord9/30 bg-nord9/10';
    }
  };

  const displayedMachines =
    filterMode === 'latest'
      ? machines.slice(0, 3)
      : machines;

  if (!platformId) return null;

  return (
    <div className="flex flex-1 justify-center py-8 px-6">
      <div className="layout-content-container flex flex-col w-full max-w-[1200px] flex-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2 items-center bg-deep-card/60 px-4 py-2 rounded border border-nord3/20">
            <Link to="/" className="text-nord9 text-sm font-medium hover:text-nord8">Home</Link>
            <span className="text-nord3 text-sm">/</span>
            <Link to="/directory" className="text-nord9 text-sm font-medium hover:text-nord8">Writeups</Link>
            <span className="text-nord3 text-sm">/</span>
            <span className="text-nord0 bg-nord9 px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider">
              {platformId}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6 mb-10">
          <h1 className="text-nord6 tracking-tighter text-4xl font-bold border-l-4 border-nord9 pl-6 py-2 capitalize">
            {platformId}
          </h1>

          <div className="flex gap-1.5 p-1 bg-deep-card border border-nord3/20 rounded-lg max-w-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex-1 h-9 rounded px-5 text-xs uppercase tracking-widest transition-all ${
                filterMode === 'all'
                  ? 'bg-nord9 text-nord0 font-black shadow-lg shadow-nord9/20'
                  : 'text-nord4 font-bold hover:bg-nord1/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('latest')}
              className={`flex-1 h-9 rounded px-5 text-xs uppercase tracking-widest transition-all ${
                filterMode === 'latest'
                  ? 'bg-nord9 text-nord0 font-black shadow-lg shadow-nord9/20'
                  : 'text-nord4 font-bold hover:bg-nord1/50'
              }`}
            >
              Latest
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-nord3 font-mono animate-pulse">
            Loading modules...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {displayedMachines.map((machine, i) => {
              // 🔐 BLINDAJE CRÍTICO (sin cambiar lógica)
              const tagsArray = Array.isArray(machine.tags)
                ? machine.tags
                : typeof machine.tags === 'string'
                  ? [machine.tags]
                  : [];

              return (
                <div
                  key={i}
                  className="group relative flex flex-col bg-deep-card border border-nord3/20 rounded overflow-hidden shadow-xl hover:-translate-y-2 transition-all"
                >
                  <div className="aspect-video w-full bg-nord0 relative overflow-hidden">
                    {machine.image ? (
                      <img
                        className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all duration-700"
                        src={machine.image}
                        alt={machine.title}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-deep-search">
                        <span className="material-symbols-outlined text-4xl text-nord3">
                          terminal
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold text-nord6 group-hover:text-nord9 transition-colors">
                        {machine.title}
                      </h3>
                      <span
                        className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${getLevelColorClass(machine.level)}`}
                      >
                        {machine.level || 'Unk'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {tagsArray.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-[11px] text-nord4/60 border border-nord3/20 px-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate(`/writeup/${platformId}/${machine.slug}`)}
                      className="mt-2 w-full py-2.5 border border-nord9/40 text-nord9 text-[12px] font-black uppercase tracking-[0.2em] hover:bg-nord9 hover:text-nord0 rounded flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Read
                    </button>
                  </div>
                </div>
              );
            })}

            {displayedMachines.length === 0 && (
              <div className="col-span-3 text-nord3 font-mono italic p-4 border border-nord3/20 rounded bg-nord1/20">
                {filterMode === 'latest'
                  ? 'No recent writeups found.'
                  : 'No writeups found for this platform.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineListingsPage;


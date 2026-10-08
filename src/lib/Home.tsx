// Home route element: TerminalHero + real-data NewsWriteups/FeaturedProjects.
//
// The loading logic is PRESERVED verbatim from the old src/App.tsx home tab:
// real content pipeline (public/index.json via lib/content.ts) mapped to UI
// types by the pure adapters in src/lib/contentAdapter.ts. No mock data on
// the Home screen. The only change versus the template is navigation: detail
// selection and "explore all" now navigate to real URLs instead of calling an
// onNavigate(tab) callback / selecting in-memory objects.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TerminalHero } from '../components/TerminalHero';
import { NewsWriteups } from '../components/NewsWriteups';
import { FeaturedProjects } from '../components/FeaturedProjects';
import { getProjects, getRecentWriteups } from '../../lib/content';
import { toUiProject, toUiWriteup } from './contentAdapter';
import { Project, Writeup } from '../types';
import { projectDetailPath, writeupDetailPath } from './paths';
import { useTerminal } from './terminal';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { openTerminal } = useTerminal();

  const [homeWriteups, setHomeWriteups] = useState<Writeup[]>([]);
  const [homeProjects, setHomeProjects] = useState<Project[]>([]);
  const [homeStatus, setHomeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [homeError, setHomeError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadHomeContent = async () => {
      try {
        const [recentWriteups, projects] = await Promise.all([
          getRecentWriteups(3),
          getProjects(),
        ]);
        if (cancelled) return;
        setHomeWriteups(recentWriteups.map(toUiWriteup));
        setHomeProjects(projects.map((item, index) => toUiProject(item, index + 1)));
        setHomeStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setHomeError(error instanceof Error ? error.message : String(error));
        setHomeStatus('error');
      }
    };

    void loadHomeContent();
    return () => {
      cancelled = true;
    };
  }, []);

  const openWriteup = (writeup: Writeup): void => {
    // Never fabricate a URL: pipeline writeups always carry a platformId
    // (toUiWriteup maps it); without one there is no honest detail URL and we
    // fall back to the writeups list.
    if (writeup.platformId) {
      navigate(writeupDetailPath(writeup.platformId, writeup.id));
    } else {
      navigate('/writeups');
    }
  };

  return (
    <div className="space-y-12 sm:space-y-16">
      <TerminalHero onOpenTerminal={openTerminal} />

      {homeStatus === 'loading' && (
        <div className="rounded-lg border border-[#1b1f29] bg-[#10141c] px-6 py-10 text-center">
          <p className="font-mono text-xs text-[#879299]">
            <span className="text-[#39bae6]">&gt;</span> CARGANDO CONTENIDO DESDE /index.json ...
          </p>
        </div>
      )}

      {homeStatus === 'error' && (
        <div className="rounded-lg border border-[#f07178]/30 bg-[#f07178]/5 px-6 py-10 text-center">
          <p className="font-mono text-xs text-[#f07178]">
            <span className="text-[#39bae6]">&gt;</span> ERROR: NO SE PUDO CARGAR EL ÍNDICE DE CONTENIDO
          </p>
          <p className="mt-2 break-words text-[11px] font-mono text-[#879299]">{homeError}</p>
        </div>
      )}

      {homeStatus === 'ready' && (
        <>
          <NewsWriteups
            writeups={homeWriteups}
            onSelectWriteup={openWriteup}
            onExploreAll={() => navigate('/writeups')}
          />

          <FeaturedProjects
            projects={homeProjects}
            onSelectProject={(project) => navigate(projectDetailPath(project.id))}
            onExploreAll={() => navigate('/projects')}
          />
        </>
      )}
    </div>
  );
};

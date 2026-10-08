import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { TerminalHero } from './components/TerminalHero';
import { NewsWriteups } from './components/NewsWriteups';
import { FeaturedProjects } from './components/FeaturedProjects';
import { WriteupsScreen } from './components/WriteupsScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { CertificationsScreen } from './components/CertificationsScreen';
import { AboutScreen } from './components/AboutScreen';
import { Footer } from './components/Footer';
import { WriteupPage } from './components/WriteupPage';
import { ProjectPage } from './components/ProjectPage';
import { WriteupModal } from './components/WriteupModal';
import { MainframeTerminalModal } from './components/MainframeTerminalModal';
import {
  getProjects,
  getRecentWriteups,
} from '../lib/content';
import { toUiProject, toUiWriteup } from './lib/contentAdapter';
import { Writeup, Project } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'writeups' | 'projects' | 'certifications' | 'about'>('certifications');
  const [selectedWriteup, setSelectedWriteup] = useState<Writeup | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Home content: loaded from the real content pipeline (public/index.json via
  // lib/content.ts) and mapped to UI types by the pure adapters in
  // src/lib/contentAdapter.ts. No mock data on the Home screen.
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

  const handleNavigate = (tab: string) => {
    setActiveTab(tab as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0b0e15] text-[#e0e2ec] font-mono selection:bg-[#39bae6]/30 selection:text-[#6ad5ff] flex flex-col justify-between relative overflow-x-hidden">
      {/* Background ambient cyber subtle blueprint & cyan glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-blueprint-grid opacity-60" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-[#39bae6]/[0.045] via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[450px] bg-gradient-to-tl from-[#39bae6]/[0.03] via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          onOpenTerminal={() => setIsTerminalOpen(true)}
        />

        {/* Main Content Area */}
        {selectedWriteup ? (
          <WriteupPage
            writeup={selectedWriteup}
            onBack={() => setSelectedWriteup(null)}
            platformName={selectedWriteup.platformId === 'hackmyvm' ? 'HackMyVM' : 'HackTheBox'}
          />
        ) : selectedProject ? (
          <ProjectPage
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <main
            className={`mx-auto w-full ${
              activeTab === 'certifications' || activeTab === 'about'
                ? 'max-w-7xl px-3 sm:px-5 lg:px-6'
                : 'max-w-6xl px-4 sm:px-6 lg:px-8'
            } pt-8 sm:pt-10 pb-12 flex-1`}
          >
            {/* HOME SCREEN */}
            {activeTab === 'home' && (
              <div className="space-y-12 sm:space-y-16">
                <TerminalHero onOpenTerminal={() => setIsTerminalOpen(true)} />

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
                      onSelectWriteup={(w) => setSelectedWriteup(w)}
                      onExploreAll={() => handleNavigate('writeups')}
                    />

                    <FeaturedProjects
                      projects={homeProjects}
                      onSelectProject={(p) => setSelectedProject(p)}
                      onExploreAll={() => handleNavigate('projects')}
                    />
                  </>
                )}
              </div>
            )}

            {/* WRITEUPS SCREEN (Exact reproduction from user image) */}
            {activeTab === 'writeups' && (
              <WriteupsScreen
                onSelectWriteup={(w) => setSelectedWriteup(w)}
              />
            )}

            {/* PROJECTS SCREEN */}
            {activeTab === 'projects' && (
              <ProjectsScreen
                onSelectProject={(p) => setSelectedProject(p)}
              />
            )}

            {/* CERTIFICATIONS SCREEN */}
            {activeTab === 'certifications' && (
              <CertificationsScreen />
            )}

            {/* ABOUT SCREEN */}
            {activeTab === 'about' && (
              <AboutScreen onOpenTerminal={() => setIsTerminalOpen(true)} />
            )}
          </main>
        )}

        {/* Bottom Telemetry Bar */}
        <Footer />
      </div>

      <MainframeTerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
      />
    </div>
  );
}

import React, { useState } from 'react';
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
  FEATURED_WRITEUPS,
  FEATURED_PROJECTS,
} from './data/portfolioData';
import { Writeup, Project } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'writeups' | 'projects' | 'certifications' | 'about'>('certifications');
  const [selectedWriteup, setSelectedWriteup] = useState<Writeup | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

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

                <NewsWriteups
                  writeups={FEATURED_WRITEUPS}
                  onSelectWriteup={(w) => setSelectedWriteup(w)}
                  onExploreAll={() => handleNavigate('writeups')}
                />

                <FeaturedProjects
                  projects={FEATURED_PROJECTS}
                  onSelectProject={(p) => setSelectedProject(p)}
                  onExploreAll={() => handleNavigate('projects')}
                />
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

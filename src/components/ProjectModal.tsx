import React, { useState } from 'react';
import { Project } from '../types';
import { X, Copy, Check, ExternalLink, Code2, Terminal, BookOpen } from 'lucide-react';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose }) => {
  const [copiedClone, setCopiedClone] = useState(false);
  const [activeTab, setActiveTab] = useState<'readme' | 'code'>('readme');

  if (!project) return null;

  const cloneCommand = `git clone ${project.githubUrl || `https://github.com/starkhack/${project.id}`}.git`;

  const copyClone = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopiedClone(true);
    setTimeout(() => setCopiedClone(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#242936] bg-[#10141c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#141821] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#879299]">
              <span className="text-[#39bae6]">&gt;_</span>
              <span>repo://starkhack/{project.id}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#879299] hover:bg-[#1b1f29] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 font-mono text-xs">
          {/* Top Info */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1b1f29] pb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-sans text-2xl font-bold text-white">{project.title}</h2>
                <span className="rounded border border-[#e6b450]/30 bg-[#e6b450]/10 px-2 py-0.5 text-[11px] font-mono text-[#e6b450]">
                  {project.tagCategory}
                </span>
              </div>
              <p className="mt-2 text-[#bdc8cf] leading-relaxed max-w-xl">
                {project.description}
              </p>
            </div>
          </div>

          {/* Quick Clone Strip */}
          <div className="rounded border border-[#242936] bg-[#07090e] p-3">
            <div className="flex items-center justify-between text-[11px] text-[#5a6673] mb-1">
              <span>GIT CLONE URL:</span>
              <button
                onClick={copyClone}
                className="flex items-center gap-1 text-[#39bae6] hover:text-[#6ad5ff]"
              >
                {copiedClone ? (
                  <>
                    <Check className="h-3 w-3 text-[#7edc73]" />
                    <span className="text-[#7edc73]">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto text-[#6ad5ff] font-mono">{cloneCommand}</pre>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {project.tags.map((t, idx) => (
              <span
                key={idx}
                className="rounded border border-[#1b1f29] bg-[#0d1017] px-2.5 py-1 text-[#bdc8cf]"
              >
                • {t}
              </span>
            ))}
          </div>

          {/* Tabs: Readme vs Source Code */}
          <div>
            <div className="flex items-center gap-2 border-b border-[#1b1f29] pb-2 mb-4">
              <button
                onClick={() => setActiveTab('readme')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  activeTab === 'readme'
                    ? 'bg-[#1b1f29] text-[#39bae6]'
                    : 'text-[#879299] hover:text-white'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>README.md</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  activeTab === 'code'
                    ? 'bg-[#1b1f29] text-[#39bae6]'
                    : 'text-[#879299] hover:text-white'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>main.src</span>
              </button>
            </div>

            {activeTab === 'readme' ? (
              <div className="rounded border border-[#1b1f29] bg-[#0b0e15] p-4 text-[#bdc8cf] space-y-3 leading-relaxed">
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {project.readme || 'No documentation provided.'}
                </pre>
              </div>
            ) : (
              <div className="rounded border border-[#1b1f29] bg-[#07090e] p-4">
                <pre className="overflow-x-auto text-[#7edc73] font-mono text-[11px] leading-relaxed">
                  {project.codeSnippet || '// Source code snippet unavailable'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1b1f29] bg-[#141821] px-5 py-3">
          <div className="text-[11px] text-[#5a6673]">
            LICENCIA: MIT • REPOSITORIO PÚBLICO
          </div>
          <button
            onClick={onClose}
            className="rounded border border-[#242936] px-4 py-1.5 font-mono text-xs text-[#bdc8cf] hover:bg-[#1b1f29] hover:text-white"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

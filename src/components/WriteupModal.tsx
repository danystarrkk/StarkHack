import React, { useState } from 'react';
import { Writeup } from '../types';
import { X, Copy, Check, Terminal, Shield, Lock, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface WriteupModalProps {
  writeup: Writeup | null;
  onClose: () => void;
}

export const WriteupModal: React.FC<WriteupModalProps> = ({ writeup, onClose }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [showFlags, setShowFlags] = useState(false);

  if (!writeup) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#242936] bg-[#10141c] shadow-2xl">
        {/* Modal Window Header */}
        <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#141821] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#879299]">
              <span className="text-[#39bae6]">&gt;_</span>
              <span>writeup://hackthebox/{writeup.title.toLowerCase()}.md</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-[#879299] hover:bg-[#1b1f29] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 font-mono text-xs">
          {/* Machine Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1b1f29] pb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-sans text-2xl font-bold text-white">{writeup.title}</h2>
                <span className="rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 text-[11px] font-mono text-[#39bae6]">
                  {writeup.os}
                </span>
                <span className="rounded border border-[#e6b450]/30 bg-[#e6b450]/10 px-2 py-0.5 text-[11px] font-mono text-[#e6b450]">
                  {writeup.difficulty}
                </span>
              </div>
              <p className="mt-2 text-[#879299]">
                TARGET IP: <span className="text-[#6ad5ff] font-semibold">{writeup.ipAddress || '10.10.11.xxx'}</span> • {writeup.ports}
              </p>
            </div>

            <div className="rounded border border-[#1b1f29] bg-[#0b0e15] px-3 py-2 text-right text-[11px] text-[#5a6673]">
              <div>RELEASE: {writeup.releaseDate || '2024'}</div>
              <div className="text-[#7edc73]">STATUS: PWNED (ROOT)</div>
            </div>
          </div>

          {/* Vulnerability Tags */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#39bae6] mb-2">
              // VULNERABILIDADES IDENTIFICADAS
            </h4>
            <div className="flex flex-wrap gap-2">
              {writeup.vulnerabilities.map((v, i) => (
                <span
                  key={i}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2.5 py-1 text-[#bdc8cf]"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Summary */}
          {writeup.summary && (
            <div className="rounded border border-[#1b1f29] bg-[#0b0e15]/60 p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#e6b450] mb-1">
                // RESUMEN EJECUTIVO DE EXPLOTACIÓN
              </h4>
              <p className="text-[#bdc8cf] leading-relaxed">{writeup.summary}</p>
            </div>
          )}

          {/* Attack Chain Walkthrough */}
          {writeup.steps && writeup.steps.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#39bae6]">
                // CADENA DE ATAQUE & PROCEDIMIENTO
              </h4>

              {writeup.steps.map((step, idx) => (
                <div key={idx} className="rounded border border-[#1b1f29] bg-[#0d1017] p-4 space-y-2.5">
                  <h5 className="font-semibold text-white text-[13px]">{step.phase}</h5>
                  <p className="text-[#879299] leading-relaxed">{step.description}</p>

                  {step.command && (
                    <div className="relative mt-2 rounded border border-[#242936] bg-[#07090e] p-3">
                      <div className="flex items-center justify-between text-[11px] text-[#5a6673] mb-1">
                        <span>COMMAND:</span>
                        <button
                          onClick={() => copyToClipboard(step.command!, `cmd-${idx}`)}
                          className="flex items-center gap-1 text-[#39bae6] hover:text-[#6ad5ff]"
                        >
                          {copiedCmd === `cmd-${idx}` ? (
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
                      <pre className="overflow-x-auto text-[#6ad5ff] font-mono">{step.command}</pre>
                    </div>
                  )}

                  {step.output && (
                    <div className="rounded border border-[#1b1f29] bg-[#090c12] p-2.5">
                      <div className="text-[10px] text-[#5a6673] mb-1">TERMINAL OUTPUT:</div>
                      <pre className="overflow-x-auto text-[#7edc73] font-mono text-[11px]">{step.output}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Captured Flags Section */}
          <div className="rounded border border-[#1b1f29] bg-[#0b0e15] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#7edc73]" />
                <h4 className="font-bold uppercase tracking-wider text-[#7edc73]">
                  // FLAGS CAPTURADAS
                </h4>
              </div>
              <button
                onClick={() => setShowFlags(!showFlags)}
                className="flex items-center gap-1 rounded border border-[#1b1f29] px-2 py-1 text-[11px] text-[#879299] hover:text-white"
              >
                {showFlags ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                <span>{showFlags ? 'OCULTAR FLAGS' : 'REVELAR FLAGS'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded bg-[#10141c] px-3 py-2">
                <span className="text-[#879299]">user.txt:</span>
                <span className="text-[#39bae6] font-mono">
                  {showFlags ? (writeup.userFlag || '9f812030f28e4693a6701bb149c95d21') : '••••••••••••••••••••••••••••••••'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#10141c] px-3 py-2">
                <span className="text-[#879299]">root.txt:</span>
                <span className="text-[#7edc73] font-mono">
                  {showFlags ? (writeup.rootFlag || '4bc84379963da112028fa360c4eb5e70') : '••••••••••••••••••••••••••••••••'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#1b1f29] bg-[#141821] px-5 py-3">
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

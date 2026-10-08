import React, { useState } from 'react';
import { Copy, Check, Terminal, ShieldAlert, Sparkles } from 'lucide-react';

interface TerminalHeroProps {
  onOpenTerminal: () => void;
}

export const TerminalHero: React.FC<TerminalHeroProps> = ({ onOpenTerminal }) => {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const fullFingerprint = '0x9B4E281F0CA4881737461726B';
  const displayFingerprint = '0x9B4E...737461726B';

  const copyFingerprint = () => {
    navigator.clipboard.writeText(fullFingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  return (
    <div className="w-full">
      {/* Outer Terminal Container */}
      <div className="relative overflow-hidden rounded-lg border border-[#1b1f29] bg-[#10141c] shadow-2xl transition-all duration-300 hover:border-[#242936]">
        {/* Subtle top cyan line highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#39bae6]/30 to-transparent" />

        {/* Window Title Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#1b1f29] bg-[#141821] px-4 py-2.5 sm:px-5">
          {/* Left: Window Controls + Shell Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] inline-block" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] inline-block" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#879299]">
              <span className="text-[#39bae6]">&gt;_</span>
              <span>stark@deep-sea:~ (zsh)</span>
              <span className="text-[#39bae6]">•</span>
            </div>
          </div>

          {/* Right: Security & Session Telemetry */}
          <div className="flex items-center gap-3 pt-1 text-[11px] font-mono sm:pt-0">
            <div className="flex items-center gap-1.5 text-[#7edc73]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
              <span className="tracking-wider">TLS 1.3 ENCRYPTED</span>
            </div>
            <span className="text-[#3d484e]">•</span>
            <div className="text-[#879299] tracking-wider">
              SESSION: <span className="text-[#bdc8cf]">#8F2A</span>
            </div>
          </div>
        </div>

        {/* Terminal Content Area */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Command Prompt */}
          <div className="flex items-center gap-2 font-mono text-base sm:text-lg">
            <span className="text-[#39bae6] font-bold">-&gt;</span>
            <span className="text-[#39bae6]">~</span>
            <h1 className="font-mono text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#e0e2ec] flex items-center">
              whoami
              <span className="ml-1 inline-block h-6 sm:h-7 w-2.5 bg-[#39bae6] cursor-blink shadow-[0_0_8px_#39bae6]" />
            </h1>
          </div>

          {/* Telemetry Output Box */}
          <div className="rounded border border-[#1b1f29] bg-[#0b0e15]/70 p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed transition-all">
            {/* Top Right UID/GID info */}
            <div className="flex justify-end text-[11px] text-[#5a6673] pb-2 border-b border-[#1b1f29]/50 mb-3">
              <span>UID: 1000(stark)</span>
              <span className="mx-1.5 text-[#3d484e]">•</span>
              <span>GID: 1000</span>
            </div>

            {/* Structured attributes matching screenshot */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[#39bae6] font-semibold tracking-wide shrink-0">[USER]</span>
                <span className="text-[#e0e2ec] font-medium">Stark</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[#39bae6] font-semibold tracking-wide shrink-0">[ATTR]</span>
                <span className="text-[#bdc8cf]">Autodidacta en proceso</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[#39bae6] font-semibold tracking-wide shrink-0">[INFO]</span>
                <span className="text-[#bdc8cf]">Hackeando el sistema (legalmente)</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                <span className="text-[#39bae6] font-semibold tracking-wide shrink-0">[WELCOME]</span>
                <span className="text-[#bdc8cf]">Bienvenido a mi portafolio | Explora mis writeups, investigaciones y proyectos de ciberseguridad.</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 pt-1">
                <span className="text-[#e6b450] font-semibold tracking-wide shrink-0">[BIO]</span>
                <span className="text-[#bdc8cf] leading-relaxed">
                  Apasionado por la seguridad ofensiva, el análisis de vulnerabilidades y la resolución de máquinas (CTF). Aquí documento mi proceso de aprendizaje, técnicas de intrusión ética y metodologías de defensa.
                </span>
              </div>
            </div>

            {/* Bottom Inner Metadata: Fingerprint & Privileges */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1b1f29] pt-3 text-[11px]">
              <button
                onClick={copyFingerprint}
                className="group flex items-center gap-1.5 text-[#5a6673] hover:text-[#39bae6] transition-colors"
                title="Copiar fingerprint completo"
              >
                <span>FINGERPRINT: {displayFingerprint}</span>
                {copiedFingerprint ? (
                  <Check className="h-3 w-3 text-[#7edc73]" />
                ) : (
                  <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                )}
              </button>

              <div className="flex items-center gap-1.5 font-semibold text-[#7edc73]">
                <span className="h-2 w-2 rounded-full bg-[#7edc73] shadow-[0_0_8px_#7edc73]" />
                <span>PRIVILEGES: ELEVATED</span>
              </div>
            </div>
          </div>

          {/* Terminal Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Primary Mainframe Button */}
            <button
              onClick={onOpenTerminal}
              className="group relative inline-flex items-center justify-center gap-2 rounded bg-[#39bae6] px-5 py-2.5 font-mono text-xs font-bold text-[#0b0e15] shadow-[0_0_16px_rgba(57,186,230,0.35)] transition-all duration-200 hover:bg-[#59c2ff] hover:shadow-[0_0_22px_rgba(57,186,230,0.55)] active:translate-y-[1px]"
            >
              <span>ACCESS_MAINFRAME &gt;_</span>
            </button>

            {/* Telemetry Buffer State */}
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#5a6673]">
              <span>TYPE: PTY/0</span>
              <span className="text-[#3d484e]">•</span>
              <span>
                BUFFER: <span className="font-semibold text-[#7edc73]">FLUSHED</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

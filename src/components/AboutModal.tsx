import React from 'react';
import { X, User, Shield, Terminal, Globe, Mail, Github, Heart } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#242936] bg-[#10141c] shadow-2xl">
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
              <span>profile://identity/stark.json</span>
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 font-mono text-xs">
          <div className="flex items-center gap-4 border-b border-[#1b1f29] pb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded border border-[#39bae6]/40 bg-[#0d1017] text-[#39bae6] text-xl font-bold shadow-[0_0_16px_rgba(57,186,230,0.3)]">
              &gt;_
            </div>
            <div>
              <h2 className="font-sans text-xl font-bold text-white">Stark</h2>
              <p className="text-[#39bae6]">Security Researcher & Ethical Hacker</p>
              <p className="text-[10px] text-[#5a6673]">LOCALIDAD: Cyber Espacio / Red Team Lab</p>
            </div>
          </div>

          <div className="space-y-3 leading-relaxed text-[#bdc8cf]">
            <p>
              ¡Hola! Soy Stark, un apasionado autodidacta de la ciberseguridad ofensiva y el análisis forense. Mi enfoque principal radica en el estudio minucioso de vectores de ataque web, evasión defensiva en entornos modernos, arquitectura de Active Directory y desarrollo de herramientas de automatización.
            </p>
            <p>
              Creo firmemente en el aprendizaje continuo a través de retos prácticos (CTFs en HackTheBox y TryHackMe), documentación abierta y el código abierto para empoderar a la comunidad defensiva.
            </p>
          </div>

          {/* Core Arsenal */}
          <div className="rounded border border-[#1b1f29] bg-[#0d1017] p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#39bae6]">
              // ARSENAL & ESPECIALIDADES
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#879299]">
              <div>• Web Application Pentesting</div>
              <div>• Active Directory Red Teaming</div>
              <div>• Memory Injections & EDR Evasion</div>
              <div>• Linux & Windows Privilege Escalation</div>
              <div>• Reverse Engineering & Binary Exploitation</div>
              <div>• Custom Tooling (Python, Rust, Go, Bash)</div>
            </div>
          </div>

          {/* Social / Contact Grid */}
          <div className="rounded border border-[#1b1f29] bg-[#0b0e15] p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#e6b450]">
              // CANALES DE CONTACTO & REDES
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] p-2 text-[#bdc8cf] hover:border-[#39bae6] hover:text-[#39bae6]"
              >
                <Github className="h-4 w-4" />
                <span>github.com/starkhack</span>
              </a>
              <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] p-2 text-[#bdc8cf]">
                <Mail className="h-4 w-4 text-[#39bae6]" />
                <span>stark@deep-sea.local</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#1b1f29] bg-[#141821] px-5 py-3 font-mono text-xs">
          <button
            onClick={onClose}
            className="rounded border border-[#242936] px-4 py-1.5 text-[#bdc8cf] hover:bg-[#1b1f29] hover:text-white"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

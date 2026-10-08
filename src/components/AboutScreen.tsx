import React, { useState } from 'react';
import {
  Shield,
  Terminal,
  Mail,
  Code,
  Bug,
  Share2,
  ArrowRight,
} from 'lucide-react';

interface AboutScreenProps {
  // No props: contact happens through the GitHub / LinkedIn / Email cards.
}

export const AboutScreen: React.FC<AboutScreenProps> = () => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const emailAddress = 'stark@starkhack.local';

  const handleCopyEmail = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(emailAddress);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2200);
  };

  return (
    <div className="w-full space-y-8 font-mono">
      {/* Top Breadcrumb & Clearance Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#879299]">
          <span className="text-[#39bae6] font-bold">~#</span>
          <span className="tracking-wider">HOME / OPERATOR / ABOUT_ME</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 text-[11px] text-[#879299]">
            [ DOSSIER: UNLOCKED ]
          </div>
          <div className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 text-[11px] text-[#7edc73] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span>CLEARANCE: LEVEL_4 // PUBLIC_RECORD</span>
          </div>
        </div>
      </div>

      {/* Title & Badges Row */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-[#6ad5ff] to-[#7edc73] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(106,213,255,0.35)]">
            ABOUT ME
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded border border-[#7edc73]/30 bg-[#7edc73]/10 px-2.5 py-1 text-xs text-[#7edc73] font-medium">
              [ IDENTITY: VERIFIED ]
            </div>

            <div className="rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2.5 py-1 text-xs text-[#39bae6] font-medium">
              [ ROLE: SECURITY RESEARCHER ]
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-[13px] text-[#879299] max-w-4xl leading-relaxed">
          // Presentación personal y perfil técnico multidisciplinar: desarrollo de software, ciberseguridad, scripting y administración de sistemas.
        </p>
      </div>

      {/* Main Top Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left Column: Operator Profile Card (5 cols on lg) */}
        <div className="lg:col-span-5 rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 sm:p-6 flex flex-col space-y-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.7)]">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl border border-[#39bae6]/40 bg-[#0d1017] text-[#39bae6] shadow-[0_0_20px_rgba(57,186,230,0.25)] shrink-0">
              <Shield className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-sans text-2xl font-bold text-white tracking-tight">STARK</h2>
                <span className="rounded border border-[#39bae6]/30 bg-[#141821] px-2 py-0.5 text-xs font-mono font-semibold text-[#39bae6]">
                  0x4E7
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#7edc73] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
                <span>DISPONIBLE // NETWORKING &amp; COLABORACIONES</span>
              </div>

              <div className="text-xs font-mono text-[#879299]">
                Software, Seguridad &amp; Sistemas
              </div>
            </div>
          </div>

          {/* Key Value Metadata Table */}
          <div className="space-y-2.5 text-xs font-mono border-y border-[#1b1f29] py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5a6673]">[ALIAS]</span>
              <span className="text-white font-semibold">Stark</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <span className="text-[#5a6673] shrink-0">[PERFIL]</span>
              <span className="text-[#39bae6] font-semibold text-right">
                Cursando Ing. Tecnologías de la Información
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <span className="text-[#5a6673] shrink-0">[INTERESES]</span>
              <span className="text-[#7edc73] font-medium text-right">
                Web, Pentesting, Automatización y Redes
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5a6673] shrink-0">[ESTADO]</span>
              <span className="text-[#bdc8cf] text-right">
                Abierto a nuevos retos y conexiones
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[#5a6673]">[UBICACIÓN]</span>
              <span className="text-[#bdc8cf]">Ecuador</span>
            </div>
          </div>

          {/* Contact links live in the GitHub / LinkedIn / Email cards below */}
        </div>

        {/* Right Column: Terminal Presentation & Stats Card (7 cols on lg) */}
        <div className="lg:col-span-7 rounded-xl border border-[#1b1f29] bg-[#10141c] overflow-hidden flex flex-col justify-between shadow-[0_4px_24px_-4px_rgba(0,0,0,0.7)]">
          {/* Terminal Chrome Bar */}
          <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#141821] px-5 py-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#39bae6] font-semibold">
              <Terminal className="h-4 w-4" />
              <span>[ABOUT_ME // PRESENTACIÓN &amp; ENFOQUE]</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3d484e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3d484e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3d484e]" />
            </div>
          </div>

          {/* Presentation Narrative Body */}
          <div className="p-5 sm:p-6 space-y-4 font-mono text-xs sm:text-[13px] leading-relaxed text-[#bdc8cf]">
            <p>
              ¡Hola! Soy <strong className="text-white font-bold">Stark</strong>, actualmente{' '}
              <strong className="text-white font-bold">cursando el Grado en Ingeniería en Tecnologías de la Información</strong> con vocación multidisciplinar y pasión continua por entender cómo funcionan la tecnología y los sistemas desde su base.
            </p>

            <div className="rounded border-l-2 border-[#39bae6] bg-[#0d1017]/80 p-3.5 text-[#e0e2ec] font-mono text-xs sm:text-[13px] leading-relaxed">
              <span className="text-[#39bae6] font-bold mr-1.5">&gt;</span> No creo en encasillarme en una sola etiqueta: disfruto programando aplicaciones web limpias y funcionales, automatizando flujos con Python y Bash, profundizando en protocolos de red y explorando la seguridad ofensiva con un enfoque analítico, ético y riguroso.
            </div>

            <p className="text-[#879299]">
              Este espacio es mi laboratorio personal y cuaderno de bitácora para compartir conocimientos, proyectos y conectar con otros profesionales, entusiastas del software y la ciberseguridad.
            </p>
          </div>

          {/* 4 Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#1b1f29] bg-[#0d1017]/50 divide-x divide-y sm:divide-y-0 divide-[#1b1f29]">
            <div className="p-4 sm:p-5 text-center">
              <div className="font-sans text-2xl sm:text-3xl font-bold text-[#39bae6] mb-1">5+</div>
              <div className="font-mono text-[11px] text-[#879299] leading-tight">
                Áreas Técnicas Dominadas
              </div>
            </div>

            <div className="p-4 sm:p-5 text-center">
              <div className="font-sans text-2xl sm:text-3xl font-bold text-[#7edc73] mb-1">Open</div>
              <div className="font-mono text-[11px] text-[#879299] leading-tight">
                Colaboración &amp; Open Source
              </div>
            </div>

            <div className="p-4 sm:p-5 text-center">
              <div className="font-sans text-2xl sm:text-3xl font-bold text-[#f4c05b] mb-1">En Curso</div>
              <div className="font-mono text-[11px] text-[#879299] leading-tight">
                Grado en Ing. Tecnologías de la Información
              </div>
            </div>

            <div className="p-4 sm:p-5 text-center">
              <div className="font-sans text-2xl sm:text-3xl font-bold text-[#7edc73] mb-1">100%</div>
              <div className="font-mono text-[11px] text-[#879299] leading-tight">
                Curiosidad y Aprendizaje Activo
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: HABILIDADES & DOMINIOS TÉCNICOS */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 font-mono">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
            <span className="text-[#39bae6]">##</span>
            <span>HABILIDADES &amp; DOMINIOS TÉCNICOS</span>
          </div>

          <span className="text-xs text-[#5a6673]">[ 5 FACETAS MULTIDISCIPLINARES ]</span>
        </div>

        {/* Top Row: 3 Facets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Facet 01: Frontend */}
          <div className="rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 space-y-3 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs font-mono text-[#39bae6]">
              <span className="font-semibold tracking-wider">FACET_01 // FRONTEND</span>
              <Code className="h-4 w-4 text-[#39bae6]" />
            </div>

            <h3 className="font-sans text-lg font-bold text-white tracking-tight">DESARROLLO WEB</h3>

            <p className="text-xs font-mono text-[#879299] leading-relaxed">
              Construcción de interfaces limpias, semánticas y reactivas con maquetación moderna y tooling web eficiente.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['HTML5', 'CSS3', 'JavaScript (ES6+)', 'Interfaces Web'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Facet 02: Ethical Hacking */}
          <div className="rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 space-y-3 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs font-mono text-[#7edc73]">
              <span className="font-semibold tracking-wider">FACET_02 // ETHICAL HACKING</span>
              <Bug className="h-4 w-4 text-[#7edc73]" />
            </div>

            <h3 className="font-sans text-lg font-bold text-white tracking-tight">PENTESTING &amp; RED TEAM</h3>

            <p className="text-xs font-mono text-[#879299] leading-relaxed">
              Metodologías de intrusión ética, análisis de vulnerabilidades web (OWASP), explotación controlada y redacción de writeups técnicos.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['OWASP Top 10', 'Web Pentesting', 'Writeups Técnicos', 'CTFs'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Facet 03: Automation */}
          <div className="rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 space-y-3 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs font-mono text-[#f4c05b]">
              <span className="font-semibold tracking-wider">FACET_03 // AUTOMATION</span>
              <Terminal className="h-4 w-4 text-[#f4c05b]" />
            </div>

            <h3 className="font-sans text-lg font-bold text-white tracking-tight">SCRIPTING &amp; AUTOMATIZACIÓN</h3>

            <p className="text-xs font-mono text-[#879299] leading-relaxed">
              Desarrollo ágil de scripts, automatización de tareas repetitivas, herramientas a medida y manipulación de sockets y librerías de red.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Python 3', 'Bash Scripting', 'Sockets & Networking', 'CLI Tooling'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row: 2 Facets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Facet 04: Networks */}
          <div className="rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 space-y-3 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs font-mono text-[#39bae6]">
              <span className="font-semibold tracking-wider">FACET_04 // NETWORKS</span>
              <Share2 className="h-4 w-4 text-[#39bae6]" />
            </div>

            <h3 className="font-sans text-lg font-bold text-white tracking-tight">REDES E INFRAESTRUCTURA</h3>

            <p className="text-xs font-mono text-[#879299] leading-relaxed">
              Comprensión profunda de la pila TCP/IP, direccionamiento, análisis de tráfico con herramientas especializadas, topologías y seguridad de red.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['TCP/IP', 'Enrutamiento & Subredes', 'Análisis de Tráfico', 'Firewalls'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Facet 05: OS & Sysadmin */}
          <div className="rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 space-y-3 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-xs font-mono text-[#7edc73]">
              <span className="font-semibold tracking-wider">FACET_05 // OS &amp; SYSADMIN</span>
              <Shield className="h-4 w-4 text-[#7edc73]" />
            </div>

            <h3 className="font-sans text-lg font-bold text-white tracking-tight">SISTEMAS OPERATIVOS &amp; LINUX</h3>

            <p className="text-xs font-mono text-[#879299] leading-relaxed">
              Administración de entornos GNU/Linux, gestión de procesos y servicios, configuración de servidores, permisos del sistema y control avanzado en terminal.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['GNU/Linux', 'Administración de Servidores', 'Gestión de Procesos', 'Permisos & SSH', 'Sysadmin'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[10px] font-mono text-[#bdc8cf]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section: CAREER & ACADEMIC TIMELINE */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 font-mono">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
            <span className="text-[#39bae6]">##</span>
            <span>CAREER &amp; ACADEMIC TIMELINE</span>
          </div>
        </div>

        <div className="space-y-3.5">
          {/* Timeline Item 1 */}
          <div className="relative flex items-start gap-4 rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821]">
            <div className="mt-1 h-3 w-3 rounded-full bg-[#39bae6] shadow-[0_0_12px_#39bae6] shrink-0" />

            <div className="space-y-1.5 flex-1 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-sans text-base sm:text-lg font-bold text-white tracking-tight">
                  Investigador Independiente &amp; Creador de Starkhack
                </h3>
              </div>

              <p className="text-xs text-[#879299] leading-relaxed">
                Publicación sistemática de guías de intrusión (writeups), análisis de exploits, diseño de utilidades de terminal para reconocimiento automatizado y divulgación técnica para la comunidad.
              </p>
            </div>
          </div>

          {/* Timeline Item 2 */}
          <div className="relative flex items-start gap-4 rounded-xl border border-[#1b1f29] bg-[#10141c] p-5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821]">
            <div className="mt-1 h-3 w-3 rounded-full bg-[#7edc73] shadow-[0_0_12px_#7edc73] shrink-0" />

            <div className="space-y-1.5 flex-1 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-sans text-base sm:text-lg font-bold text-white tracking-tight">
                  Especialización en Seguridad Ofensiva &amp; Red Team
                </h3>
              </div>

              <p className="text-xs text-[#879299] leading-relaxed">
                Realización y superación de certificaciones prácticas en Hack4u y plataformas de aprendizaje avanzado. Profundización en técnicas de escalada de privilegios complejas en Linux y pivoting.
              </p>
            </div>
          </div>

          {/* Timeline Item 3 */}
          <div className="relative flex items-start gap-4 rounded-xl border border-[#39bae6]/30 bg-[#10141c] p-5 transition-all duration-300 hover:border-[#39bae6] hover:bg-[#141821]">
            <div className="mt-1 h-3 w-3 rounded-full bg-[#39bae6] shadow-[0_0_12px_#39bae6] shrink-0 animate-pulse" />

            <div className="space-y-1.5 flex-1 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-sans text-base sm:text-lg font-bold text-white tracking-tight">
                  Cursando Grado en Ingeniería en Tecnologías de la Información
                </h3>
                <span className="rounded border border-[#39bae6]/40 bg-[#39bae6]/10 px-2.5 py-0.5 text-xs text-[#6ad5ff] font-semibold self-start sm:self-auto flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#6ad5ff] animate-ping" />
                  En curso // Actualidad
                </span>
              </div>

              <p className="text-xs text-[#879299] leading-relaxed">
                Estudios universitarios de grado en progreso activo. Asimilación y profundización de fundamentos en redes de computadores, sistemas, seguridad de la información, protocolos criptográficos e ingeniería inversa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: CANALES Y REDES DE CONTACTO */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-[#1b1f29] pb-3 font-mono">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white">
            <span className="text-[#39bae6]">##</span>
            <span>CANALES Y REDES DE CONTACTO</span>
          </div>

          <span className="text-xs text-[#5a6673]">[ 3 NODOS DISPONIBLES ]</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Correo Directo */}
          <div
            onClick={handleCopyEmail}
            className="group rounded-xl border border-[#1b1f29] bg-[#10141c] p-4.5 space-y-3 transition-all duration-300 hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_20px_rgba(0,0,0,0.6)] cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Mail className="h-4 w-4 text-[#39bae6]" />
                <span className="flex items-center gap-1 rounded border border-[#7edc73]/30 bg-[#7edc73]/10 px-2 py-0.5 text-[10px] font-mono text-[#7edc73] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73]" />
                  ACTIVO
                </span>
              </div>
              <div className="font-sans text-xs font-bold text-white mb-0.5">CORREO DIRECTO</div>
              <div className="text-[11px] font-mono text-[#879299] truncate">{emailAddress}</div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#39bae6] pt-2.5 border-t border-[#1b1f29]/70">
              <span>{copiedEmail ? '¡Copiado!' : 'Enviar email'}</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 2: GitHub Repositories */}
          <a
            href="https://github.com/danystarrkk"
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-[#1b1f29] bg-[#10141c] p-4.5 space-y-3 transition-all duration-300 hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Code className="h-4 w-4 text-[#39bae6]" />
                <span className="rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 text-[10px] font-mono text-[#39bae6] font-semibold">
                  OPEN-SRC
                </span>
              </div>
              <div className="font-sans text-xs font-bold text-white mb-0.5">GITHUB REPOSITORIES</div>
              <div className="text-[11px] font-mono text-[#879299] truncate">github.com/danystarrkk</div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#39bae6] pt-2.5 border-t border-[#1b1f29]/70">
              <span>Explorar código</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </div>
          </a>

          {/* Card 3: LinkedIn */}
          <a
            href="https://www.linkedin.com/in/daniel-estrella-62ab62217"
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-[#1b1f29] bg-[#10141c] p-4.5 space-y-3 transition-all duration-300 hover:border-[#39bae6] hover:bg-[#141821] hover:shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Share2 className="h-4 w-4 text-[#39bae6]" />
                <span className="rounded border border-[#39bae6]/30 bg-[#39bae6]/10 px-2 py-0.5 text-[10px] font-mono text-[#39bae6] font-semibold">
                  PERFIL
                </span>
              </div>
              <div className="font-sans text-xs font-bold text-white mb-0.5">LINKEDIN</div>
              <div className="text-[11px] font-mono text-[#879299] truncate">in/daniel-estrella-62ab62217</div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#39bae6] pt-2.5 border-t border-[#1b1f29]/70">
              <span>Ver trayectoria</span>
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </div>
          </a>
        </div>
      </div>

    </div>
  );
};

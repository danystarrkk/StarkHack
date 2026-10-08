import React, { useState } from 'react';
import { Certification } from '../types';
import { CERTIFICATIONS } from '../data/portfolioData';
import {
  GraduationCap,
  Shield,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  Lock,
  Fingerprint,
} from 'lucide-react';

export const CertificationsScreen: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'TODOS' | 'UNIVERSIDAD' | 'HACK4U' | 'UDEMY'>('TODOS');

  // Filter certifications according to selected category
  const filteredCerts = CERTIFICATIONS.filter((c) => {
    if (activeFilter === 'TODOS') return true;
    return c.category === activeFilter;
  });

  const getCategoryBadgeStyle = (category: Certification['category']) => {
    switch (category) {
      case 'UNIVERSIDAD':
        return {
          bg: 'bg-[#93000a]/20',
          border: 'border-[#ffb4ab]/30',
          text: 'text-[#ffb4ab]',
        };
      case 'HACK4U':
        return {
          bg: 'bg-[#7edc73]/15',
          border: 'border-[#7edc73]/30',
          text: 'text-[#7edc73]',
        };
      case 'UDEMY':
      default:
        return {
          bg: 'bg-[#e6b450]/15',
          border: 'border-[#e6b450]/30',
          text: 'text-[#e6b450]',
        };
    }
  };

  // Render a large, imposing and realistic diploma thumbnail preview
  const renderDiplomaThumbnail = (cert: Certification) => {
    const isUni = cert.category === 'UNIVERSIDAD';
    const isHack4u = cert.category === 'HACK4U';
    const accentColor = isUni ? '#39bae6' : isHack4u ? '#7edc73' : '#e6b450';

    return (
      <div className="relative mb-3 w-full h-72 sm:h-80 md:h-96 overflow-hidden rounded-lg border-2 border-[#1b1f29] bg-[#07090e] p-3 sm:p-4 transition-all duration-300 group-hover:border-[#39bae6]/60 group-hover:shadow-[0_0_35px_rgba(57,186,230,0.22)] flex flex-col justify-between select-none">
        {/* Subtle decorative security guilloche watermark pattern */}
        <div className="pointer-events-none absolute inset-0 bg-blueprint-grid opacity-35" />
        <div className="pointer-events-none absolute inset-1 rounded border border-[#39bae6]/20 border-dashed" />
        <div className="pointer-events-none absolute inset-2 rounded border border-[#1b1f29]" />

        {/* Center watermark seal */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] group-hover:opacity-[0.11] transition-opacity">
          <Award className="h-56 w-56 sm:h-64 sm:w-64 text-white" />
        </div>

        {/* Certificate Top Header */}
        <div className="relative z-10 flex items-start justify-between border-b border-[#1b1f29]/90 pb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg border bg-[#0d1017] shadow-md shrink-0"
              style={{ borderColor: `${accentColor}40`, color: accentColor }}
            >
              {isUni ? (
                <GraduationCap className="h-6 w-6" />
              ) : isHack4u ? (
                <span className="font-mono text-base font-bold">&lt;/&gt;</span>
              ) : (
                <Shield className="h-6 w-6" />
              )}
            </div>

            <div>
              <div className="text-[9px] sm:text-[10px] font-mono tracking-wider text-[#5a6673] uppercase">
                ACREDITACIÓN DE COMPETENCIA TÉCNICA
              </div>
              <div className="text-xs sm:text-sm font-mono font-bold text-white truncate max-w-[220px] sm:max-w-[320px]">
                {cert.issuer}
              </div>
            </div>
          </div>

          <div className="text-right font-mono text-[9px] sm:text-[10px] text-[#5a6673]">
            {cert.isPending ? (
              <div className="flex items-center justify-end gap-1.5 text-[#f4c05b] font-semibold">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                <span>EN CURSO</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-1 text-[#7edc73] font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>VERIFICADO</span>
              </div>
            )}
            <div className={cert.isPending ? "text-[#f4c05b]/80 font-medium" : "text-[#bdc8cf] font-medium"}>
              {cert.isPending ? 'EXPEDIENTE ACTIVO' : (cert.issueDate || cert.year)}
            </div>
          </div>
        </div>

        {/* Certificate Body (Diploma Presentation) */}
        <div className="relative z-10 my-auto text-center space-y-2 px-2 py-1">
          <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-[#879299] uppercase">
            {cert.isPending ? 'EXPEDIENTE UNIVERSITARIO // EN CURSO' : 'CERTIFICATE OF ACHIEVEMENT'}
          </div>

          <h4
            className="font-sans text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white line-clamp-2 px-1 leading-snug"
            title={cert.title}
          >
            {cert.title}
          </h4>

          <div className="flex items-center justify-center gap-2 text-xs sm:text-[13px] font-mono">
            <span className="text-[#5a6673]">OTORGADO A:</span>
            <span className="font-bold text-[#e0e2ec] tracking-wider">
              STARK <span className="text-[#39bae6]">(UID: 1000)</span>
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 text-[9px] sm:text-[10px] font-mono flex-wrap">
            <div>
              <span className="text-[#5a6673]">
                {cert.isPending ? 'ESTADO: ' : 'EXPEDIDO EL: '}
              </span>
              <span className={`font-semibold ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#39bae6]'}`}>
                {cert.isPending ? 'CURSANDO (EN TRÁMITE)' : (cert.issueDate || cert.year)}
              </span>
            </div>
            <span className="text-[#5a6673]">•</span>
            <div>
              <span className="text-[#5a6673]">DURACIÓN: </span>
              <span className="text-[#7edc73] font-semibold">{cert.statValue}</span>
            </div>
          </div>

          <div className="text-[10px] sm:text-[11px] font-mono text-[#879299] tracking-wide">
            {cert.subBadge}
          </div>
        </div>

        {/* Certificate Bottom Security Strip */}
        <div className="relative z-10 flex items-end justify-between border-t border-[#1b1f29]/90 pt-2 font-mono text-[9px] sm:text-[10px]">
          {/* Left: Signature line & Issue Date */}
          <div className="space-y-0.5">
            <div className="text-[8px] sm:text-[9px] text-[#5a6673]">
              {cert.isPending ? 'ESTADO DE EMISIÓN' : 'FECHA DE EMISIÓN'}
            </div>
            <div className="flex items-center gap-1 text-[#e0e2ec]">
              {cert.isPending ? (
                <Clock className="h-2.5 w-2.5 text-[#f4c05b]" />
              ) : (
                <Lock className="h-2.5 w-2.5 text-[#39bae6]" />
              )}
              <span className={`font-mono text-[9px] font-semibold ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#e0e2ec]'}`}>
                {cert.isPending ? 'Pendiente de Titulación' : (cert.issueDate || cert.year)}
              </span>
            </div>
          </div>

          {/* Center: Medallion Stamp */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border bg-[#0d1017] shadow-lg"
              style={{
                borderColor: cert.isPending ? '#f4c05b' : accentColor,
                color: cert.isPending ? '#f4c05b' : accentColor,
              }}
            >
              {cert.isPending ? (
                <Clock className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              ) : (
                <Award className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              )}
            </div>
            <span className={`text-[8px] mt-0.5 ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#5a6673]'}`}>
              {cert.isPending ? 'EXPEDIENTE ACTIVO' : 'SELLO OFICIAL'}
            </span>
          </div>

          {/* Right: Security ID */}
          <div className="text-right space-y-0.5">
            <div className="text-[8px] sm:text-[9px] text-[#5a6673]">
              {cert.isPending ? 'EXPEDIENTE ACADÉMICO' : 'IDENTIFICADOR ÚNICO'}
            </div>
            <div className={`flex items-center justify-end gap-1 ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#39bae6]'}`}>
              <Fingerprint className="h-2.5 w-2.5" />
              <span className="font-semibold text-[9px]">{cert.badgeId || 'CERT-SEC-901'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 font-mono">
      {/* Top Telemetry Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 text-[#879299]">
          <span className="h-2 w-2 rounded-full bg-[#39bae6] shadow-[0_0_8px_#39bae6]" />
          <span className="tracking-wider">
            // CREDENTIAL VAULT &amp; ACCREDITATIONS // VERIFIED CERTS
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 text-[11px]">
            <span className="text-[#879299]">[SYSTEM: SECURE]</span>
            <span className="text-[#5a6673]">&gt; VAULT // DB.08</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#7edc73] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span className="text-[#7edc73]">•</span>
            <span>STATUS: VERIFIED / ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Title & Badges Row with blended gradient */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-[#6ad5ff] to-[#7edc73] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(106,213,255,0.35)]">
            CERTIFICATIONS
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-xs text-[#39bae6] font-medium">
              [ LATEST ACCREDITATIONS ]
            </div>

            <div className="rounded border border-[#1b1f29] bg-[#10141c] px-2.5 py-1 text-xs text-[#e6b450] font-medium">
              [ STATUS: ACTIVE_CREDENTIALS ]
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-[13px] text-[#879299] max-w-4xl leading-relaxed">
          // Acreditaciones académicas, certificaciones de pentesting y especializaciones de seguridad defensiva y ofensiva obtenidas por Stark.
        </p>
      </div>

      {/* Filter Row with clean LED indicator dots */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-[#1b1f29]/80 py-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#5a6673] font-mono text-[11px] mr-1">• FILTRO:</span>

          {/* Button: TODOS */}
          <button
            onClick={() => setActiveFilter('TODOS')}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === 'TODOS'
                ? 'bg-[#39bae6] text-[#0b0e15] shadow-[0_0_12px_rgba(57,186,230,0.4)]'
                : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeFilter === 'TODOS' ? 'bg-[#0b0e15]' : 'bg-[#39bae6] shadow-[0_0_6px_#39bae6]'
              }`}
            />
            <span>TODOS</span>
          </button>

          {/* Button: UNIVERSIDAD */}
          <button
            onClick={() => setActiveFilter('UNIVERSIDAD')}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-all ${
              activeFilter === 'UNIVERSIDAD'
                ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40 shadow-[0_0_10px_rgba(255,180,171,0.25)]'
                : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#ffb4ab] shadow-[0_0_6px_#ffb4ab]" />
            <span>UNIVERSIDAD</span>
          </button>

          {/* Button: HACK4U */}
          <button
            onClick={() => setActiveFilter('HACK4U')}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-all ${
              activeFilter === 'HACK4U'
                ? 'bg-[#7edc73]/20 text-[#7edc73] border border-[#7edc73]/40 shadow-[0_0_10px_rgba(126,220,115,0.25)]'
                : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span>HACK4U</span>
          </button>

          {/* Button: UDEMY */}
          <button
            onClick={() => setActiveFilter('UDEMY')}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-all ${
              activeFilter === 'UDEMY'
                ? 'bg-[#e6b450]/20 text-[#e6b450] border border-[#e6b450]/40 shadow-[0_0_10px_rgba(230,180,80,0.25)]'
                : 'border border-[#1b1f29] bg-[#10141c] text-[#879299] hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#e6b450] shadow-[0_0_6px_#e6b450]" />
            <span>UDEMY</span>
          </button>
        </div>

        {/* Right count */}
        <div className="text-[11px] text-[#5a6673] font-mono tracking-wider">
          MOSTRANDO: <span className="text-[#bdc8cf] font-semibold">{filteredCerts.length} CERTIFICADOS</span> // {CERTIFICATIONS.length} TOTALES
        </div>
      </div>

      {/* Grid of Imposing Certification Cards (MAXIMUM 2 CARDS WIDE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {filteredCerts.map((cert) => {
          const catStyle = getCategoryBadgeStyle(cert.category);
          return (
            <div
              key={cert.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#1b1f29] bg-[#10141c] p-2.5 sm:p-3.5 transition-all duration-300 hover:border-[#242936] hover:bg-[#141821] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.85)]"
            >
              <div>
                {/* Header inside card: Category pill (without versions) & Index number */}
                <div className="mb-2 flex items-center justify-between font-mono text-xs px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded border ${catStyle.border} ${catStyle.bg} px-2.5 py-0.5 text-xs font-semibold tracking-wide ${catStyle.text}`}
                    >
                      {cert.category}
                    </span>
                    {cert.isPending && (
                      <span className="flex items-center gap-1 rounded border border-[#f4c05b]/40 bg-[#f4c05b]/15 px-2 py-0.5 text-[10px] font-bold text-[#f4c05b]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#f4c05b] animate-pulse" />
                        CURSANDO // PENDIENTE
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-[#5a6673] font-semibold tracking-wider">
                    {cert.number}
                  </span>
                </div>

                {/* Imposing Large Realistic Certificate Thumbnail */}
                {renderDiplomaThumbnail(cert)}

                {/* Title */}
                <div className="mb-1.5 px-1">
                  <h3 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-white group-hover:text-[#6ad5ff] transition-colors leading-snug">
                    {cert.title}
                  </h3>
                </div>

                {/* Issue Date & Duration in hours */}
                <div className="mb-2.5 flex items-center gap-2 text-[11px] font-mono px-1 flex-wrap">
                  <div className={`flex items-center gap-1.5 ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#39bae6]'}`}>
                    {cert.isPending ? (
                      <Clock className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="text-[#5a6673]">{cert.isPending ? 'ESTADO:' : 'EMISIÓN:'}</span>
                    <span className={`font-medium ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#e0e2ec]'}`}>
                      {cert.issueDate || cert.year}
                    </span>
                  </div>
                  <span className="text-[#5a6673]">•</span>
                  <div className="flex items-center gap-1 text-[#7edc73] font-medium">
                    <span className="text-[#5a6673]">DURACIÓN:</span>
                    <span>{cert.statValue}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="mb-3 text-xs font-mono leading-relaxed text-[#879299] px-1">
                  {cert.description}
                </p>

                {/* Tags */}
                <div className="mb-3.5 flex flex-wrap gap-1.5 px-1">
                  {cert.tags.map((tag, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 rounded border border-[#1b1f29] bg-[#0d1017] px-2 py-0.5 text-[11px] font-mono text-[#bdc8cf]"
                    >
                      <span className="text-[#39bae6]">•</span>
                      <span>{tag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Link: VER CREDENCIAL link seco para abrir PDF en pestaña nueva */}
              <a
                href={cert.pdfUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`group/btn mt-auto flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-mono font-semibold transition-all ${
                  cert.isPending
                    ? 'border-[#f4c05b]/40 bg-[#0d1017] text-[#f4c05b] hover:border-[#f4c05b] hover:bg-[#141821] hover:shadow-[0_0_16px_rgba(244,192,91,0.25)]'
                    : 'border-[#242936] bg-[#0d1017] text-[#bdc8cf] hover:border-[#39bae6] hover:bg-[#10141c] hover:text-[#6ad5ff] hover:shadow-[0_0_16px_rgba(57,186,230,0.25)]'
                }`}
              >
                <span>{cert.isPending ? 'VER EXPEDIENTE ACADÉMICO (EN CURSO)' : 'VER CREDENCIAL'}</span>
                <ExternalLink className={`h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 ${cert.isPending ? 'text-[#f4c05b]' : 'text-[#39bae6]'}`} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { CERTIFICATIONS } from '../data/portfolioData';
import { X, Award, CheckCircle2, ShieldCheck, ExternalLink, Clock } from 'lucide-react';

interface CertificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CertificationsModal: React.FC<CertificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
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
              <span>certs://credentials/verified-badges.sec</span>
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
          <div className="border-b border-[#1b1f29] pb-4">
            <h2 className="font-sans text-xl font-bold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-[#39bae6]" />
              Certificaciones & Acreditaciones
            </h2>
            <p className="mt-1 text-[#879299]">
              Verificación criptográfica de competencias en seguridad ofensiva y pruebas de penetración.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CERTIFICATIONS.map((cert) => (
              <div
                key={cert.id}
                className="rounded border border-[#1b1f29] bg-[#0d1017] p-4 transition-all hover:border-[#39bae6]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-sans text-sm font-semibold text-white">
                    {cert.title}
                  </h3>
                  {cert.isPending || cert.status === 'PENDING' ? (
                    <span className="flex items-center gap-1 rounded border border-[#f4c05b]/30 bg-[#f4c05b]/10 px-2 py-0.5 text-[10px] text-[#f4c05b] shrink-0 font-bold">
                      <Clock className="h-3 w-3 animate-pulse" />
                      EN CURSO
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded border border-[#7edc73]/30 bg-[#7edc73]/10 px-2 py-0.5 text-[10px] text-[#7edc73] shrink-0 font-bold">
                      <CheckCircle2 className="h-3 w-3" />
                      {cert.status}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#39bae6] mb-1">{cert.issuer}</div>
                <div className="text-[10px] text-[#5a6673] mb-3">
                  ID: {cert.badgeId || 'CERT-SEC-901'} • EMISIÓN: {cert.issueDate || cert.year || cert.date}
                </div>

                <div className="flex flex-wrap gap-1 border-t border-[#1b1f29] pt-2">
                  {(cert.skills || cert.tags || []).map((s, i) => (
                    <span
                      key={i}
                      className="rounded bg-[#10141c] px-2 py-0.5 text-[10px] text-[#bdc8cf]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-[#1b1f29] bg-[#0b0e15] p-3 text-[11px] text-[#5a6673] flex items-center justify-between">
            <span>LLAVE PÚBLICA PGP: 0x9B4E281F0CA4881737461726B</span>
            <span className="text-[#7edc73]">FIRMA VÁLIDA</span>
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

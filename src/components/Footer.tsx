import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 w-full border-t border-[#1b1f29] bg-[#0b0e15] py-5 font-mono text-[11px] text-[#5a6673]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
        {/* Left Telemetry */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <div className="flex items-center gap-2 text-[#7edc73]">
            <span className="h-2 w-2 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span className="font-semibold">SYSTEM: STABLE</span>
          </div>
          <span className="text-[#3d484e]">•</span>
          <span>UPTIME: 142D 04H 21M</span>
          <span className="text-[#3d484e]">•</span>
          <span>KERNEL: LINUX</span>
        </div>

        {/* Right Copyright */}
        <div className="text-center sm:text-right">
          <span>© 2024 STARKHACK</span>
        </div>
      </div>
    </footer>
  );
};

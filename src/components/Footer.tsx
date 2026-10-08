import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 w-full border-t border-[#1b1f29] bg-[#0b0e15] py-5 font-mono text-[11px] text-[#5a6673]">
      {/* Copyright only — no telemetry, no dates (product decision). */}
      <div className="mx-auto flex w-full items-center justify-center px-4 sm:px-6 lg:px-8">
        <span>© STARKHACK</span>
      </div>
    </footer>
  );
};

// Honest 404 for the catch-all route (`*`). Same cyber aesthetic as the rest
// of the UI; states plainly that the requested path does not exist and links
// back home. No invented content.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const NotFoundScreen: React.FC = () => {
  const location = useLocation();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12 flex-1">
      <div className="rounded-lg border border-[#1b1f29] bg-[#10141c] px-6 py-14 text-center">
        <p className="font-mono text-6xl font-extrabold text-[#39bae6] drop-shadow-[0_0_20px_rgba(57,186,230,0.35)]">
          404
        </p>
        <p className="mt-4 font-mono text-sm font-bold tracking-wider text-[#e0e2ec]">
          RUTA NO ENCONTRADA
        </p>
        <p className="mt-2 break-all font-mono text-[11px] text-[#879299]">
          <span className="text-[#39bae6]">&gt;</span> {location.pathname} NO EXISTE EN ESTE SERVIDOR
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
        >
          <span>&lt;</span> VOLVER AL INICIO
        </Link>
      </div>
    </main>
  );
};

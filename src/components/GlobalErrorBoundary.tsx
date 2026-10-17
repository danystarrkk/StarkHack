// Global render-crash boundary for the app shell (p1-reliability S3).
//
// The detail routes already convert their own render crashes into an honest
// state (DetailErrorBoundary of src/screens/detailRoutes.tsx); this boundary is
// the last resort for EVERYTHING else routed below the shell (Home, Writeups,
// Projects, Certifications, About, 404): a crash becomes a visible honest
// panel instead of a white screen.
//
// Coverage note: the vitest environment is `node` (no jsdom), so tests pin
// this contract structurally (App wraps <Outlet />), render the fallback, and
// unit getDerivedStateFromError — see tests/global-error-boundary.test.ts.
import React from 'react';

export const GlobalErrorFallback: React.FC = () => (
  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12 flex-1">
    <div className="rounded-lg border border-[#f07178]/30 bg-[#f07178]/5 px-6 py-10 text-center">
      <p className="font-mono text-sm font-bold tracking-wider text-[#e0e2ec]">
        ERROR INESPERADO
      </p>
      <p className="mx-auto mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-[#879299]">
        <span className="text-[#f07178]">&gt;</span> LA APLICACIÓN ENCONTRÓ UN PROBLEMA AL
        RENDERIZAR ESTA PÁGINA. RECARGA PARA REINTENTAR O VUELVE AL INICIO.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded border border-[#242936] bg-[#141821] px-4 py-2 font-mono text-xs font-semibold tracking-wider text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff]"
      >
        <span>&lt;</span> VOLVER AL INICIO
      </a>
    </div>
  </div>
);

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('App shell failed to render:', error);
  }

  render(): React.ReactNode {
    return this.state.hasError ? <GlobalErrorFallback /> : this.props.children;
  }
}

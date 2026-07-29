import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  // Estado para el contador. Inicia en null para mostrar un texto de carga.
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    // Función que llama a la API gratuita para sumar 1 y obtener el total
    const fetchAndIncrementViews = async () => {
      try {
        // NOTA: Cambia "starkhack-tu-nombre-unico" por algo único para que no se mezcle con otros
        const response = await fetch(
          "https://api.counterapi.dev/v1/starkhack-35GH3-1C4B50-1A34/pageviews/up",
        );
        const data = await response.json();
        setViews(data.count);
      } catch (error) {
        console.error("Error al cargar las vistas:", error);
        setViews(0); // Si falla el internet, mostramos 0
      }
    };

    fetchAndIncrementViews();
  }, []); // El array vacío asegura que solo sume +1 cuando la persona entra a la web

  const getLinkClass = (path: string) => {
    const isActive =
      location.pathname === path ||
      (path !== "/" && location.pathname.startsWith(path));
    return `text-sm font-medium leading-normal transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${
      isActive
        ? "text-nord7 border-b-2 border-nord7"
        : "text-nord9 hover:text-nord7"
    }`;
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-deep-bg text-nord4 font-display">
      <div className="fixed inset-0 scanline opacity-10 z-50 pointer-events-none"></div>

      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-nord3/30 bg-deep-bg px-10 py-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="logo-container text-nord7 flex items-center gap-2 group"
          >
            <span className="logo-animate text-2xl font-bold">×͜×</span>
            <h2 className="text-nord6 text-lg font-bold leading-tight tracking-[-0.015em] uppercase group-hover:text-nord7 transition-colors">
              StarkHack
            </h2>
          </Link>
        </div>
        <div className="flex flex-1 justify-end gap-8">
          <div className="hidden md:flex items-center gap-9">
            <Link className={getLinkClass("/")} to="/">
              Home
            </Link>
            <Link className={getLinkClass("/directory")} to="/directory">
              Writeups
            </Link>
            <Link className={getLinkClass("/about")} to="/about">
              About
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-nord6 text-xs font-bold leading-none tracking-tight">
                Stark
              </span>
              <span className="text-nord14 text-[9px] font-mono leading-none tracking-widest mt-1">
                ONLINE
              </span>
            </div>
            <div className="size-10 rounded bg-nord1 border border-nord3/30 overflow-hidden flex items-center justify-center">
              <span className="material-symbols-outlined text-nord9">
                {" "}
                <img src="/images/stark.webp" alt="Avatar"></img>{" "}
              </span>
            </div>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-auto px-4 md:px-10 lg:px-40 py-8 border-t border-nord3/10 bg-deep-bg">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-8 text-[10px] font-mono text-nord3 uppercase tracking-[0.2em]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-nord14 shadow-[0_0_8px_rgba(163,190,140,0.4)]"></span>
              SYSTEM: STABLE
            </div>
            <div>UPTIME: 142D 04H 21M</div>
            <div className="hidden sm:block">KERNEL: Linux </div>

            {/* Contador de vistas con lógica funcional */}
            <div className="hidden sm:block text-nord8">
              VIEWS:{" "}
              {views !== null
                ? String(views).padStart(6, "0")
                : "CONNECTING..."}
            </div>
          </div>
          <div className="text-nord3 text-[10px] font-mono font-bold uppercase tracking-[0.2em]">
            © 2024 StarkHack
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

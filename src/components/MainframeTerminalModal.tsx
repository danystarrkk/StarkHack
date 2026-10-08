import React, { useState, useRef, useEffect } from 'react';
import { X, Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { FEATURED_WRITEUPS, FEATURED_PROJECTS, CERTIFICATIONS } from '../data/portfolioData';

interface MainframeTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandHistoryItem {
  command: string;
  output: React.ReactNode;
}

export const MainframeTerminalModal: React.FC<MainframeTerminalModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([
    {
      command: 'banner',
      output: (
        <div className="text-[#39bae6] space-y-1">
          <pre className="text-[10px] leading-tight font-mono">
{`   _____ _____ ___  ______ _   __ _   _   ___  _____ _   __
  /  ___|_   _/ _ \\ | ___ \\ | / /| | | | / _ \\/  __ \\ | / /
  \\ \`--.  | |/ /_\\ \\| |_/ / |/ / | |_| |/ /_\\ \\ /  \\/ |/ / 
   \`--. \\ | ||  _  ||    /|    \\ |  _  ||  _  | |   |    \\ 
  /\\__/ / | || | | || |\\ \\| |\\  \\| | | || | | | \\__/\\ |\\  \\
  \\____/  \\_/\\_| |_/\\_| \\_\\_| \\_/\\_| |_/\\_| |_/\\____/\\_| \\_/`}
          </pre>
          <p className="text-[#879299] text-xs">
            STARK MAINFRAME OS v4.19-RELEASE • TTY/pty0 • CONEXIÓN SEGURA TLS 1.3
          </p>
          <p className="text-[#5a6673] text-[11px]">
            Escribe <span className="text-[#6ad5ff] font-bold">help</span> para ver la lista de comandos disponibles o <span className="text-[#6ad5ff] font-bold">exit</span> para cerrar.
          </p>
        </div>
      ),
    },
  ]);

  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isMatrixActive, setIsMatrixActive] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isMatrixActive]);

  if (!isOpen) return null;

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputVal.trim();
    if (!raw) return;

    setCommandHistory((prev) => [...prev, raw]);
    setHistoryIndex(-1);

    const parts = raw.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    let resultNode: React.ReactNode = null;

    switch (cmd) {
      case 'help':
        resultNode = (
          <div className="space-y-1 text-xs text-[#bdc8cf]">
            <p className="text-[#39bae6] font-semibold">// COMANDOS DEL SISTEMA:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] pt-1">
              <div><span className="text-[#6ad5ff] font-semibold">whoami</span> - Imprime identidad y privilegios</div>
              <div><span className="text-[#6ad5ff] font-semibold">cat bio.txt</span> - Muestra la biografía completa</div>
              <div><span className="text-[#6ad5ff] font-semibold">writeups</span> - Lista auditorías y máquinas pwned</div>
              <div><span className="text-[#6ad5ff] font-semibold">projects</span> - Muestra proyectos y repositorios</div>
              <div><span className="text-[#6ad5ff] font-semibold">certs</span> - Lista certificaciones de seguridad</div>
              <div><span className="text-[#6ad5ff] font-semibold">recon &lt;ip&gt;</span> - Escaneo de puertos simulado</div>
              <div><span className="text-[#6ad5ff] font-semibold">sudo su</span> - Intento de escalada de privilegios</div>
              <div><span className="text-[#6ad5ff] font-semibold">matrix</span> - Alternar lluvia digital Matrix</div>
              <div><span className="text-[#6ad5ff] font-semibold">clear</span> - Limpia la pantalla</div>
              <div><span className="text-[#6ad5ff] font-semibold">exit</span> - Cierra la terminal</div>
            </div>
          </div>
        );
        break;

      case 'whoami':
        resultNode = (
          <div className="text-xs text-[#bdc8cf] space-y-1">
            <p><span className="text-[#39bae6]">USER:</span> Stark (UID: 1000, GID: 1000)</p>
            <p><span className="text-[#39bae6]">ROL:</span> Security Researcher & CTF Pwnder</p>
            <p><span className="text-[#7edc73]">PRIVILEGES:</span> ELEVATED (cap_sys_admin, sudo nopasswd)</p>
            <p><span className="text-[#5a6673]">FINGERPRINT:</span> 0x9B4E281F0CA4881737461726B</p>
          </div>
        );
        break;

      case 'cat':
        if (arg === 'bio.txt' || arg === 'bio') {
          resultNode = (
            <p className="text-xs text-[#bdc8cf] leading-relaxed">
              Apasionado por la seguridad ofensiva, el análisis de vulnerabilidades y la resolución de máquinas (CTF). Aquí documento mi proceso de aprendizaje, técnicas de intrusión ética y metodologías de defensa en entornos modernos.
            </p>
          );
        } else if (arg === 'flag.txt' || arg === 'flag') {
          resultNode = (
            <p className="text-xs text-[#7edc73] font-bold">
              [+] HTB&#123;st4rk_m41nfr4m3_4cc3ss_gr4nt3d_2024&#125;
            </p>
          );
        } else {
          resultNode = <span className="text-[#f07178]">cat: {arg}: No such file or directory</span>;
        }
        break;

      case 'writeups':
        resultNode = (
          <div className="space-y-1.5 text-xs">
            <p className="text-[#39bae6] font-semibold">// ÚLTIMOS WRITEUPS AUDITADOS:</p>
            {FEATURED_WRITEUPS.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-[11px] text-[#bdc8cf]">
                <span>• {w.title} ({w.os}) - {w.difficulty}</span>
                <span className="text-[#5a6673]">{w.ports}</span>
              </div>
            ))}
          </div>
        );
        break;

      case 'projects':
        resultNode = (
          <div className="space-y-1.5 text-xs">
            <p className="text-[#39bae6] font-semibold">// REPOSITORIOS DESTACADOS:</p>
            {FEATURED_PROJECTS.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-[11px] text-[#bdc8cf]">
                <span>• {p.title} ({p.tagCategory})</span>
                <span className="text-[#e6b450]">★ {p.stars}</span>
              </div>
            ))}
          </div>
        );
        break;

      case 'certs':
        resultNode = (
          <div className="space-y-1.5 text-xs">
            <p className="text-[#39bae6] font-semibold">// ACREDITACIONES:</p>
            {CERTIFICATIONS.map((c) => (
              <div key={c.id} className="text-[11px] text-[#bdc8cf]">
                • <span className="text-white font-semibold">{c.title}</span> ({c.issuer} - {c.isPending ? 'EN CURSO' : (c.issueDate || c.year || c.date)})
              </div>
            ))}
          </div>
        );
        break;

      case 'recon':
        const target = arg || '10.10.11.234';
        resultNode = (
          <div className="space-y-1 text-xs font-mono">
            <p className="text-[#39bae6]">Starting Nmap 7.94 ( https://nmap.org ) at {new Date().toLocaleTimeString()}</p>
            <p className="text-[#879299]">Nmap scan report for {target}</p>
            <p className="text-[#bdc8cf]">Host is up (0.042s latency).</p>
            <div className="rounded border border-[#1b1f29] bg-[#07090e] p-2 mt-1 text-[11px] space-y-0.5">
              <p className="text-[#5a6673]">PORT     STATE SERVICE VERSION</p>
              <p className="text-[#7edc73]">80/tcp   open  http    nginx 1.18.0</p>
              <p className="text-[#7edc73]">443/tcp  open  ssl/http nginx 1.18.0 (TLSv1.3)</p>
              <p className="text-[#7edc73]">8080/tcp open  http-proxy Node.js Express framework</p>
            </div>
            <p className="text-[#7edc73] pt-1">Nmap done: 1 IP address (1 host up) scanned in 1.45 seconds</p>
          </div>
        );
        break;

      case 'sudo':
        if (arg.includes('su') || arg.includes('root')) {
          resultNode = (
            <div className="text-xs text-[#e6b450]">
              <p>[i] stark ya posee privilegios de root en esta sesión (UID 0 interceptado).</p>
              <p className="text-[#7edc73]">Bienvenido a las profundidades de la matrix.</p>
            </div>
          );
        } else {
          resultNode = <span className="text-[#f07178]">sudo: orden no reconocida</span>;
        }
        break;

      case 'matrix':
        setIsMatrixActive((prev) => !prev);
        resultNode = (
          <p className="text-xs text-[#7edc73]">
            {isMatrixActive ? '[-] Efecto Matrix desactivado.' : '[+] Modo Matrix activado. Hack the planet!'}
          </p>
        );
        break;

      case 'clear':
        setHistory([]);
        setInputVal('');
        return;

      case 'exit':
      case 'quit':
        onClose();
        return;

      default:
        resultNode = (
          <span className="text-[#f07178] text-xs">
            zsh: command not found: {cmd}. Escribe 'help' para ver las órdenes válidas.
          </span>
        );
        break;
    }

    setHistory((prev) => [...prev, { command: raw, output: resultNode }]);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(commandHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0 || historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(commandHistory[nextIdx]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#39bae6]/40 bg-[#07090e] shadow-[0_0_35px_rgba(57,186,230,0.25)]">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-[#1b1f29] bg-[#10141c] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#879299]">
              <TerminalIcon className="h-3.5 w-3.5 text-[#39bae6]" />
              <span className="text-white font-semibold">stark@deep-sea:~ (interactive pty/0)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistory([])}
              className="text-[10px] font-mono text-[#5a6673] hover:text-[#bdc8cf] px-1.5 py-0.5 rounded border border-[#1b1f29]"
            >
              CLEAR
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-[#879299] hover:bg-[#1b1f29] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Matrix Canvas Overlay if active */}
        {isMatrixActive && (
          <div className="pointer-events-none absolute inset-0 z-10 opacity-20 overflow-hidden font-mono text-[10px] text-[#7edc73] leading-none select-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 animate-pulse"
                style={{
                  left: `${i * 3.3}%`,
                  animationDuration: `${1.5 + (i % 5) * 0.5}s`,
                }}
              >
                010101010010101010111010010101010101010101011101010101
              </div>
            ))}
          </div>
        )}

        {/* Console Body */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 overflow-y-auto p-4 sm:p-6 font-mono text-xs space-y-4"
        >
          {history.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2 text-[#879299]">
                <span className="text-[#39bae6]">stark@deep-sea:~$</span>
                <span className="text-white font-semibold">{item.command}</span>
              </div>
              <div className="pl-4">{item.output}</div>
            </div>
          ))}

          {/* Active Input Line */}
          <form onSubmit={handleCommand} className="flex items-center gap-2 pt-1">
            <span className="text-[#39bae6] shrink-0">stark@deep-sea:~$</span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent font-mono text-xs text-white outline-none caret-[#39bae6]"
              autoFocus
            />
          </form>

          <div ref={terminalEndRef} />
        </div>

        {/* Quick Suggestion Strip at bottom */}
        <div className="border-t border-[#1b1f29] bg-[#0d1017] px-4 py-2 font-mono text-[10px] text-[#5a6673] flex flex-wrap items-center gap-2">
          <span>SUGERENCIAS:</span>
          {['help', 'whoami', 'writeups', 'projects', 'recon 10.10.11.234', 'cat flag.txt', 'matrix'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setInputVal(suggestion);
                inputRef.current?.focus();
              }}
              className="rounded bg-[#10141c] border border-[#1b1f29] px-2 py-0.5 text-[#879299] hover:border-[#39bae6] hover:text-[#6ad5ff]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

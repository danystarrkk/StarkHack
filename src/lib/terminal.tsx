// Shared access to the Mainframe terminal modal from route elements.
//
// The modal itself stays mounted once in the root layout (src/App.tsx), but
// route elements (Home, About) are rendered through the router's <Outlet/>
// and cannot receive an onOpenTerminal prop from the layout. This context is
// the plumbing for that callback; its default is a no-op so route elements
// render safely outside a provider (e.g. in SSR tests).
import { createContext, useContext } from 'react';

export interface TerminalController {
  openTerminal: () => void;
}

const noop = (): void => {};

export const TerminalContext = createContext<TerminalController>({ openTerminal: noop });

export const useTerminal = (): TerminalController => useContext(TerminalContext);

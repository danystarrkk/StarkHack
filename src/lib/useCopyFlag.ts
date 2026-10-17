// Shared "copied" flag for the detail pages' copy buttons (p2-structure U2).
// One instance per button: `copy(text)` writes to the clipboard and holds the
// flag for `resetMs` so the button can show its confirmation state; the timer
// is cleared on unmount and re-triggered copies never stack stale resets.
import { useEffect, useRef, useState } from 'react';

export interface CopyFlag {
  copied: boolean;
  copy: (text: string) => void;
}

export function useCopyFlag(resetMs: number = 2000): CopyFlag {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    []
  );

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), resetMs);
  };

  return { copied, copy };
}

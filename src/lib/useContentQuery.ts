// Single honest fetch state machine for routed content containers
// (p2-structure U1, audit H2). Home, the list screens and the detail routes
// used to hand-roll the same loading/ready/error + `cancelled` effect four
// times; the rule now is: load through this hook, render the states it
// returns.
//
// Contract:
// - `status` starts at 'loading' and re-enters it whenever `deps` change;
// - `data` is null until the loader resolves (and stays null on error);
// - `error` carries the honest message (Error.message or String(error));
// - a resolution after unmount or after a dep change never sets state.
//
// SSR note: effects never run during renderToStaticMarkup, so server-rendered
// markup always shows the initial 'loading' state — the same observable
// behaviour the containers had before this hook (pinned by tests/router.test.ts).
import { DependencyList, useEffect, useState } from 'react';

export type ContentQueryStatus = 'loading' | 'ready' | 'error';

export interface ContentQuery<T> {
  data: T | null;
  status: ContentQueryStatus;
  error: string;
}

export function useContentQuery<T>(
  load: () => Promise<T>,
  deps: DependencyList = []
): ContentQuery<T> {
  const [query, setQuery] = useState<ContentQuery<T>>({ data: null, status: 'loading', error: '' });

  useEffect(() => {
    let cancelled = false;
    setQuery({ data: null, status: 'loading', error: '' });

    load()
      .then((data) => {
        if (cancelled) return;
        setQuery({ data, status: 'ready', error: '' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setQuery({
          data: null,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
    // The loader closure is re-created every render; `deps` is the caller's
    // declared re-run policy (mirrors the useEffect contract).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return query;
}

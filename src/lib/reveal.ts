// Utilitario de reveal progresivo (site-motion).
//
// Contrato de degradación: el estado oculto de [data-reveal] solo aplica bajo
// la clase `reveal-ready` en <html>, y esa clase SOLO se agrega si
// `window.IntersectionObserver` es una función. Sin soporte o sin JS, esta
// función no hace nada y el contenido queda visible.
//
// Comportamiento:
//   - Un IntersectionObserver (rootMargin 0px 0px -8% 0px, threshold 0.12)
//     agrega `.is-visible` en la primera intersección y deja de observar.
//   - Un MutationObserver (subtree + childList) descubre elementos
//     [data-reveal] que llegan después del fetch/render.
//   - Stagger determinista: `--reveal-delay` = índice del elemento entre los
//     hermanos [data-reveal] de su padre × 60ms, tope 300ms.
//   - El cleanup desconecta ambos observers y quita `reveal-ready` de <html>.

export function initReveal(root: HTMLElement): () => void {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
    return () => {};
  }

  document.documentElement.classList.add('reveal-ready');

  const tracked = new Set<HTMLElement>();

  const applyDelays = (): void => {
    tracked.forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      const siblings = Array.from(parent.querySelectorAll(':scope > [data-reveal]'));
      const index = Math.max(siblings.indexOf(el), 0);
      el.style.setProperty('--reveal-delay', `${Math.min(index * 60, 300)}ms`);
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  const observe = (el: HTMLElement): void => {
    if (tracked.has(el) || el.classList.contains('is-visible')) return;
    tracked.add(el);
    io.observe(el);
  };

  const scan = (scope: Element | ParentNode): void => {
    if (scope instanceof HTMLElement && scope.matches('[data-reveal]')) {
      observe(scope);
    }
    scope.querySelectorAll<HTMLElement>('[data-reveal]').forEach(observe);
  };

  scan(root);
  applyDelays();

  const mo = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        scan(node as Element);
      }
    }
    applyDelays();
  });
  mo.observe(root, { subtree: true, childList: true });

  return () => {
    io.disconnect();
    mo.disconnect();
    document.documentElement.classList.remove('reveal-ready');
  };
}

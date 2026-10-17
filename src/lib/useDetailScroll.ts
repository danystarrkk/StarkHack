// Shared scroll machinery for the detail pages (p2-structure U2, audit H3).
// WriteupPage and ProjectPage mirrored this block (~60 lines each): reading
// progress + active TOC heading under ONE passive scroll listener, and the
// smooth scroll to a heading with post-settle re-anchoring.
//
// Re-anchoring note (behaviour preserved from WriteupPage, now shared by both
// pages): lazy-loaded images have no reserved height, so when they load above
// or below the target the layout shifts and the heading ends up short of the
// top offset — keep correcting for a few seconds until the delta is
// negligible.
import { useEffect, useState } from 'react';

export interface DetailScroll {
  /** Id of the TOC heading currently under the reading line, or ''. */
  activeHeadingId: string;
  /** 0-100 rounded reading progress of the document. */
  readingProgress: number;
  /** Smooth-scroll to a heading id and keep it anchored while images settle. */
  scrollToHeading: (id: string) => void;
}

export function useDetailScroll(headings: ReadonlyArray<{ id: string }>): DetailScroll {
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Reading progress
      const scrollY = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, Math.round((scrollY / totalHeight) * 100)));
        setReadingProgress(progress);
      }

      // Active heading: last heading at or above the reading line
      const headingElements = headings
        .map((h) => document.getElementById(h.id))
        .filter((el): el is HTMLElement => el !== null);
      if (headingElements.length === 0) return;

      const triggerPosition = 180;
      let currentActiveId = headingElements[0].id;
      for (const el of headingElements) {
        if (el.getBoundingClientRect().top <= triggerPosition) {
          currentActiveId = el.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const topOffset = 90;
    const targetTop = () => element.getBoundingClientRect().top + window.pageYOffset - topOffset;

    window.scrollTo({ top: targetTop(), behavior: 'smooth' });
    setActiveHeadingId(id);

    // Re-anchor after the scroll settles (see the file header).
    window.setTimeout(() => {
      let attempts = 0;
      const settle = window.setInterval(() => {
        const delta = targetTop() - window.pageYOffset;
        if (Math.abs(delta) <= 3 || attempts >= 20) {
          window.clearInterval(settle);
          return;
        }
        window.scrollTo({ top: targetTop(), behavior: 'auto' });
        attempts += 1;
      }, 150);
    }, 700);
  };

  return { activeHeadingId, readingProgress, scrollToHeading };
}

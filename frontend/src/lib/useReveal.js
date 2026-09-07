import { useEffect, useRef, useState } from 'react';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Adds `is-in` when the element scrolls into view. Reveal is CSS-driven and
// collapses to instant under prefers-reduced-motion.
export function useReveal(options = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion || !ref.current) {
      setShown(true);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setShown(true);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: options.threshold ?? 0.18, rootMargin: options.rootMargin ?? '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [options.threshold, options.rootMargin]);
  return [ref, shown];
}

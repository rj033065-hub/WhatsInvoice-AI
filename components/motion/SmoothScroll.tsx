'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import { useReducedMotion } from 'motion/react';

export function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || pathname.endsWith('/print')) return;

    const lenis = new Lenis({ autoRaf: true, smoothWheel: true, lerp: 0.1 });
    return () => lenis.destroy();
  }, [pathname, reduceMotion]);

  return children;
}
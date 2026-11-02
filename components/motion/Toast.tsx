'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface ToastProps {
  children: ReactNode;
  tone?: 'success' | 'error';
}

export function Toast({ children, tone = 'success' }: ToastProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: 20 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`fixed right-4 top-20 z-50 max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
        tone === 'success'
          ? 'border-emerald-200 bg-surface text-emerald-700'
          : 'border-rose-200 bg-surface text-rose-700'
      }`}
    >
      {children}
    </motion.div>
  );
}
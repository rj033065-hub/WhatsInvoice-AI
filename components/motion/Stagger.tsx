'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

interface StaggerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'tbody';
}

export function Stagger({ children, className, as = 'div' }: StaggerProps) {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? false : 'hidden';
  const animate = reduceMotion ? undefined : 'visible';

  if (as === 'tbody') {
    return (
      <motion.tbody
        className={className}
        variants={containerVariants}
        initial={initial}
        animate={animate}
      >
        {children}
      </motion.tbody>
    );
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial={initial}
      animate={animate}
    >
      {children}
    </motion.div>
  );
}
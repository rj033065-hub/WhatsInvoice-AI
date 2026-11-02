'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';

interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'whileInView' | 'transition'> {
  delay?: number;
  trigger?: 'load' | 'view';
}

export function FadeIn({ children, delay = 0, trigger = 'view', ...props }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const visible = { opacity: 1, y: 0 };
  const hidden = reduceMotion ? false : { opacity: 0, y: 16 };
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as const };

  if (trigger === 'load') {
    return (
      <motion.div
        initial={hidden}
        animate={visible}
        transition={transition}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={hidden}
      whileInView={visible}
      viewport={{ once: true, amount: 0.2 }}
      transition={transition}
      {...props}
    >
      {children}
    </motion.div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { useRef } from 'react';

interface CountUpProps {
  value: number;
  currency?: string;
  className?: string;
}

export function CountUp({ value, currency = '₹', className }: CountUpProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(elementRef, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0);

  useMotionValueEvent(motionValue, 'change', (latest) => setDisplayValue(latest));

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    if (!isInView) return;

    const controls = animate(motionValue, value, {
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => setDisplayValue(value),
    });

    return () => controls.stop();
  }, [isInView, motionValue, reduceMotion, value]);

  return (
    <span ref={elementRef} className={className}>
      {currency} {(reduceMotion ? value : displayValue).toFixed(2)}
    </span>
  );
}
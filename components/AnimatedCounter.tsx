'use client';
import { useEffect, useRef, useState } from 'react';

const animated = new Set<number>();

export default function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    // Already did the initial animation — a later target change (e.g. a
    // background refresh found a genuinely updated number) just snaps
    // directly to the new value. Re-animating from 0 for a silent
    // background update would be visually jarring; only the very first
    // render should get the count-up effect.
    if (started.current) {
      if (prevTarget.current !== target) {
        prevTarget.current = target;
        setCount(target);
      }
      return;
    }
    started.current = true;
    prevTarget.current = target;
    if (animated.has(target)) { setCount(target); return; }
    animated.add(target);
    const steps = 60;
    const interval = 1800 / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setCount(Math.round(eased * target));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target]);

  return <>{count.toLocaleString()}+</>;
}

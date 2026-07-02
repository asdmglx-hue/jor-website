'use client';
import { useEffect, useRef, useState } from 'react';

const animated = new Set<number>();

export default function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
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

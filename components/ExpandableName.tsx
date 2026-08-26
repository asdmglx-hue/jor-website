'use client';
import { useState, useRef } from 'react';

// Shows a name truncated with "..." by default (matches the rest of the
// site's compact header style), but lets the user tap it to reveal the
// full name in place — useful now that long names correctly truncate
// instead of breaking the page layout, but some people will still want
// to see the whole thing without it looking cut off forever.
export default function ExpandableName({ name, style, className }: { name: string; style?: React.CSSProperties; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLHeadingElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    // If the name isn't actually cut off (already short enough to fit),
    // there's nothing to expand — let the tap pass through so the rest of
    // the card's normal "go to profile" behavior still works here too,
    // instead of silently swallowing a tap that would have done nothing.
    const el = ref.current;
    const isTruncated = !expanded && el ? el.scrollWidth > el.clientWidth : true;
    if (!isTruncated) return;
    e.preventDefault(); e.stopPropagation(); setExpanded(v => !v);
  };

  return (
    <h1
      ref={ref}
      className={className}
      onClick={handleClick}
      style={{
        ...style,
        cursor: 'pointer',
        ...(expanded
          ? { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', wordBreak: 'break-word', minWidth: 0, flex: '1 1 auto' }
          : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: '1 1 auto' }),
      }}
      title={expanded ? undefined : name} // native tooltip as a bonus on devices/browsers that support hover
    >
      {name}
    </h1>
  );
}

'use client';
import { useState } from 'react';

// Shows a name truncated with "..." by default (matches the rest of the
// site's compact header style), but lets the user tap it to reveal the
// full name in place — useful now that long names correctly truncate
// instead of breaking the page layout, but some people will still want
// to see the whole thing without it looking cut off forever.
export default function ExpandableName({ name, style, className }: { name: string; style?: React.CSSProperties; className?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <h1
      className={className}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(v => !v); }}
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

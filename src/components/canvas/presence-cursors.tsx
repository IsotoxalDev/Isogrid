"use client";

import type { PresenceInfo } from "@/lib/firebase";

interface PresenceCursorsProps {
  peers: Record<string, PresenceInfo>;
  zoom: number;
}

// Rendered as a sibling of the canvas items inside the same pan/zoom-transformed
// container, so cursor positions (stored in canvas coordinate space, same as
// item.position) line up without any extra transform math here.
export default function PresenceCursors({ peers, zoom }: PresenceCursorsProps) {
  return (
    <>
      {Object.entries(peers).map(([uid, peer]) => {
        if (!peer.cursor) return null;
        return (
          <div
            key={uid}
            className="absolute pointer-events-none z-50"
            style={{
              left: peer.cursor.x,
              top: peer.cursor.y,
              transform: `scale(${1 / zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 2L18 9L10 11L8 18L2 2Z" fill={peer.color} stroke="white" strokeWidth="1" />
            </svg>
            <span
              className="ml-4 -mt-1 inline-block px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        );
      })}
    </>
  );
}

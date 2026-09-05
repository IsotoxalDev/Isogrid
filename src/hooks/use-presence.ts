"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { joinPresence, leavePresence, updateCursorPosition, subscribeToPresence, type PresenceInfo } from "@/lib/firebase";
import type { Point } from "@/lib/types";

const PRESENCE_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#ec4899", "#a855f7", "#eab308", "#14b8a6", "#ef4444"];

function colorForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

const CURSOR_THROTTLE_MS = 50;

// Live "who else is here" + cursor positions for a board, backed by Realtime
// Database (see subscribeToPresence in lib/firebase.ts). No-ops safely if RTDB
// isn't configured for this project — presence is a nice-to-have, not required
// for the rest of the app to function.
export function usePresence(boardId: string | null, user: User | null) {
  const [peers, setPeers] = useState<Record<string, PresenceInfo>>({});
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!boardId || !user) return;

    const name = user.displayName || user.email?.split('@')[0] || 'Anonymous';
    joinPresence(boardId, user.uid, { name, color: colorForUid(user.uid) }).catch(err => console.error('Error joining presence:', err));

    const unsubscribe = subscribeToPresence(boardId, (all) => {
      const others = { ...all };
      delete others[user.uid];
      setPeers(others);
    });

    return () => {
      unsubscribe();
      leavePresence(boardId, user.uid).catch(err => console.error('Error leaving presence:', err));
      setPeers({});
    };
  }, [boardId, user]);

  const updateCursor = useCallback((cursor: Point | null) => {
    if (!boardId || !user) return;
    const now = Date.now();
    if (cursor && now - lastSentRef.current < CURSOR_THROTTLE_MS) return;
    lastSentRef.current = now;
    updateCursorPosition(boardId, user.uid, cursor);
  }, [boardId, user]);

  return { peers, updateCursor };
}

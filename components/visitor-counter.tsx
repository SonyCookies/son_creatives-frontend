"use client";

import { useEffect, useState } from "react";
import { trackVisitor, subscribeToVisitorStats } from "@/lib/firebase-service";

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // 1. Prevent double tracking in same session to be more accurate
    const hasVisited = sessionStorage.getItem("sv_session_tracked");
    if (!hasVisited) {
      trackVisitor().catch(console.error);
      sessionStorage.setItem("sv_session_tracked", "true");
    }

    // 2. Subscribe to real-time updates for that premium "live" feel
    const unsubscribe = subscribeToVisitorStats((stats) => {
      setCount(stats?.visitor_count ?? null);
    });

    return () => unsubscribe();
  }, []);

  if (count === null) return null;

  return (
    <div className="flex items-center gap-2.5 transition-opacity duration-700 ease-in-out">
      <div className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--muted)] opacity-40"></span>
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--muted)] opacity-60"></span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--muted)] opacity-50">
        {count.toLocaleString()} Views
      </span>
    </div>
  );
}

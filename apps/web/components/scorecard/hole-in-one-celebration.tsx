"use client";

/**
 * Full-screen hole-in-one celebration: confetti-ish burst + headline that
 * holds for ~1.6s, then calls onDone. Purely visual — the score is already
 * recorded when this shows. Mirrored at
 * apps/native/components/scorecard/hole-in-one-celebration.tsx.
 */
import { useEffect } from "react";

/** How long the celebration holds before onDone (drives nav delays too). */
export const HOLE_IN_ONE_CELEBRATION_MS = 2800;

const CONFETTI = ["🎉", "⛳️", "🎊", "🏌️", "✨", "🎉"] as const;

export function HoleInOneCelebration({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onDone?.(), HOLE_IN_ONE_CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay animate-in fade-in-0"
      role="status"
      aria-live="polite"
    >
      {CONFETTI.map((emoji, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-[55%] text-figure animate-bounce"
          style={{ left: `${8 + i * 15}%` }}
        >
          {emoji}
        </span>
      ))}
      <div className="flex flex-col items-center gap-sm rounded-lg bg-background px-lg py-lg animate-in zoom-in-75 duration-300">
        <span className="text-display" aria-hidden>
          ⛳️
        </span>
        <span className="text-figure">HOLE IN ONE!</span>
        <span className="text-body-sm text-muted-foreground">
          One swing. That&apos;s the whole hole.
        </span>
      </div>
    </div>
  );
}

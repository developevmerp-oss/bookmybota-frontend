"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type BookingSuccessCheckAnimationProps = {
  /** Unique per successful booking — animation plays once when this changes. */
  playKey: string;
  className?: string;
};

const TOTAL_MS = 1800;
const CONFETTI_COUNT = 14;

/** Survives remounts — same booking never animates twice in a session. */
const playedSuccessKeys = new Set<string>();

const CONFETTI_COLORS = [
  "#1f9d55",
  "#34d399",
  "#6900AA",
  "#9b5de5",
  "#c4b5fd",
  "#86efac",
];

/**
 * One-shot booking success check + confetti.
 * Plays only when `playKey` changes (new booking). Does not loop or re-trigger on scroll/hover.
 */
export default function BookingSuccessCheckAnimation({
  playKey,
  className = "",
}: BookingSuccessCheckAnimationProps) {
  const [phase, setPhase] = useState<"animating" | "done">(() =>
    playedSuccessKeys.has(playKey) ? "done" : "animating"
  );

  useEffect(() => {
    if (playedSuccessKeys.has(playKey)) {
      setPhase("done");
      return;
    }
    playedSuccessKeys.add(playKey);
    setPhase("animating");
    const t = window.setTimeout(() => setPhase("done"), TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [playKey]);

  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = (360 / CONFETTI_COUNT) * i + (i % 3) * 8;
        const dist = 28 + (i % 5) * 7;
        const rad = (angle * Math.PI) / 180;
        return {
          id: i,
          x: Math.cos(rad) * dist,
          y: Math.sin(rad) * dist,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 3 + (i % 3),
          delay: 0.72 + (i % 6) * 0.03,
          rot: (i * 37) % 360,
        };
      }),
    // Stable layout for this playKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playKey]
  );

  const animating = phase === "animating";

  return (
    <span
      className={`relative inline-flex h-11 w-11 items-center justify-center shrink-0 ${className}`}
      aria-hidden
    >
      <style>{`
        @keyframes bmbSuccessCircleIn {
          0% { transform: scale(0.35); opacity: 0.5; }
          55% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bmbSuccessCheckDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes bmbSuccessBounce {
          0% { transform: scale(1); }
          35% { transform: scale(1.14); }
          60% { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        @keyframes bmbSuccessConfetti {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0; }
          12% { opacity: 1; }
          100% {
            transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.4);
            opacity: 0;
          }
        }
        .bmb-success-circle-anim {
          animation: bmbSuccessCircleIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .bmb-success-bounce-anim {
          animation: bmbSuccessBounce 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) 0.85s both;
        }
        .bmb-success-check-anim {
          stroke-dasharray: 28;
          stroke-dashoffset: 28;
          animation: bmbSuccessCheckDraw 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.28s forwards;
        }
        .bmb-success-confetti {
          animation: bmbSuccessConfetti 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: var(--delay);
        }
      `}</style>

      {animating &&
        particles.map((p) => (
          <span
            key={`${playKey}-${p.id}`}
            className="bmb-success-confetti pointer-events-none absolute left-1/2 top-1/2 rounded-[1px]"
            style={
              {
                width: p.size,
                height: p.size * (p.id % 2 === 0 ? 1.6 : 1),
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                backgroundColor: p.color,
                "--dx": `${p.x}px`,
                "--dy": `${p.y}px`,
                "--rot": `${p.rot}deg`,
                "--delay": `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}

      <span
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#d9f6e4] ${
          animating ? "bmb-success-circle-anim bmb-success-bounce-anim" : ""
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-[1]"
          aria-hidden
        >
          <path
            d="M5 13l4 4L19 7"
            stroke="#14532d"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animating ? "bmb-success-check-anim" : undefined}
          />
        </svg>
      </span>
    </span>
  );
}

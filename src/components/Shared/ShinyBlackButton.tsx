"use client";

import { useState, type ReactNode } from "react";

/**
 * Universal shiny booking CTA — one-time shine on mount (dining Book a Table parity).
 * Use for Book Now / Proceed / Pay / Confirm across events, movies, and dining.
 */
export default function ShinyBlackButton({
  type = "button",
  disabled = false,
  onClick,
  className = "",
  children,
  ariaBusy,
  form,
}: {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
  ariaBusy?: boolean;
  form?: string;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const handlePointerDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const x = e.clientX ? e.clientX - rect.left - size / 2 : rect.width / 2 - size / 2;
    const y = e.clientY ? e.clientY - rect.top - size / 2 : rect.height / 2 - size / 2;
    const id = Date.now() + Math.random();

    setRipples((prev) => [...prev, { id, x, y, size }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 650);
  };

  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      aria-busy={ariaBusy}
      onMouseDown={handlePointerDown}
      onClick={onClick}
      className={`bmb-shiny-btn group relative isolate overflow-hidden rounded-xl font-bold transition-all duration-200 select-none ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "active:scale-[0.98] active:brightness-95 hover:brightness-110 hover:shadow-lg hover:shadow-black/30 cursor-pointer"
      } ${className}`}
    >
      {/* Keep fill opaque so shine never washes the black on light backgrounds */}
      <span
        className="pointer-events-none absolute inset-0 -z-[1] bg-[inherit] rounded-[inherit]"
        aria-hidden="true"
      />
      {!disabled && (
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full animate-bmb-shine bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"
          aria-hidden="true"
        />
      )}
      {!disabled && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
      )}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="bmb-shiny-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
          aria-hidden="true"
        />
      ))}
      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide w-full">
        {children}
      </span>
    </button>
  );
}

"use client";

import React, { useEffect, useState } from "react";

interface DraftNumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places kept when the value is applied. Whole numbers are not forced when this is left out. */
  decimals?: number;
  className?: string;
  "aria-label": string;
}

/**
 * A number box you can type freely in. The value is applied (and kept inside min and max) when you leave the box
 * or press Enter, so typing "1" on the way to "18" is not cut off to the minimum.
 */
export default function DraftNumberInput({
  value,
  onCommit,
  min,
  max,
  decimals,
  className,
  "aria-label": ariaLabel,
}: DraftNumberInputProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Follow outside changes (dragging a handle, another field) whenever the box is not being typed in
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    const n = parseFloat(text.replace(",", "."));
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    let next = n;
    if (decimals !== undefined) {
      const f = 10 ** decimals;
      next = Math.round(next * f) / f;
    }
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setText(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setText(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

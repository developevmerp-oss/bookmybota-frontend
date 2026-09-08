"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  code?: string | null;
  codeMasked?: string | null;
  /** Visual tone for list (dark text) vs detail hero (light on purple) */
  tone?: "dark" | "light";
  className?: string;
};

/**
 * Masked gift-card code with eye toggle to reveal the full code.
 */
export default function GiftCardCodeReveal({
  code,
  codeMasked,
  tone = "dark",
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false);
  const full = (code || "").trim().toUpperCase();
  const masked =
    (codeMasked || "").trim() ||
    (full ? `****-****-****-${full.slice(-4)}` : "————");
  const canReveal = Boolean(full);
  const display = visible && canReveal ? full : masked;

  const textClass =
    tone === "light"
      ? "text-white/85"
      : "text-[#6B7280]";
  const btnClass =
    tone === "light"
      ? "text-white/80 hover:text-white hover:bg-white/15"
      : "text-[#9CA3AF] hover:text-[#6900AA] hover:bg-[#F3E8FF]";

  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 max-w-full ${className}`}>
      <span
        className={`font-mono tracking-[0.06em] text-[12px] sm:text-[13px] truncate ${textClass}`}
        title={visible && canReveal ? full : undefined}
      >
        {display}
      </span>
      {canReveal ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible((v) => !v);
          }}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors cursor-pointer ${btnClass}`}
          aria-label={visible ? "Hide gift card code" : "Show gift card code"}
          title={visible ? "Hide code" : "Show code"}
        >
          {visible ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
        </button>
      ) : null}
    </span>
  );
}

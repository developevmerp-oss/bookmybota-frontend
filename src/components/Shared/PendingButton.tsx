"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** When true, the button is disabled and shows loading UI. */
  pending?: boolean;
  /** Optional label while pending; defaults to `children`. */
  pendingLabel?: ReactNode;
  /** Show spinner beside label (default true when pending). */
  showSpinner?: boolean;
};

/**
 * Primary/action button that disables and shows a spinner while an API call is in progress.
 */
export default function PendingButton({
  pending = false,
  pendingLabel,
  showSpinner = true,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}: PendingButtonProps) {
  const isDisabled = Boolean(disabled || pending);
  const label = pending && pendingLabel != null ? pendingLabel : children;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      className={`${className} disabled:cursor-not-allowed`.trim()}
      {...rest}
    >
      {pending && showSpinner ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin shrink-0" aria-hidden />
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

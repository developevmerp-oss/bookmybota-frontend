"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Mail, X } from "lucide-react";
import { FaFacebookF, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { toast } from "sonner";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

export type ShareSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Page / item URL to share. */
  url?: string;
  /** Primary title in the sheet header (e.g. restaurant name). */
  title?: string;
  /** Optional share message body. Defaults to title + url. */
  text?: string;
};

type ShareAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
};

/**
 * District-style share sheet:
 * - Mobile: bottom sheet with pill action rows
 * - Tablet / desktop: centered modal, same options
 */
export default function ShareSheet({
  open,
  onClose,
  url,
  title = "",
  text,
}: ShareSheetProps) {
  const shareUrl = useMemo(() => {
    if (url) return url;
    if (typeof window !== "undefined") return window.location.href;
    return "";
  }, [url, open]);

  const shareText = useMemo(() => {
    if (text?.trim()) return text.trim();
    if (title.trim()) return title.trim();
    return "Check this out on Book My Bota";
  }, [text, title]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedCombined = encodeURIComponent(`${shareText} ${shareUrl}`.trim());

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
      onClose();
    } catch {
      toast.error("Could not copy link");
    }
  };

  // Use Gmail compose (not mailto). mailto opens a blank tab or does nothing when
  // Chrome has no default mail app — common on desktop and in device emulator.
  const emailHref = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodedText}&body=${encodedCombined}`;

  const actions: ShareAction[] = [
    {
      id: "copy",
      label: "Copy link",
      icon: <Copy size={18} strokeWidth={2} className="text-[#444]" />,
      onClick: () => void copyLink(),
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] text-white">
          <FaWhatsapp size={15} />
        </span>
      ),
      href: `https://wa.me/?text=${encodedCombined}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2] text-white">
          <FaFacebookF size={13} />
        </span>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      id: "twitter",
      label: "Twitter",
      icon: (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#111] text-white">
          <FaXTwitter size={13} />
        </span>
      ),
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      id: "email",
      label: "Email",
      icon: <Mail size={18} strokeWidth={2} className="text-[#444]" />,
      href: emailHref,
    },
  ];

  const subtitle = title.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className={
          "relative z-[1] w-full bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.18)] " +
          "rounded-t-[1.25rem] sm:rounded-2xl " +
          "max-h-[min(92vh,40rem)] sm:max-h-[min(88vh,36rem)] " +
          "sm:max-w-[26rem] md:max-w-[28rem] " +
          "flex flex-col overflow-hidden " +
          "pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag hint */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-[#D8D8D8]" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-5 pb-3.5 sm:pb-4 border-b border-[#EBEBEB]">
          <div className="min-w-0">
            <h3
              id="share-sheet-title"
              className="text-[1.25rem] sm:text-[1.35rem] font-bold text-[#111] leading-tight"
            >
              Share
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-[0.8125rem] sm:text-sm font-medium text-[#8A8A8A] truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share"
            className="shrink-0 mt-0.5 h-9 w-9 inline-flex items-center justify-center rounded-full text-[#666] hover:bg-[#F3F3F3] cursor-pointer transition-colors"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-4 sm:py-5">
          <ul className="flex flex-col gap-2.5 sm:gap-3">
            {actions.map((action) => {
              const rowClass =
                "flex w-full items-center gap-3.5 rounded-full border border-[#E4E4E4] bg-white " +
                "px-4 sm:px-5 py-3 sm:py-3.5 text-left text-[0.9375rem] sm:text-base font-medium text-[#222] " +
                "hover:bg-[#FAFAFA] active:bg-[#F5F5F5] transition-colors cursor-pointer";

              const content = (
                <>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">
                    {action.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{action.label}</span>
                </>
              );

              if (action.href) {
                return (
                  <li key={action.id}>
                    <a
                      href={action.href}
                      target="_blank"
                      rel="noreferrer"
                      className={rowClass}
                      onClick={onClose}
                    >
                      {content}
                    </a>
                  </li>
                );
              }

              return (
                <li key={action.id}>
                  <button type="button" className={rowClass} onClick={action.onClick}>
                    {content}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}

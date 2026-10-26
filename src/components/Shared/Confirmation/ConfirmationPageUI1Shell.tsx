"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Film,
  Link2,
  Loader2,
  Phone,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import images from "@/Images";

const PAGE_BG = "#F2F2F2";
const PAGE_MAX = "mx-auto w-full max-w-[72rem] px-4 sm:px-6 lg:px-10";
const CUT_SIZE = 24;
const HIDE_SCROLLBAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

function BrandLogo() {
  return (
    <div className="mt-6 flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="BookMyBota" className="h-10 sm:h-11 w-auto object-contain" />
    </div>
  );
}

export type ConfirmationAmountRow = {
  label: string;
  value: string;
  strong?: boolean;
};

export type ConfirmationPageUI1ShellProps = {
  /** When false, ticket is centered (no rating column). */
  showAside?: boolean;
  aside?: ReactNode;
  backHref?: string;
  pageTitle?: string;
  tipBanner?: string;
  title: string;
  posterUrl?: string;
  formatMeta?: string;
  whenLine?: string;
  venueLine?: string;
  offerLabel?: string;
  ticketCountLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  bookingCode: string;
  qrValue: string;
  totalFormatted?: string;
  /** Shown under Total Amount, e.g. convenience fee included in the total. */
  totalNote?: string;
  amountRows?: ConfirmationAmountRow[];
  cancellationNote?: string;
  supportHref?: string;
  mTicketLabel?: string;
  onDownloadPdf?: () => void | Promise<void>;
  downloading?: boolean;
  /** Public listing for this panel (movie, event, or restaurant). */
  exploreHref?: string;
  /** Extra footer under amount in details modal / bottom of card */
  detailsExtra?: ReactNode;
  /** Whether to render QR code (defaults to true; set to false for dining) */
  showQr?: boolean;
  /** When true, renders ticket details & actions directly on the card without popup modal */
  directDetails?: boolean;
};

function ticketNotchMask(corners: {
  topLeft?: boolean;
  topRight?: boolean;
  bottomLeft?: boolean;
  bottomRight?: boolean;
}): CSSProperties {
  const r = CUT_SIZE / 2;
  const holes: string[] = [];
  if (corners.topLeft) {
    holes.push(`radial-gradient(circle ${r}px at 0 0, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.topRight) {
    holes.push(`radial-gradient(circle ${r}px at 100% 0, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.bottomLeft) {
    holes.push(`radial-gradient(circle ${r}px at 0 100%, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.bottomRight) {
    holes.push(`radial-gradient(circle ${r}px at 100% 100%, #000 ${r}px, transparent ${r}px)`);
  }
  if (!holes.length) return {};
  const image = [`linear-gradient(#000, #000)`, ...holes].join(", ");
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskComposite: holes.map(() => "destination-out").join(", "),
    maskComposite: holes.map(() => "exclude").join(", "),
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  };
}

function TicketCut({ fill = PAGE_BG }: { fill?: string }) {
  return (
    <div className="relative z-30 h-0 pointer-events-none select-none" aria-hidden>
      <span
        className="absolute top-0 left-0 rounded-full"
        style={{
          width: CUT_SIZE,
          height: CUT_SIZE,
          backgroundColor: fill,
          transform: "translate(-50%, -50%)",
        }}
      />
      <span
        className="absolute top-0 right-0 rounded-full"
        style={{
          width: CUT_SIZE,
          height: CUT_SIZE,
          backgroundColor: fill,
          transform: "translate(50%, -50%)",
        }}
      />
    </div>
  );
}

/** Hairline inside a masked band — inset past notch radius so it never crosses the cut. */
function TicketBandEdgeLine({ edge }: { edge: "top" | "bottom" }) {
  const inset = CUT_SIZE + 2;
  return (
    <div
      className={`pointer-events-none ${edge === "top" ? "pt-0" : "pb-0"}`}
      aria-hidden
    >
      <div
        className={`border-[#E8E8E8] ${edge === "top" ? "border-t" : "border-b"}`}
        style={{ marginLeft: inset, marginRight: inset }}
      />
    </div>
  );
}

function ModalShell({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-[26rem]",
  overlayClass = "bg-black/50",
  hideHeader = false,
  panelClass = "",
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  overlayClass?: string;
  hideHeader?: boolean;
  panelClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden">
      {/* Translucent scrim so page + ticket cuts show through (not solid black). */}
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer ${overlayClass}`}
        style={
          hideHeader
            ? { backgroundColor: "rgba(0, 0, 0, 0.45)" }
            : undefined
        }
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidthClass} max-h-[min(92vh,52rem)] flex flex-col animate-[confirmHeaderIn_0.28s_ease-out] ${
          hideHeader
            ? `overflow-y-auto ${HIDE_SCROLLBAR} ${panelClass}`
            : "rounded-2xl bg-white shadow-2xl overflow-hidden"
        }`}
      >
        {!hideHeader && title ? (
          <div className="relative shrink-0 flex items-center justify-center border-b border-[#EDEDED] px-5 py-3.5">
            <h2 className="text-[1rem] font-semibold text-[#222]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-[#666] hover:bg-slate-100 rounded-full cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        ) : null}
        <div className={hideHeader ? "" : `min-h-0 flex-1 overflow-y-auto ${HIDE_SCROLLBAR}`}>
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-[#EDEDED] px-6 py-4">{footer}</div> : null}
      </div>
      <style>{`
        @keyframes confirmHeaderIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Shared BMS-style confirmation shell for dining / event (and movie if needed).
 * No rating column unless `showAside` + `aside` are provided — otherwise ticket is centered.
 */
export default function ConfirmationPageUI1Shell(props: ConfirmationPageUI1ShellProps) {
  const {
    showAside = false,
    aside,
    backHref = "/customer/dashboard",
    pageTitle = "Your Ticket",
    tipBanner = "Ticket shared on the contact details provided, have it handy on your phone while entering the venue.",
    title,
    posterUrl = "",
    formatMeta,
    whenLine,
    venueLine,
    offerLabel,
    ticketCountLabel,
    primaryLabel,
    secondaryLabel,
    bookingCode,
    qrValue,
    totalFormatted,
    totalNote,
    amountRows = [],
    cancellationNote = "Cancellation unavailable : cut-off time of 20 minutes before showtime has passed",
    supportHref = "/customer/help",
    mTicketLabel = "M-Ticket",
    onDownloadPdf,
    downloading = false,
    exploreHref,
    detailsExtra,
    showQr = true,
    directDetails = true,
  } = props;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Ticket link copied to clipboard!");
      setShareOpen(false);
    } catch {
      toast.error("Could not copy the link. Please try again.");
    }
  };

  const headerBlock = (
    <div className="relative flex gap-3.5 px-4 pt-5 pb-4 pr-10 sm:px-5">
      <div className="relative shrink-0 w-[4.75rem] overflow-hidden rounded-md bg-[#F3F3F3]">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={title}
            className="block h-full w-full object-cover aspect-[2/3]"
          />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
            <Film size={24} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.05rem] sm:text-[1.125rem] font-bold text-[#111] leading-snug">
          {title}
        </h3>
        {formatMeta ? (
          <p className="mt-1.5 text-[0.75rem] md:text-[0.8125rem] text-[#757575]">{formatMeta}</p>
        ) : null}
        {whenLine ? (
          <p className="mt-1 text-[0.75rem] md:text-[0.8125rem] text-[#757575]">{whenLine}</p>
        ) : null}
        {venueLine ? (
          <p className="mt-1 text-[0.75rem] md:text-[0.8125rem] text-[#757575] leading-snug">
            {venueLine}
          </p>
        ) : null}
        {offerLabel ? (
          <p className="mt-2 inline-flex rounded bg-[#111] px-2 py-0.5 text-[0.625rem] font-semibold text-white">
            {offerLabel}
          </p>
        ) : null}
      </div>
      <span
        className="pointer-events-none absolute right-2.5 top-[52%] text-[0.625rem] font-medium tracking-[0.14em] text-[#B8B8B8]"
        style={{
          writingMode: "vertical-rl",
          transform: "translateY(-50%) rotate(180deg)",
        }}
        aria-hidden
      >
        {mTicketLabel}
      </span>
    </div>
  );

  const ticketCard = directDetails ? (
    <div className="relative overflow-visible rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="relative flex gap-3.5 sm:gap-4 px-4 pt-4 pb-5 sm:px-5 sm:pt-5 sm:pb-6 pr-9 sm:pr-11">
        <div className="relative shrink-0 w-[5rem] sm:w-[5.75rem] overflow-hidden rounded-md bg-[#F3F3F3]">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={title}
              className="block h-full w-full object-cover aspect-[2/3]"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
              <Film size={28} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.05rem] sm:text-[1.25rem] font-bold text-[#111] leading-snug">
            {title}
          </h2>
          {formatMeta ? (
            <p className="mt-2 text-[0.8125rem] md:text-[0.875rem] text-[#777]">{formatMeta}</p>
          ) : null}
          {whenLine ? (
            <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777]">{whenLine}</p>
          ) : null}
          {venueLine ? (
            <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777] leading-snug">
              {venueLine}
            </p>
          ) : null}
          {offerLabel ? (
            <p className="mt-2.5 inline-flex items-center rounded bg-[#111] px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              {offerLabel}
            </p>
          ) : null}
        </div>
        <span
          className="pointer-events-none absolute right-3 sm:right-4 top-[55%] text-[0.6875rem] md:text-[0.75rem] font-medium tracking-[0.12em] text-[#B0B0B0]"
          style={{
            writingMode: "vertical-rl",
            transform: "translateY(-50%) rotate(180deg)",
          }}
          aria-hidden
        >
          {mTicketLabel}
        </span>
      </div>

      <TicketCut fill={PAGE_BG} />
      <div className="border-t border-dashed border-[#E8E8E8] mx-6" aria-hidden />

      <div className="px-5 sm:px-6 pt-6 pb-0 text-center">
        <p className="text-[0.75rem] md:text-[0.8125rem] text-[#888] font-medium">{ticketCountLabel}</p>
        <p className="mt-1.5 text-[1.4rem] font-bold text-[#111] uppercase tracking-wide">
          {primaryLabel}
        </p>
        {secondaryLabel ? (
          <p className="mt-1.5 text-[0.8125rem] md:text-[0.875rem] text-[#555] break-words leading-snug">
            {secondaryLabel}
          </p>
        ) : null}

        {showQr ? (
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
                qrValue
              )}`}
              alt={`QR ${bookingCode}`}
              className="mx-auto h-[11.5rem] w-[11.5rem] sm:h-[13rem] sm:w-[13rem] bg-white"
            />
          </div>
        ) : null}

        <p className="mt-4 text-[0.8125rem] font-bold text-[#111] tracking-wide">
          BOOKING ID: {bookingCode}
        </p>

        {cancellationNote ? (
          <div className="mt-5 -mx-5 sm:-mx-6 bg-[#F5F5F5] px-4 sm:px-5 py-2.5 text-center text-[0.6875rem] md:text-[0.8125rem] text-[#757575] leading-snug">
            {cancellationNote}
          </div>
        ) : null}

        <div className="mt-4 mb-5 flex justify-center">
          <Link
            href={supportHref}
            className="inline-flex flex-col items-center gap-1.5 text-[#333] hover:opacity-80 transition-opacity"
          >
            <Phone size={22} strokeWidth={1.6} />
            <span className="text-[0.8125rem] font-medium">Contact support</span>
          </Link>
        </div>
      </div>

      <TicketCut fill={PAGE_BG} />
      <div className="border-t border-dashed border-[#E8E8E8] mx-6" aria-hidden />

      <div className="px-5 sm:px-6 pt-5 pb-6 text-left">
        {totalFormatted || amountRows.length > 0 ? (
          <div className="space-y-2.5 text-[0.8125rem] text-[#666] mb-5">
            {totalFormatted ? (
              <div className="flex justify-between gap-3 text-[0.9375rem] font-bold text-[#111]">
                <div>
                  <span>Total Amount</span>
                  {totalNote ? (
                    <p className="text-[11px] text-[#777] font-normal">{totalNote}</p>
                  ) : null}
                </div>
                <span className="tabular-nums">{totalFormatted}</span>
              </div>
            ) : null}

            {amountRows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                className={`flex justify-between gap-3 ${
                  row.strong ? "text-[#111] font-bold text-[0.9375rem]" : ""
                }`}
              >
                <span>{row.label}</span>
                <span className="tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {onDownloadPdf ? (
          <button
            type="button"
            onClick={() => void onDownloadPdf()}
            disabled={downloading}
            className="inline-flex w-full items-center justify-center gap-1.5 h-11 rounded-xl bg-[#111] hover:bg-[#222] text-white text-[0.875rem] font-semibold disabled:opacity-60 cursor-pointer transition-colors"
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            Download PDF
          </button>
        ) : null}

        {exploreHref ? (
          <Link
            href={exploreHref}
            className="mt-2.5 inline-flex w-full items-center justify-center h-11 rounded-xl border border-[#111] bg-white text-[#111] text-[0.875rem] font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Explore
          </Link>
        ) : null}

        {detailsExtra}
        <BrandLogo />
      </div>
    </div>
  ) : (
    <div className="relative overflow-visible rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="relative flex gap-3.5 sm:gap-4 px-4 pt-4 pb-5 sm:px-5 sm:pt-5 sm:pb-6 pr-9 sm:pr-11">
        <div className="relative shrink-0 w-[5rem] sm:w-[5.75rem] overflow-hidden rounded-md bg-[#F3F3F3]">
          {posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt={title}
              className="block h-full w-full object-cover aspect-[2/3]"
            />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
              <Film size={28} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.05rem] sm:text-[1.25rem] font-bold text-[#111] leading-snug">
            {title}
          </h2>
          {formatMeta ? (
            <p className="mt-2 text-[0.8125rem] md:text-[0.875rem] text-[#777]">{formatMeta}</p>
          ) : null}
          {whenLine ? (
            <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777]">{whenLine}</p>
          ) : null}
          {venueLine ? (
            <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777] leading-snug">
              {venueLine}
            </p>
          ) : null}
          {offerLabel ? (
            <p className="mt-2.5 inline-flex items-center rounded bg-[#111] px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              {offerLabel}
            </p>
          ) : null}
        </div>
        <span
          className="pointer-events-none absolute right-3 sm:right-4 top-[55%] text-[0.6875rem] md:text-[0.75rem] font-medium tracking-[0.12em] text-[#B0B0B0]"
          style={{
            writingMode: "vertical-rl",
            transform: "translateY(-50%) rotate(180deg)",
          }}
          aria-hidden
        >
          {mTicketLabel}
        </span>
      </div>

      <div
        className="relative z-20 print:hidden"
        style={{
          paddingLeft: CUT_SIZE,
          paddingRight: CUT_SIZE,
          marginBottom: -(CUT_SIZE / 2),
        }}
      >
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="relative z-20 w-full rounded-full bg-[#F0F0F0] hover:bg-[#E4E4E4] px-4 py-[0.65rem] text-center text-[0.8125rem] md:text-[0.875rem] font-medium text-[#333] cursor-pointer transition-colors"
        >
          Tap for support, details &amp; more actions
        </button>
      </div>
      <TicketCut fill={PAGE_BG} />

      <div className="px-4 sm:px-5 pt-6 pb-0">
        <div className="flex items-start gap-4 sm:gap-5">
          {showQr ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(
                qrValue
              )}`}
              alt={`QR ${bookingCode}`}
              className="h-[7.25rem] w-[7.25rem] sm:h-[8rem] sm:w-[8rem] shrink-0 bg-white"
            />
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[0.75rem] md:text-[0.8125rem] text-[#888]">{ticketCountLabel}</p>
            <p className="mt-1 text-[1.2rem] sm:text-[1.35rem] font-bold text-[#111] uppercase leading-tight">
              {primaryLabel}
            </p>
            {secondaryLabel ? (
              <p className="mt-1.5 text-[0.8125rem] md:text-[0.875rem] text-[#555] break-words leading-snug">
                {secondaryLabel}
              </p>
            ) : null}
            <p className="mt-3 text-[0.8125rem] md:text-[0.875rem] font-bold text-[#111] tracking-wide">
              BOOKING ID: {bookingCode}
            </p>
          </div>
        </div>

        {cancellationNote ? (
          <div className="mt-5 -mx-4 sm:-mx-5 bg-[#F5F5F5] px-4 sm:px-5 py-2.5 text-center text-[0.6875rem] md:text-[0.8125rem] text-[#777] leading-snug">
            {cancellationNote}
          </div>
        ) : null}

        {totalFormatted ? (
          <div className="flex items-center justify-between gap-3 py-4 text-[0.9375rem] text-[#111]">
            <div>
              <span className="font-medium">Total Amount</span>
              {totalNote ? (
                <p className="text-[11px] text-[#777] font-normal">{totalNote}</p>
              ) : null}
            </div>
            <span className="font-bold tabular-nums">{totalFormatted}</span>
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden pb-12 print:bg-white"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className={`${PAGE_MAX} pt-5 sm:pt-8 print:pt-4`}>
        <div
          className={`mb-5 sm:mb-6 flex items-center gap-2.5 sm:gap-3 ${
            showAside && aside
              ? "mx-auto w-full max-w-[56rem] xl:max-w-[60rem]"
              : "mx-auto w-full max-w-[28rem] xl:max-w-[30rem]"
          }`}
        >
          <Link
            href={backHref}
            className="inline-flex h-9 w-9 items-center justify-center text-[#111] hover:opacity-70 cursor-pointer print:hidden"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </Link>
          <h1 className="text-[1.25rem] sm:text-[1.375rem] font-bold text-[#111]">{pageTitle}</h1>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center text-[#333] hover:opacity-70 cursor-pointer print:hidden"
            aria-label="Share ticket"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div
          className={
            showAside && aside
              ? "mx-auto flex w-full max-w-[56rem] xl:max-w-[60rem] flex-col items-stretch lg:flex-row lg:items-start lg:justify-center gap-6 sm:gap-8 lg:gap-12 xl:gap-14"
              : "mx-auto flex w-full max-w-[28rem] xl:max-w-[30rem] justify-center"
          }
        >
          <div
            className={
              showAside && aside
                ? "min-w-0 w-full lg:w-[28rem] xl:w-[30rem] lg:shrink-0"
                : "min-w-0 w-full max-w-[28rem] xl:max-w-[30rem]"
            }
          >
            {ticketCard}
          </div>

          {showAside && aside ? (
            <div className="w-full lg:w-[22rem] xl:w-[24rem] lg:shrink-0 print:hidden">
              {aside}
            </div>
          ) : null}
        </div>
      </div>

      <ModalShell
        open={shareOpen}
        title="Share"
        onClose={() => setShareOpen(false)}
        maxWidthClass="max-w-[22rem] sm:max-w-[24rem]"
      >
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[0.9375rem] text-[#111] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
        >
          <span>Copy Link</span>
          <Link2 size={20} strokeWidth={1.75} className="shrink-0 text-[#555]" />
        </button>
      </ModalShell>

      <ModalShell
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        hideHeader
        maxWidthClass="max-w-[28rem] sm:max-w-[30rem]"
        overlayClass=""
        panelClass="px-4 sm:px-5"
      >
        {/* No filter on masked ticket — keeps notch holes truly transparent over the scrim */}
        <div className="relative">
          <div
            className="relative bg-white rounded-t-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            style={ticketNotchMask({ bottomLeft: true, bottomRight: true })}
          >
            {headerBlock}
            <div
              className="relative z-20 pb-3"
              style={{ paddingLeft: CUT_SIZE, paddingRight: CUT_SIZE }}
            >
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="relative z-20 w-full rounded-full bg-[#F0F0F0] hover:bg-[#E8E8E8] px-4 py-[0.6rem] text-center text-[0.8125rem] font-medium text-[#333] cursor-pointer"
              >
                Tap to hide details
              </button>
            </div>
            <TicketBandEdgeLine edge="bottom" />
          </div>

          <div
            className="relative bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
            style={ticketNotchMask({
              topLeft: true,
              topRight: true,
              bottomLeft: true,
              bottomRight: true,
            })}
          >
            <div className="px-6 sm:px-7 pt-7 pb-0 text-center">
              <p className="text-[0.75rem] md:text-[0.8125rem] text-[#888]">{ticketCountLabel}</p>
              <p className="mt-1.5 text-[1.4rem] font-bold text-[#111] uppercase tracking-wide">
                {primaryLabel}
              </p>
              {secondaryLabel ? (
                <p className="mt-1.5 text-[0.8125rem] md:text-[0.875rem] text-[#555] break-words leading-snug">
                  {secondaryLabel}
                </p>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
                  qrValue
                )}`}
                alt={`QR ${bookingCode}`}
                className="mx-auto mt-5 h-[12rem] w-[12rem] sm:h-[13rem] sm:w-[13rem] bg-white"
              />
              <p className="mt-4 text-[0.8125rem] font-bold text-[#111] tracking-wide">
                BOOKING ID: {bookingCode}
              </p>
              {cancellationNote ? (
                <div className="mt-5 -mx-6 sm:-mx-7 bg-[#F5F5F5] px-4 py-2.5 text-[0.6875rem] md:text-[0.8125rem] text-[#757575] leading-snug">
                  {cancellationNote}
                </div>
              ) : null}
              <Link
                href={supportHref}
                className="mt-5 mb-6 inline-flex flex-col items-center gap-1.5 text-[#333] hover:opacity-80"
              >
                <Phone size={22} strokeWidth={1.6} />
                <span className="text-[0.8125rem] font-medium">Contact support</span>
              </Link>
            </div>
            <TicketBandEdgeLine edge="bottom" />
          </div>

          <div
            className="relative bg-white rounded-b-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            style={ticketNotchMask({ topLeft: true, topRight: true })}
          >
            <div className="px-6 sm:px-7 pt-5 pb-6 text-left">
              {amountRows.length || totalFormatted ? (
                <div className="space-y-2.5 text-[0.8125rem] text-[#666]">
                  {totalFormatted ? (
                    <div className="flex justify-between gap-3 text-[0.9375rem] font-bold text-[#111]">
                      <div>
                        <span>Total Amount</span>
                        {totalNote ? (
                          <p className="text-[11px] text-[#777] font-normal">{totalNote}</p>
                        ) : null}
                      </div>
                      <span className="tabular-nums">{totalFormatted}</span>
                    </div>
                  ) : null}
                  {amountRows.map((row, idx) => (
                    <div
                      key={`${row.label}-${idx}`}
                      className={`flex justify-between gap-3 ${
                        row.strong ? "text-[#111] font-medium" : ""
                      }`}
                    >
                      <span>{row.label}</span>
                      <span className="tabular-nums">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {onDownloadPdf ? (
                <button
                  type="button"
                  onClick={() => void onDownloadPdf()}
                  disabled={downloading}
                  className="mt-5 inline-flex w-full items-center justify-center gap-1.5 h-11 rounded-lg bg-[#111] text-white text-[0.875rem] font-semibold hover:bg-[#333] disabled:opacity-60 cursor-pointer"
                >
                  {downloading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  Download PDF
                </button>
              ) : null}
              {exploreHref ? (
                <Link
                  href={exploreHref}
                  className="mt-2.5 inline-flex w-full items-center justify-center h-11 rounded-lg border border-[#111] bg-white text-[#111] text-[0.875rem] font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Explore
                </Link>
              ) : null}
              {detailsExtra}
              <BrandLogo />
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

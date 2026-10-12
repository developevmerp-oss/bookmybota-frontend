/** Page bg on dining / movie / event confirmation — notch fill must match. */
export const BOOKING_CONFIRM_PAGE_BG = "#F2F2F2";

type Props = {
  className?: string;
  /** Hide decorative cuts when printing (e.g. movie print view). */
  hideOnPrint?: boolean;
};

/**
 * Ticket stub divider: dashed line + left/right punch cuts (page bg shows through).
 */
export default function BookingTicketPerforation({
  className = "",
  hideOnPrint = false,
}: Props) {
  return (
    <div
      className={`relative z-10 h-5 shrink-0 pointer-events-none ${hideOnPrint ? "print:hidden" : ""} ${className}`.trim()}
      aria-hidden
    >
      <div className="absolute inset-x-5 sm:inset-x-6 top-1/2 border-t border-dashed border-slate-300" />
      <span
        className="absolute -left-[10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: BOOKING_CONFIRM_PAGE_BG }}
      />
      <span
        className="absolute -right-[10px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: BOOKING_CONFIRM_PAGE_BG }}
      />
    </div>
  );
}

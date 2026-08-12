"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, Minus, Plus, Tag, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventBookingMutation,
  useGetCustomerProfileQuery,
  useValidateEventPromoCodeMutation,
  type AppliedPromoOffer,
  type OrganizerEvent,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { getPhoneValidationError, sanitizePhoneInput } from "@/lib/validation";

function formatInr(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type EventCheckoutMode = "customer" | "organizer";

export type EventCheckoutResult = {
  booking_id?: string;
  qr_code?: string;
  grand_total?: number;
  ticket_qty?: number;
};

type Props = {
  event: OrganizerEvent;
  open: boolean;
  initialShowtimeId?: string;
  onClose: () => void;
  mode?: EventCheckoutMode;
  onOrganizerSuccess?: (result: EventCheckoutResult) => void;
};

export default function EventCheckout({
  event,
  open,
  initialShowtimeId,
  onClose,
  mode = "customer",
  onOrganizerSuccess,
}: Props) {
  const isOrganizer = mode === "organizer";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState(1);
  const [showtimeId, setShowtimeId] = useState("");
  const [qtyByType, setQtyByType] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const customerId = authUser?.role === "customer" ? authUser.customer_id || "" : "";
  const { data: profile } = useGetCustomerProfileQuery(customerId, { skip: !customerId || isOrganizer });
  const [createEventBooking] = useCreateEventBookingMutation();
  const [validatePromo, { isLoading: validatingPromo }] = useValidateEventPromoCodeMutation();

  useEffect(() => {
    if (!isOrganizer) dispatch(loadFromStorage());
  }, [dispatch, isOrganizer]);

  useEffect(() => {
    if (!open) return;
    setShowtimeId(initialShowtimeId || "");
    setStep(initialShowtimeId ? 2 : 1);
    setQtyByType({});
    setName("");
    setPhone("");
    setEmail("");
    setPromoInput("");
    setAppliedPromo(null);
    setSubmitting(false);
  }, [open, event.id, initialShowtimeId]);

  useEffect(() => {
    if (isOrganizer || authUser?.role !== "customer") return;
    setName(profile?.name || authUser.name || "");
    setPhone(sanitizePhoneInput(profile?.phone || authUser.phone || ""));
    setEmail(profile?.email || authUser.email || "");
  }, [authUser, profile, isOrganizer]);

  const showtimes = event.showtimes || [];
  const ticketTypes = event.ticket_types || [];
  const selectedShowtime = showtimes.find((s) => s.id === showtimeId);
  const conveniencePct = Number(event.convenience_fee_percent) || 0;

  const selectedLines = useMemo(
    () =>
      ticketTypes
        .map((t) => ({
          ...t,
          qty: qtyByType[t.id] || 0,
          unit: Number(t.price) || 0,
          available: Number(t.available_count) || 0,
        }))
        .filter((t) => t.qty > 0),
    [ticketTypes, qtyByType]
  );

  const ticketAmount = moneySum(selectedLines.map((l) => l.unit * l.qty));
  const discountAmount = !isOrganizer && appliedPromo ? appliedPromo.discount_amount : 0;
  const netTicketAmount = moneySum([Math.max(0, ticketAmount - discountAmount)]);
  const convenienceFee = moneySum([(netTicketAmount * conveniencePct) / 100]);
  const grandTotal = moneySum([netTicketAmount, convenienceFee]);
  const ticketQty = selectedLines.reduce((sum, l) => sum + l.qty, 0);

  const setQty = (id: string, next: number, max: number) => {
    setAppliedPromo(null);
    setPromoInput("");
    setQtyByType((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(max, next)),
    }));
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error("Enter a promo code.");
      return;
    }
    try {
      const result = await validatePromo({
        eventId: event.id,
        promo_code: code,
        ticket_amount: ticketAmount,
      }).unwrap();
      setAppliedPromo(result);
      toast.success(`Promo code "${result.promo_code}" applied!`);
    } catch (err) {
      setAppliedPromo(null);
      toast.error(extractApiError(err, "Invalid or expired promo code."));
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showtimeId || selectedLines.length === 0) return;

    const phoneErr = getPhoneValidationError(phone);
    if (!name.trim()) {
      toast.error(isOrganizer ? "Please enter the customer's name." : "Please enter your name.");
      return;
    }
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }
    if (!email.trim()) {
      toast.error("Enter an email so we can send the tickets.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const items = selectedLines.map((l) => ({ ticket_type_id: l.id, qty: l.qty }));
      const guest_name = name.trim();
      const guest_phone = sanitizePhoneInput(phone);
      const guest_email = email.trim() || undefined;

      let result;
      if (isOrganizer) {
        result = await createEventBooking({
          event_id: event.id,
          showtime_id: showtimeId,
          items,
          guest_name,
          guest_phone,
          guest_email,
          booking_source: "ORGANIZER",
          for_organizer: true,
        }).unwrap();
      } else {
        result = await createEventBooking({
          event_id: event.id,
          showtime_id: showtimeId,
          items,
          guest_name,
          guest_phone,
          guest_email,
          customer_id: customerId || undefined,
          booking_source: "ONLINE",
          promo_code: appliedPromo?.promo_code,
        }).unwrap();
      }

      if (isOrganizer) {
        toast.success(`Tickets booked and sent to ${email.trim()}.`);
        onOrganizerSuccess?.(result);
        onClose();
      } else {
        toast.success(`Tickets booked! Confirmation sent to ${email.trim()}.`);
        onClose();
        if (result.booking_id) {
          router.push(`/customer/event-bookings/confirmation?id=${result.booking_id}`);
        }
      }
    } catch (err) {
      toast.error(extractApiError(err, "Booking failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const accentBtn = isOrganizer
    ? "bg-violet-600 hover:bg-violet-700"
    : "bg-rose-600 hover:bg-rose-700";
  const accentBorder = isOrganizer ? "border-violet-500 bg-violet-50" : "border-rose-500 bg-rose-50";
  const accentHover = isOrganizer ? "hover:border-violet-200" : "hover:border-rose-200";
  const accentIcon = isOrganizer ? "text-violet-500" : "text-rose-500";
  const accentFocus = isOrganizer ? "focus:border-violet-500" : "focus:border-rose-500";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close checkout"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Step {step} of 3
                {isOrganizer && " · Organizer sale"}
              </p>
              <h3 className="text-base font-black text-slate-800">
                {step === 1 ? "Choose showtime" : step === 2 ? "Select tickets" : "Order summary"}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 1 && (
            <div className="space-y-3">
              {showtimes.length === 0 ? (
                <p className="text-sm text-slate-500">Showtimes coming soon.</p>
              ) : (
                showtimes.map((s) => {
                  const active = showtimeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setShowtimeId(s.id)}
                      className={`w-full text-left rounded-2xl border p-4 transition-all ${
                        active
                          ? `${accentBorder} shadow-sm`
                          : `border-slate-200 bg-white ${accentHover}`
                      }`}
                    >
                      <p className="font-bold text-slate-800">{s.venue_name || "Venue TBA"}</p>
                      {s.venue_address && (
                        <p className="text-xs text-slate-500 mt-0.5">{s.venue_address}</p>
                      )}
                      <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                        <CalendarDays size={14} />
                        {formatDateTime12h(s.starts_at)}
                        {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {ticketTypes.length === 0 ? (
                <p className="text-sm text-slate-500">No ticket types yet.</p>
              ) : (
                ticketTypes.map((t) => {
                  const available = Number(t.available_count) || 0;
                  const qty = qtyByType[t.id] || 0;
                  return (
                    <div
                      key={t.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{t.ticket_type}</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">
                          {formatInr(Number(t.price) || 0)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{available} available</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => setQty(t.id, qty - 1, available)}
                          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800">{qty}</span>
                        <button
                          type="button"
                          disabled={qty >= available}
                          onClick={() => setQty(t.id, qty + 1, available)}
                          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {step === 3 && (
            <form id="event-checkout-form" onSubmit={handleConfirm} className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5`}>
                  <Ticket size={14} className={accentIcon} /> Order summary
                </h4>
                <p className="text-sm font-semibold text-slate-800">{event.name}</p>
                {selectedShowtime && (
                  <p className="text-xs text-slate-500">
                    {selectedShowtime.venue_name} · {formatDateTime12h(selectedShowtime.starts_at)}
                  </p>
                )}
                <ul className="space-y-1.5 pt-2 border-t border-slate-100">
                  {selectedLines.map((l) => (
                    <li key={l.id} className="flex justify-between text-sm text-slate-600">
                      <span>
                        {l.ticket_type} × {l.qty}
                      </span>
                      <span className="font-semibold text-slate-800">{formatInr(l.unit * l.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm text-slate-600 pt-2 border-t border-slate-100">
                  <span>Tickets</span>
                  <span className="font-semibold text-slate-800">{formatInr(ticketAmount)}</span>
                </div>
                {!isOrganizer && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Tag size={12} /> Promo code
                    </p>
                    {appliedPromo ? (
                      <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-800 truncate">
                            {appliedPromo.promo_code} · {appliedPromo.title}
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            You save {formatInr(appliedPromo.discount_amount)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="text-xs font-semibold text-emerald-800 hover:underline shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          placeholder="Enter promo code"
                          className={`flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none ${accentFocus} text-slate-800 font-semibold uppercase`}
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={validatingPromo || !promoInput.trim()}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                        >
                          {validatingPromo ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>Promo discount</span>
                    <span className="font-semibold">−{formatInr(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Convenience fee{conveniencePct ? ` (${conveniencePct}%)` : ""}</span>
                  <span className="font-semibold text-slate-800">{formatInr(convenienceFee)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total payable</span>
                  <span>{formatInr(grandTotal)}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {ticketQty} ticket{ticketQty === 1 ? "" : "s"}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">
                  {isOrganizer ? "Customer contact details" : "Contact details"}
                </h4>
                {isOrganizer ? (
                  <p className="text-xs text-slate-500">
                    Enter the attendee&apos;s information. Same fields as the public booking flow.
                  </p>
                ) : (
                  authUser?.role !== "customer" && (
                    <p className="text-xs text-slate-500">
                      Booking as guest.{" "}
                      <Link href="/login" className="text-rose-600 font-semibold hover:underline">
                        Log in
                      </Link>{" "}
                      to save this booking to My Bookings.
                    </p>
                  )
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Full name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none ${accentFocus} text-slate-800 font-semibold`}
                    placeholder={isOrganizer ? "Customer name" : "Your name"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Phone
                  </label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    maxLength={12}
                    className={`w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none ${accentFocus} text-slate-800 font-semibold`}
                    placeholder="9900000000"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none ${accentFocus} text-slate-800 font-semibold`}
                    placeholder="you@example.com"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Tickets and QR code will be sent to this email.
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-white">
          {step === 1 && (
            <button
              type="button"
              disabled={!showtimeId}
              onClick={() => setStep(2)}
              className={`w-full py-3.5 rounded-2xl ${accentBtn} disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold text-sm`}
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={ticketQty < 1}
              onClick={() => setStep(3)}
              className={`w-full py-3.5 rounded-2xl ${accentBtn} disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold text-sm`}
            >
              Review order
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              form="event-checkout-form"
              disabled={submitting}
              className={`w-full py-3.5 rounded-2xl ${accentBtn} disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2`}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Confirm booking · {formatInr(grandTotal)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function moneySum(values: number[]) {
  return Math.round(values.reduce((sum, n) => sum + (Number(n) || 0), 0) * 100) / 100;
}

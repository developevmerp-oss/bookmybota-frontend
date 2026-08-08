"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, Minus, Plus, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventBookingMutation,
  useGetCustomerProfileQuery,
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

type Props = {
  event: OrganizerEvent;
  open: boolean;
  onClose: () => void;
};

export default function EventCheckout({ event, open, onClose }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState(1);
  const [showtimeId, setShowtimeId] = useState("");
  const [qtyByType, setQtyByType] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const customerId = authUser?.role === "customer" ? authUser.customer_id || "" : "";
  const { data: profile } = useGetCustomerProfileQuery(customerId, { skip: !customerId });
  const [createEventBooking] = useCreateEventBookingMutation();

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setShowtimeId("");
    setQtyByType({});
    setSubmitting(false);
  }, [open, event.id]);

  useEffect(() => {
    if (authUser?.role === "customer") {
      setName(profile?.name || authUser.name || "");
      setPhone(sanitizePhoneInput(profile?.phone || authUser.phone || ""));
      setEmail(profile?.email || authUser.email || "");
    }
  }, [authUser, profile]);

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
  const convenienceFee = moneySum([(ticketAmount * conveniencePct) / 100]);
  const grandTotal = moneySum([ticketAmount, convenienceFee]);
  const ticketQty = selectedLines.reduce((sum, l) => sum + l.qty, 0);

  const setQty = (id: string, next: number, max: number) => {
    setQtyByType((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(max, next)),
    }));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showtimeId || selectedLines.length === 0) return;

    const phoneErr = getPhoneValidationError(phone);
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEventBooking({
        event_id: event.id,
        showtime_id: showtimeId,
        items: selectedLines.map((l) => ({ ticket_type_id: l.id, qty: l.qty })),
        guest_name: name.trim(),
        guest_phone: sanitizePhoneInput(phone),
        guest_email: email.trim() || undefined,
        customer_id: customerId || undefined,
        booking_source: "ONLINE",
      }).unwrap();

      toast.success("Tickets booked!");
      onClose();
      if (result.booking_id) {
        router.push(`/customer/event-bookings/confirmation?id=${result.booking_id}`);
      }
    } catch (err) {
      toast.error(extractApiError(err, "Booking failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

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
                          ? "border-rose-500 bg-rose-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-rose-200"
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
                        <p className="text-xs text-slate-400 mt-1">
                          {available} available
                        </p>
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Ticket size={14} className="text-rose-500" /> Order summary
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
                      <span className="font-semibold text-slate-800">
                        {formatInr(l.unit * l.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-sm text-slate-600 pt-2 border-t border-slate-100">
                  <span>Tickets</span>
                  <span className="font-semibold text-slate-800">{formatInr(ticketAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Convenience fee{conveniencePct ? ` (${conveniencePct}%)` : ""}</span>
                  <span className="font-semibold text-slate-800">{formatInr(convenienceFee)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total payable</span>
                  <span>{formatInr(grandTotal)}</span>
                </div>
                <p className="text-[11px] text-slate-400">{ticketQty} ticket{ticketQty === 1 ? "" : "s"}</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Contact details</h4>
                {authUser?.role !== "customer" && (
                  <p className="text-xs text-slate-500">
                    Booking as guest.{" "}
                    <Link href="/login" className="text-rose-600 font-semibold hover:underline">
                      Log in
                    </Link>{" "}
                    to save this booking to My Bookings.
                  </p>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Full name
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                    placeholder="Your name"
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
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                    placeholder="9900000000"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                    placeholder="you@example.com"
                  />
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
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold text-sm"
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={ticketQty < 1}
              onClick={() => setStep(3)}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold text-sm"
            >
              Review order
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              form="event-checkout-form"
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2"
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

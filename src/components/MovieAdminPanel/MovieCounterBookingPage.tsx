"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Film, Lock, Monitor, Ticket, User, X } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import { useCreateCounterBookingMutation, useGetShowSeatMapQuery, type CounterBookingResult, type ShowSeatMapSeat, type ShowSeatState } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isVenueWallTimeReached } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { displayScreenName, formatDateHeader, formatTime } from "./showtimeHelpers";

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e11d48] px-3.5 py-2.5 text-sm font-bold text-white hover:bg-[#be123c] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer";

const STATE_FILL: Partial<Record<ShowSeatState, string>> = {
  BOOKED: "#94a3b8",
  HELD: "#f59e0b",
  BLOCKED: "#fda4af",
  OUT_OF_ORDER: "#fb923c",
  SCREEN_BLOCKED: "#f97316",
};
const STATE_LABEL: Record<ShowSeatState, string> = {
  AVAILABLE: "Available",
  BOOKED: "Sold",
  HELD: "Held by a customer",
  BLOCKED: "Blocked for this show",
  OUT_OF_ORDER: "Out of order",
  SCREEN_BLOCKED: "Damaged",
};

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** One show's seat layout. Pick seats, enter the customer's details on the left and confirm the booking. */
export default function MovieCounterBookingPage() {
  const params = useSearchParams();
  const showId = params.get("show") || "";
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";

  const { data: map, isLoading, isError, refetch } = useGetShowSeatMapQuery({ bizId, showtimeId: showId }, { skip: !bizId || !showId, pollingInterval: 10000 });
  const [book, { isLoading: booking }] = useCreateCounterBookingMutation();

  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "MOBILE_MONEY">("CASH");
  const [receipt, setReceipt] = useState<CounterBookingResult | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const seatByKey = useMemo(() => new Map((map?.seats ?? []).map((s) => [s.key, s])), [map?.seats]);
  // Seats that were sold or taken while picking drop out of the selection
  const chosen = useMemo(
    () => picked.map((k) => seatByKey.get(k)).filter((s): s is ShowSeatMapSeat => !!s && s.state === "AVAILABLE"),
    [picked, seatByKey]
  );
  const total = chosen.reduce((sum, s) => sum + s.price, 0);
  // Seats of the same category and price share one ticket line: "Premium × 3"
  const ticketGroups = useMemo(() => {
    const groups = new Map<string, { section: string; price: number; seats: ShowSeatMapSeat[] }>();
    for (const seat of chosen) {
      const id = `${seat.section}::${seat.price}`;
      const g = groups.get(id) || { section: seat.section, price: seat.price, seats: [] };
      g.seats.push(seat);
      groups.set(id, g);
    }
    return Array.from(groups.values());
  }, [chosen]);
  const previewSeats = useMemo(
    () =>
      (map?.seats ?? []).map((s) => ({
        key: s.key,
        coordinate_x: s.x,
        coordinate_y: s.y,
        color: s.color,
        section_name: s.section,
        status: "AVAILABLE",
      })),
    [map?.seats]
  );

  const started = map ? isVenueWallTimeReached(map.showtime.starts_at) : false;
  const onSale = !!map && map.showtime.is_active && map.showtime.status !== "CANCELLED" && !started;

  const toggle = (s: ShowSeatMapSeat) => {
    if (!onSale || s.state !== "AVAILABLE") return;
    setPicked((prev) => (prev.includes(s.key) ? prev.filter((k) => k !== s.key) : [...prev, s.key]));
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter the customer name";
    if (!/^[+\d][\d\s-]{6,19}$/.test(phone.trim())) next.phone = "Enter a valid mobile number";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const confirm = async () => {
    if (chosen.length === 0) {
      toast.error("Pick at least one seat on the layout.");
      return;
    }
    if (!validate()) return;
    try {
      const res = await book({
        bizId,
        showtimeId: showId,
        seat_keys: chosen.map((s) => s.key),
        guest_name: name.trim(),
        guest_phone: phone.trim(),
        guest_email: email.trim() || undefined,
        payment_method: method,
      }).unwrap();
      setReceipt(res.data);
      setPicked([]);
      toast.success(res.message || "Tickets booked");
    } catch (err) {
      toast.error(extractApiError(err, "Booking failed"));
      refetch();
    }
  };

  const resetForm = () => {
    setReceipt(null);
    setName("");
    setPhone("");
    setEmail("");
    setErrors({});
  };

  if (!showId) {
    return (
      <div className={`${card} p-10 text-center text-slate-500`}>
        <p className="font-semibold text-slate-700">No show picked</p>
        <Link href="/movie/bookings" className={`${btnSecondary} mt-3`}>
          <ArrowLeft size={14} /> Back to shows
        </Link>
      </div>
    );
  }
  if (!bizId || isLoading) return <AdminListShimmer rows={4} columns={3} />;
  if (isError || !map) {
    return (
      <div className={`${card} p-10 text-center text-slate-500`}>
        <p className="font-semibold text-slate-700">This show could not be loaded</p>
        <Link href="/movie/bookings" className={`${btnSecondary} mt-3`}>
          <ArrowLeft size={14} /> Back to shows
        </Link>
      </div>
    );
  }

  const st = map.showtime;
  const dateStr = String(st.starts_at).slice(0, 10);
  const poster = resolveMediaUrl(st.movie_poster_url || "");

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/movie/bookings" className={btnSecondary}>
          <ArrowLeft size={14} /> Shows
        </Link>
        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={st.movie_title} className="h-full w-full object-cover" />
          ) : (
            <Film size={20} className="text-slate-300" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 truncate">{st.movie_title}</h2>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <Monitor size={12} className="text-[#e11d48]" /> {displayScreenName(st.screen_name)}
            </span>
            <span>
              {st.format} · {st.language}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {formatDateHeader(dateStr)} · {formatTime(st.starts_at)}
            </span>
          </p>
        </div>
        <div className="ml-auto flex gap-5 text-center">
          <div>
            <div className="text-xl font-black text-emerald-600 leading-tight">{map.counts.available}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Available</div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 leading-tight">{map.counts.booked}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Sold</div>
          </div>
        </div>
      </div>

      {!onSale && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
          <Lock size={15} />
          {started ? "This show has started, so booking is closed." : "This show is not on sale (disabled or cancelled)."}
        </div>
      )}

      {/* The layout takes the whole width */}
      <div className={`${card} p-4 min-w-0`}>
        {map.seats.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">This screen has no live seat layout yet.</p>
        ) : (
          <>
            <LayoutSeatPreview
              seats={previewSeats}
              config={map.layout?.seating_config}
              heightClass="h-[min(76vh,720px)]"
              className="bg-white"
              seatMarker={(raw) => {
                const live = seatByKey.get(String((raw as { key?: string }).key || ""));
                if (!live) return null;
                const isPicked = picked.includes(live.key);
                const free = live.state === "AVAILABLE";
                return {
                  fill: isPicked ? "#e11d48" : STATE_FILL[live.state] || "",
                  stroke: isPicked ? "#9f1239" : "#ffffff",
                  strokeWidth: isPicked ? 3 : undefined,
                  cursor: free && onSale ? "pointer" : "not-allowed",
                  title: `${live.identifier} · ${STATE_LABEL[live.state]} · ${money(live.price)} ETB`,
                  onClick: free && onSale ? () => toggle(live) : undefined,
                };
              }}
            />
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Available</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-600" /> Selected</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-400" /> Sold</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Held online</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Damaged</span>
              {st.tier_pricing.map((t) => (
                <span key={t.tier_name} className="ml-auto first:ml-0 font-semibold text-slate-700">
                  {t.tier_name} {money(t.price)} ETB
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* The ticket appears at the bottom right once seats are picked */}
      {chosen.length > 0 && !receipt && (
        <aside
          aria-label="Your ticket"
          className="fixed bottom-4 right-4 z-30 w-[min(23rem,calc(100vw-2rem))] max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Ticket size={15} className="text-[#e11d48]" /> Ticket
              </h3>
              <button type="button" onClick={() => setPicked([])} className="text-xs font-bold text-[#e11d48] hover:underline">
                Clear all
              </button>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {ticketGroups.map((g) => (
                <li key={`${g.section}-${g.price}`} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-slate-900">
                      {g.section} <span className="text-slate-500">× {g.seats.length}</span>
                    </span>
                    <span className="font-semibold text-slate-800">{money(g.price * g.seats.length)} ETB</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{money(g.price)} ETB each</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {g.seats.map((s) => (
                      <span key={s.key} className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">
                        {s.identifier}
                        <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s.identifier}`} className="text-rose-400 hover:text-rose-700">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-b-xl">
                <span className="text-sm font-bold text-slate-700">
                  Total · {chosen.length} ticket{chosen.length === 1 ? "" : "s"}
                </span>
                <span className="text-lg font-black text-slate-900">{money(total)} ETB</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <User size={15} className="text-[#e11d48]" /> Customer
            </h3>
            <div>
              <label className={labelCls} htmlFor="cust-name">
                Customer name *
              </label>
              <input
                id="cust-name"
                className={inputCls}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Full name"
                autoComplete="off"
              />
              {errors.name && <p className="mt-1 text-xs font-medium text-rose-600">{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="cust-phone">
                Mobile number *
              </label>
              <input
                id="cust-phone"
                className={inputCls}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="+251 9XX XXX XXX"
                inputMode="tel"
                autoComplete="off"
              />
              {errors.phone && <p className="mt-1 text-xs font-medium text-rose-600">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="cust-email">
                Email
              </label>
              <input
                id="cust-email"
                className={inputCls}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="name@example.com"
                type="email"
                autoComplete="off"
              />
              {errors.email && <p className="mt-1 text-xs font-medium text-rose-600">{errors.email}</p>}
            </div>
            <div>
              <label className={labelCls}>Payment</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["CASH", "Cash"],
                    ["CARD", "Card"],
                    ["MOBILE_MONEY", "Mobile money"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`rounded-lg border px-2 py-2 text-xs font-bold cursor-pointer ${
                      method === id ? "border-[#e11d48] bg-rose-50 text-[#e11d48]" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="button" className={`${btnPrimary} w-full`} disabled={booking || !onSale} onClick={confirm}>
            {booking ? "Booking…" : `Confirm booking · ${money(total)} ETB`}
          </button>
          <p className="text-[11px] text-slate-500">Counter bookings are offline sales. They appear under Bookings and in the screen&apos;s audit as Box office.</p>
        </aside>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Tickets booked</h3>
            <p className="text-sm text-slate-600 mt-1">
              {receipt.seats.map((s) => s.identifier).join(", ")} · <b>{money(receipt.total)} ETB</b>
            </p>
            <p className="mt-3 font-mono text-sm text-slate-900" data-testid="booking-code">
              {receipt.booking_code}
            </p>
            <p className="text-xs text-slate-500 mt-1">The customer shows this code at the gate.</p>
            <div className="mt-5 flex gap-2 justify-center">
              <Link href="/movie/bookings" className={btnSecondary}>
                Back to shows
              </Link>
              <button type="button" className={btnPrimary} onClick={resetForm}>
                Book more seats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

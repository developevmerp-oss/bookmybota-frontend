"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import { useGetCinemaScreensQuery, useGetScreenAuditQuery, type ScreenAuditData } from "@/services/api";
import { formatDate, formatDateTime12h, venueDateStr } from "@/lib/dateFormat";
import { displayScreenName, shiftYmd } from "./showtimeHelpers";

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];
const CHANNEL_LABEL: Record<string, string> = { ONLINE: "Website & app", COUNTER: "Box office", PARTNER: "Partner" };

const money = (n: number) => `${Math.round(n).toLocaleString()} ETB`;
const timeOf = (ts: string) => String(ts).slice(11, 16);
const dateOf = (ts: string) => formatDate(String(ts).slice(0, 10));

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-3">
        <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">{children}</p>;
}

function Bar({ pct, tone = "bg-rose-500" }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

function Tile({ label, value, change, sub }: { label: string; value: string; change?: number | null; sub?: string }) {
  const up = (change ?? 0) >= 0;
  return (
    <div className={`${card} px-4 py-3`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-black leading-tight text-slate-900">{value}</p>
      {change === undefined ? (
        sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null
      ) : change === null ? (
        <p className="mt-0.5 text-[11px] text-slate-400">No earlier data</p>
      ) : (
        <p className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(change)}% vs previous
        </p>
      )}
    </div>
  );
}

function downloadCsv(data: ScreenAuditData) {
  const head = ["Date", "Time", "Screen", "Movie", "Language", "Format", "Capacity", "Sold", "Occupancy %", "Revenue (ETB)"];
  const rows = data.utilisation.per_show.map((s) => [
    dateOf(s.starts_at),
    timeOf(s.starts_at),
    s.screen,
    s.movie,
    s.language,
    s.format,
    s.capacity,
    s.sold,
    s.occupancy,
    s.revenue,
  ]);
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `screen-audit-${formatDate(data.range.from)}-to-${formatDate(data.range.to)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MovieScreenAuditPage() {
  const user = useAppSelector((state) => state.auth.user);
  const search = useSearchParams();
  const bizId = user?.business_id || (user as { business?: { id?: string } })?.business?.id || "";
  const today = useMemo(() => venueDateStr(), []);
  const [screenId, setScreenId] = useState(search.get("screen") || "");
  const [period, setPeriod] = useState("7d");
  const [from, setFrom] = useState(shiftYmd(today, -6));
  const [to, setTo] = useState(today);

  const { data: cinemaScreens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const liveScreens = useMemo(
    () => cinemaScreens.filter((s) => Boolean(s.venue_layout_template_id) && s.is_active !== false),
    [cinemaScreens]
  );

  useEffect(() => {
    if (period !== "custom") return;
    if (!from) setFrom(shiftYmd(today, -6));
    if (!to) setTo(today);
  }, [period, from, to, today]);

  const customReady = period !== "custom" || (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));

  const { data, isFetching } = useGetScreenAuditQuery(
    {
      bizId,
      ...(screenId ? { screen_id: screenId } : {}),
      period,
      ...(period === "custom" && customReady ? { from, to } : {}),
    },
    { skip: !bizId || !customReady, refetchOnMountOrArgChange: true }
  );

  const heat = useMemo(() => {
    const slots = data?.revenue.slots || [];
    const hours = Array.from(new Set(slots.map((s) => s.hour))).sort((a, b) => a - b);
    const map = new Map(slots.map((s) => [`${s.dow}-${s.hour}`, s]));
    return { hours, map };
  }, [data]);

  const rangeLabel = data
    ? `${formatDate(data.range.from)} to ${formatDate(data.range.to)} · compared with ${formatDate(data.range.prev_from)} to ${formatDate(data.range.prev_to)}`
    : period === "custom" && !customReady
      ? "Pick a start and end date"
      : "Loading…";

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Screen Audit</h1>
          <p className="text-xs text-slate-500">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={screenId}
            onChange={(e) => setScreenId(e.target.value)}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
            aria-label="Screen"
          >
            <option value="">All screens with a live layout</option>
            {liveScreens.map((s) => (
              <option key={s.id} value={s.id}>
                {displayScreenName(s.name)}
              </option>
            ))}
          </select>
          <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id);
                  if (p.id === "custom") {
                    setFrom((prev) => prev || shiftYmd(today, -6));
                    setTo((prev) => prev || today);
                  }
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${period === p.id ? "bg-white text-rose-600 shadow-sm" : "text-slate-600"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" ? (
            <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-2 py-1">
              <label className="text-[11px] font-bold text-slate-600">
                From
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="ml-1.5 h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                  aria-label="From date"
                />
              </label>
              <label className="text-[11px] font-bold text-slate-600">
                To
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="ml-1.5 h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                  aria-label="To date"
                />
              </label>
              <span className="text-[11px] text-slate-500">
                {customReady ? `${formatDate(from)} → ${formatDate(to)}` : "Choose both dates"}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!data}
            onClick={() => data && downloadCsv(data)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {!customReady ? (
        <Empty>Choose a From and To date for the custom range.</Empty>
      ) : !data ? (
        <p className="py-16 text-center text-sm text-slate-500">{isFetching ? "Loading audit…" : "No audit data."}</p>
      ) : liveScreens.length === 0 && (data.screens?.length || 0) === 0 ? (
        <Empty>No screen has a live layout yet. Approve a layout under Screens &amp; Layouts to see its audit.</Empty>
      ) : (
        <>
          {data.alerts.length > 0 ? (
            <div className="space-y-2">
              {data.alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${a.level === "high" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {a.text}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Revenue" value={money(data.scorecard.revenue.value)} change={data.scorecard.revenue.change} />
            <Tile label="Tickets sold" value={data.scorecard.tickets.value.toLocaleString()} change={data.scorecard.tickets.change} />
            <Tile label="Avg occupancy" value={`${data.scorecard.occupancy.value}%`} change={data.scorecard.occupancy.change} />
            <Tile label="Shows run" value={String(data.scorecard.shows.value)} change={data.scorecard.shows.change} />
            <Tile label="Damaged seats" value={String(data.scorecard.damaged.value)} sub={`of ${data.scorecard.damaged.total} seats`} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Utilisation" hint="Is the screen being used well?">
              <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-slate-900">{data.utilisation.usage_pct}%</p>
                  <p className="text-[11px] text-slate-500">
                    {data.utilisation.hours_used}h of {data.utilisation.hours_available}h used
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{data.utilisation.sold_out}</p>
                  <p className="text-[11px] text-slate-500">Sold-out shows</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{data.utilisation.low_shows.length}</p>
                  <p className="text-[11px] text-slate-500">Shows under 20%</p>
                </div>
              </div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Shows per day</p>
              <div className="flex h-20 items-end gap-1">
                {data.utilisation.shows_per_day.map((d) => {
                  const max = Math.max(1, ...data.utilisation.shows_per_day.map((x) => x.shows));
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${formatDate(d.date)}: ${d.shows} shows`}>
                      <div className="w-full rounded-t bg-rose-400" style={{ height: `${(d.shows / max) * 100}%`, minHeight: d.shows ? 3 : 1 }} />
                      <span className="mt-1 text-[9px] text-slate-400">{formatDate(d.date).slice(0, 5)}</span>
                    </div>
                  );
                })}
              </div>
              {data.utilisation.low_shows.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Low-selling shows</p>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {data.utilisation.low_shows.slice(0, 6).map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-1.5">
                        <span className="truncate">
                          {s.movie}{" "}
                          <span className="text-xs text-slate-500">
                            {dateOf(s.starts_at)} {timeOf(s.starts_at)} · {s.screen}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold text-rose-600">{s.occupancy}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.utilisation.gaps.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Empty gaps between shows</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {data.utilisation.gaps.slice(0, 5).map((g, i) => (
                      <li key={i}>
                        {g.screen} · {formatDate(g.date)} · {g.from} to {g.to} ({Math.round((g.minutes / 60) * 10) / 10}h free)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Section>

            <Section title="Revenue" hint="Where does the money come from?">
              <p className="mb-3 text-xs text-slate-500">
                Average ticket <b className="text-slate-900">{money(data.revenue.avg_ticket)}</b>
              </p>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">By seat type</p>
              {data.revenue.tiers.length === 0 ? (
                <Empty>No tickets sold in this period.</Empty>
              ) : (
                <ul className="space-y-2">
                  {data.revenue.tiers.map((t) => (
                    <li key={t.tier}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-800">{t.tier}</span>
                        <span className="text-slate-600">
                          {money(t.revenue)} · {t.tickets} tickets · avg {money(t.avg_price)}
                        </span>
                      </div>
                      <Bar pct={(t.revenue / Math.max(1, data.scorecard.revenue.value)) * 100} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Snacks &amp; drinks (online orders)</p>
              {!data.revenue.snacks || data.revenue.snacks.items === 0 ? (
                <Empty>No snacks or drinks ordered.</Empty>
              ) : (
                <>
                  <p className="text-sm text-slate-700">
                    <b>{money(data.revenue.snacks.revenue)}</b> from {data.revenue.snacks.items} items
                  </p>
                  <p className="text-xs text-slate-500">
                    Top: {data.revenue.snacks.top.map((t) => `${t.name} (${t.qty})`).join(", ")}
                  </p>
                </>
              )}
              <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">By channel</p>
              {data.revenue.channels.length === 0 ? (
                <Empty>No sales yet.</Empty>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.revenue.channels.map((c) => (
                    <li key={c.channel} className="flex justify-between">
                      <span className="text-slate-700">{CHANNEL_LABEL[c.channel] || c.channel}</span>
                      <span className="text-slate-600">
                        {money(c.revenue)} · {c.tickets} tickets
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Best and worst time slots" hint="Average occupancy by day and hour (completed shows only)">
            {heat.hours.length === 0 ? (
              <Empty>No completed shows in this period yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-separate border-spacing-1 text-center text-[11px]">
                  <thead>
                    <tr>
                      <th />
                      {heat.hours.map((h) => (
                        <th key={h} className="font-semibold text-slate-500">
                          {String(h).padStart(2, "0")}:00
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DOW.map((d, i) => (
                      <tr key={d}>
                        <td className="pr-1 text-right font-semibold text-slate-500">{d}</td>
                        {heat.hours.map((h) => {
                          const s = heat.map.get(`${i}-${h}`);
                          return (
                            <td
                              key={h}
                              title={s ? `${s.shows} shows · ${s.occupancy}% · ${money(s.revenue)}` : "No shows"}
                              className="h-8 rounded-md font-bold"
                              style={{
                                background: s ? `rgba(225,29,72,${0.12 + (s.occupancy / 100) * 0.78})` : "#f8fafc",
                                color: s && s.occupancy > 55 ? "#fff" : "#475569",
                              }}
                            >
                              {s ? `${Math.round(s.occupancy)}%` : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Movie performance" hint="What to keep, drop or reschedule">
              {data.movies.length === 0 ? (
                <Empty>No shows in this period.</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1.5 pr-2 font-semibold">Movie</th>
                        <th className="py-1.5 pr-2 font-semibold">Shows</th>
                        <th className="py-1.5 pr-2 font-semibold">Tickets</th>
                        <th className="py-1.5 pr-2 font-semibold">Occupancy</th>
                        <th className="py-1.5 text-right font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movies.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100 text-slate-800">
                          <td className="py-1.5 pr-2">
                            <span className="font-semibold">{m.movie}</span>{" "}
                            <span className="text-slate-500">
                              {m.language} · {m.format}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">{m.shows}</td>
                          <td className="py-1.5 pr-2">{m.tickets}</td>
                          <td className="py-1.5 pr-2">{m.occupancy}%</td>
                          <td className="py-1.5 text-right font-semibold">{money(m.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Seats and maintenance" hint="Damaged seats and what they cost">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-slate-900">{data.seats.damaged_pct}%</p>
                  <p className="text-[11px] text-slate-500">{data.seats.damaged} seats damaged</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{money(data.seats.estimated_lost_revenue)}</p>
                  <p className="text-[11px] text-slate-500">Estimated revenue lost</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {data.seats.avg_repair_days === null ? "—" : `${data.seats.avg_repair_days}d`}
                  </p>
                  <p className="text-[11px] text-slate-500">Average time to repair</p>
                </div>
              </div>
              {data.seats.repeatedly_damaged.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Repeatedly damaged</p>
                  <p className="text-xs text-slate-700">
                    {data.seats.repeatedly_damaged.map((s) => `${s.seat} (${s.times}×)`).join(", ")}
                  </p>
                </div>
              ) : null}
              {screenId && data.seats.most_booked.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Most booked seats</p>
                  <p className="text-xs text-slate-700">
                    {data.seats.most_booked.map((s) => `${s.seat} (${s.bookings})`).join(", ")}
                  </p>
                  {data.seats.never_booked_pct !== null ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {data.seats.never_booked_pct}% of seats were never booked in this period.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!screenId ? <p className="mt-4 text-[11px] text-slate-500">Pick one screen to see its most booked seats.</p> : null}
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Quality and operations">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-slate-900">{data.quality.cancellation_rate}%</p>
                  <p className="text-[11px] text-slate-500">
                    {data.quality.cancelled} of {data.quality.bookings} bookings cancelled
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{data.quality.no_show_rate}%</p>
                  <p className="text-[11px] text-slate-500">{data.quality.no_shows} bookings not scanned in</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900">{data.quality.counter_share}%</p>
                  <p className="text-[11px] text-slate-500">Revenue from the box office</p>
                </div>
              </div>
            </Section>

            <Section title="Next 7 days" hint="Advance sales and a forecast based on this period">
              {data.revenue.advance.length === 0 ? (
                <Empty>No upcoming shows scheduled.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.revenue.advance.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">
                        {s.movie}{" "}
                        <span className="text-xs text-slate-500">
                          {dateOf(s.starts_at)} {timeOf(s.starts_at)} · {s.screen}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-600">
                        {s.sold}/{s.capacity} sold · forecast <b>{s.forecast_sold}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Suggestions">
            {data.decisions.hints.length === 0 ? (
              <Empty>Not enough completed shows yet to suggest changes.</Empty>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {data.decisions.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            {data.decisions.best_slots.length > 0 ? (
              <p className="mt-3 text-xs text-slate-600">
                Best slots:{" "}
                {data.decisions.best_slots.map((s) => `${DOW[s.dow]} ${String(s.hour).padStart(2, "0")}:00 (${s.occupancy}%)`).join(", ")}
                {data.decisions.weak_slots.length > 0
                  ? ` · Weakest: ${data.decisions.weak_slots.map((s) => `${DOW[s.dow]} ${String(s.hour).padStart(2, "0")}:00 (${s.occupancy}%)`).join(", ")}`
                  : ""}
              </p>
            ) : null}
          </Section>

          <Section title="Activity log" hint="Who did what and when">
            {data.activity.length === 0 ? (
              <Empty>No activity recorded yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.activity.slice(0, 25).map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span className="text-slate-800">{a.text}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {a.by ? `${a.by} · ` : ""}
                      {formatDateTime12h(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

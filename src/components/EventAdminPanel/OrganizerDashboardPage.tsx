"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetBusinessSettingsQuery,
  useGetOrganizerEventsQuery,
  useGetOrganizerEventContractsQuery,
  useGetOrganizerTicketStatsQuery,
} from "@/services/api";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  Info,
  Plus,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import OrganizerLandingPage from "@/components/EventAdminPanel/OrganizerLandingPage";
import { organizerWorkflowLabel } from "@/lib/contractPlaceholders";
import { formatMoney } from "@/lib/currencyFormat";
import { formatTime12h } from "@/lib/dateFormat";

/** Soft corner wave — matches dining dashboard KPI cards. */
function SoftWave({ color, id }: { color: string; id: string }) {
  const gradId = `org-wave-${id}`;
  return (
    <svg
      viewBox="0 0 160 70"
      className="absolute -right-1 bottom-0 w-[58%] max-w-[150px] h-[58px] opacity-70 pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <path
        d="M0 52 C28 48, 36 28, 58 32 C80 36, 88 54, 110 42 C128 32, 140 24, 160 28 L160 70 L0 70 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M0 52 C28 48, 36 28, 58 32 C80 36, 88 54, 110 42 C128 32, 140 24, 160 28"
        fill="none"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-100",
    APPROVED: "bg-sky-50 text-sky-700 border-sky-100",
    LIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    CLOSED: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function OrganizerDashboard() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading: settingsLoading } = useGetBusinessSettingsQuery(bizId, {
    skip: !bizId,
  });
  const { data: eventsData, isLoading: eventsLoading } = useGetOrganizerEventsQuery({
    page: 1,
    limit: 8,
  });
  const events = eventsData?.items ?? [];
  const { data: ticketStats, isLoading: statsLoading } = useGetOrganizerTicketStatsQuery();
  const { data: contractsData } = useGetOrganizerEventContractsQuery({
    page: 1,
    limit: 5,
    scope: "current",
  });
  const currentContracts = contractsData?.items ?? [];

  const firstName =
    user?.name?.split(/\s+/)[0] ||
    settings?.name?.split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const greeting = greetingForHour(new Date().getHours());

  const pending = events.filter((e) => e.status === "PENDING_APPROVAL").length;
  const drafts = events.filter((e) => e.status === "DRAFT").length;
  const live = events.filter((e) => e.status === "LIVE").length;
  const sold = ticketStats?.overall.total_sold ?? 0;
  const remaining = ticketStats?.overall.total_remaining ?? 0;
  const inventory = sold + remaining;
  const fillPct = inventory > 0 ? Math.round((sold / inventory) * 100) : 0;
  const bookingsCount = ticketStats?.overall.bookings_count ?? 0;
  const revenue = Number(ticketStats?.overall.ticket_revenue ?? 0);
  const payout = Number(ticketStats?.overall.organizer_payout ?? 0);
  const eventsCount = ticketStats?.overall.events_count ?? events.length;
  const unsignedContracts = currentContracts.filter(
    (c) => c.status === "PENDING_SIGNATURES" && !c.organizer_signed_at
  ).length;

  const attentionItems = useMemo(() => {
    const items: { title: string; subtitle: string; href: string; action: string }[] = [];
    for (const e of events) {
      if (e.status === "PENDING_APPROVAL") {
        items.push({
          title: "Awaiting Super Admin review",
          subtitle: e.name,
          href: `/organizer/events/${e.id}`,
          action: "Review",
        });
      } else if (e.status === "DRAFT") {
        items.push({
          title: "Finish draft event",
          subtitle: e.name,
          href: `/organizer/events/${e.id}`,
          action: "Continue",
        });
      } else if (e.contract && !e.contract.organizer_signed_at) {
        items.push({
          title: "Sign platform contract",
          subtitle: e.name,
          href: `/organizer/events/${e.id}/contract`,
          action: "Sign",
        });
      } else if (e.rejection_reason) {
        items.push({
          title: "Resubmit after rejection",
          subtitle: e.name,
          href: `/organizer/events/${e.id}`,
          action: "Fix",
        });
      }
      if (items.length >= 4) break;
    }
    return items;
  }, [events]);

  const isLoading = settingsLoading || eventsLoading || statsLoading;

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading Event Dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      id: "revenue",
      label: "Ticket Revenue",
      primary: formatMoney(revenue),
      unit: "",
      href: "/organizer/ledger",
      Icon: Banknote,
      wave: "#e11d48",
      iconWrap: "bg-rose-50 text-rose-500",
    },
    {
      id: "sold",
      label: "Tickets Sold",
      primary: sold.toLocaleString(),
      unit: "",
      href: "/organizer/tickets",
      Icon: Ticket,
      wave: "#3b82f6",
      iconWrap: "bg-sky-50 text-sky-500",
    },
    {
      id: "bookings",
      label: "Customer Bookings",
      primary: bookingsCount.toLocaleString(),
      unit: "",
      href: "/organizer/bookings",
      Icon: Users,
      wave: "#22c55e",
      iconWrap: "bg-emerald-50 text-emerald-500",
    },
    {
      id: "events",
      label: "Your Events",
      primary: String(eventsCount),
      unit: "",
      href: "/organizer/events",
      Icon: CalendarDays,
      wave: "#8b5cf6",
      iconWrap: "bg-violet-50 text-violet-500",
      isLive: live > 0,
    },
  ];

  const quickLinks = [
    { href: "/organizer/events/new", label: "Create event", Icon: Plus },
    { href: "/organizer/bookings", label: "Bookings", Icon: Users },
    { href: "/organizer/scan", label: "Scan tickets", Icon: Ticket },
    { href: "/organizer/contracts", label: "Contracts", Icon: FileSignature },
    { href: "/organizer/ledger", label: "Revenue", Icon: Banknote },
  ];

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {greeting}, {firstName}.
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Overview of your events, tickets, contracts, and payouts.
            </p>
          </div>
          <Link
            href="/organizer/events/new"
            className="btn-primary inline-flex items-center gap-2 w-fit text-sm px-5 py-3 font-bold rounded-xl shadow-lg hover:shadow-rose-600/25 hover:scale-[1.01] transition-all"
          >
            <Plus size={18} /> Create event
          </Link>
        </div>

        {/* KPI cards — dining dashboard style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.Icon;
            return (
              <Link
                key={stat.id}
                href={stat.href}
                className="relative overflow-hidden rounded-2xl bg-white border border-slate-100/90 shadow-[0_4px_18px_rgba(15,23,42,0.035)] px-5 py-5 min-h-[138px] hover:border-rose-200/80 transition-colors"
              >
                <SoftWave id={stat.id} color={stat.wave} />
                <div className="relative z-10 flex items-center gap-3">
                  <span
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.iconWrap}`}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <h3 className="text-[13px] font-medium text-slate-500">{stat.label}</h3>
                </div>
                <div className="relative z-10 mt-5 pr-[30%]">
                  {stat.isLive ? (
                    <p className="text-[26px] leading-none font-bold text-slate-800 tracking-tight whitespace-nowrap tabular-nums">
                      {stat.primary}
                      <span className="ml-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-500 align-middle">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        {live} live
                      </span>
                    </p>
                  ) : (
                    <p className="text-[26px] leading-none font-bold text-slate-800 tracking-tight whitespace-nowrap tabular-nums">
                      {stat.primary}
                      {stat.unit}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Event performance + quick actions */}
          <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 flex flex-col">
            <div className="flex items-start gap-3">
              <span className="h-11 w-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Zap size={20} />
              </span>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Event Performance</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Ticket sell-through, payouts, and shortcuts for day-to-day work.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Ticket size={18} className="text-rose-500" />
                  <label className="text-sm font-bold text-slate-800">Inventory fill rate</label>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600 border border-rose-100 tabular-nums">
                  {fillPct}% filled
                </span>
              </div>

              <div
                className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={fillPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-rose-600 transition-all"
                  style={{ width: `${Math.min(100, fillPct)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Sold
                  </p>
                  <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">
                    {sold.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Remaining
                  </p>
                  <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">
                    {remaining.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Banknote size={18} className="text-rose-500" />
                  <label className="text-sm font-bold text-slate-800">Organizer payout</label>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 tabular-nums">
                  After commission
                </span>
              </div>
              <p className="text-[26px] leading-none font-bold text-slate-800 tracking-tight tabular-nums">
                {formatMoney(payout)}
              </p>
              <p className="text-xs text-slate-500">
                Gross ticket revenue {formatMoney(revenue)}. Full breakdown is on Revenue &amp;
                Payouts.
              </p>
              <Link
                href="/organizer/ledger"
                className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-700"
              >
                Open ledger <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Zap size={12} className="text-rose-500" />
                Quick actions
              </div>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((link) => {
                  const Icon = link.Icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <Icon size={14} className="text-rose-500" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-2xl flex gap-3 mt-auto">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">
                  Go-live tip
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Submit your event for review, then sign the platform contract when Super Admin
                  creates it. After both signatures, Super Admin publishes the event so customers
                  can book.
                </p>
              </div>
            </div>
          </section>

          {/* Right — events + attention */}
          <div className="flex flex-col gap-6">
            <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Your Events</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Status, visibility, and contracts at a glance.
                    </p>
                  </div>
                </div>
                <Link
                  href="/organizer/events"
                  className="text-sm font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 shrink-0"
                >
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              {/* Status pills summary */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Live", count: live, active: true },
                  { label: "Pending", count: pending, active: false },
                  { label: "Drafts", count: drafts, active: false },
                  {
                    label: "Unsigned contracts",
                    count: unsignedContracts,
                    active: false,
                  },
                ].map((pill) => (
                  <span
                    key={pill.label}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border ${
                      pill.active
                        ? "bg-rose-50 text-rose-600 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-transparent"
                    }`}
                  >
                    {pill.label}
                    <span className="tabular-nums font-bold">{pill.count}</span>
                  </span>
                ))}
              </div>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm font-medium text-slate-500 mb-3">No events yet.</p>
                  <Link
                    href="/organizer/events/new"
                    className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                  >
                    Create your first event →
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                  {events.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      <Link
                        href={`/organizer/events/${event.id}`}
                        className="flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-[5.5rem] shrink-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {event.event_starts_at
                              ? new Date(event.event_starts_at).toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {event.event_starts_at
                              ? formatTime12h(event.event_starts_at)
                              : "Date TBD"}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 truncate">{event.name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {event.category_name || "Uncategorized"}
                            {event.is_visible ? " · Visible" : " · Hidden"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusPill(event.status)}`}
                        >
                          {organizerWorkflowLabel(event)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Needs Attention</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Drafts, contracts, and review follow-ups.
                    </p>
                  </div>
                </div>
                {attentionItems.length > 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                    {attentionItems.length} task{attentionItems.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              {attentionItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-6 flex gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    Nothing urgent. Create an event or check ticket stats when you&apos;re ready.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {attentionItems.map((item) => (
                    <li
                      key={`${item.href}-${item.title}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3"
                    >
                      <AlertCircle size={16} className="text-amber-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                      </div>
                      <Link
                        href={item.href}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        {item.action}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-start gap-2.5 text-xs text-slate-600 border border-slate-200 p-3.5 rounded-xl">
                <Info size={14} className="mt-0.5 text-rose-500 shrink-0" />
                <span>
                  After Super Admin edits a contract, the new version appears under{" "}
                  <Link href="/organizer/contracts" className="font-semibold text-rose-600 hover:underline">
                    Current Contract
                  </Link>
                  . Older signed versions stay in{" "}
                  <Link
                    href="/organizer/contracts/history"
                    className="font-semibold text-rose-600 hover:underline"
                  >
                    Old Contracts
                  </Link>
                  .
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganizerDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user || user.role !== "event_admin") {
    return <OrganizerLandingPage />;
  }

  return <OrganizerDashboard />;
}

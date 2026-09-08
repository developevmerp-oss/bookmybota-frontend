"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetBusinessSettingsQuery,
  useGetOrganizerEventsQuery,
  useGetOrganizerTicketStatsQuery,
} from "@/services/api";
import {
  CalendarDays,
  Ticket,
  Plus,
  Users,
  Banknote,
  ArrowRight,
  AlertCircle,
  Info,
} from "lucide-react";
import OrganizerLandingPage from "@/components/EventAdminPanel/OrganizerLandingPage";
import { organizerWorkflowLabel } from "@/lib/contractPlaceholders";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "metric-warning",
    APPROVED: "metric-info",
    LIVE: "metric-positive",
    DRAFT: "bg-muted text-muted-foreground",
    CLOSED: "bg-rose-50 text-rose-700",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

function OrganizerDashboard() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: eventsData } = useGetOrganizerEventsQuery({ page: 1, limit: 8 });
  const events = eventsData?.items ?? [];
  const { data: ticketStats } = useGetOrganizerTicketStatsQuery();

  const firstName =
    user?.name?.split(/\s+/)[0] ||
    settings?.name?.split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const greeting = greetingForHour(new Date().getHours());

  const pending = events.filter((e) => e.status === "PENDING_APPROVAL").length;
  const drafts = events.filter((e) => e.status === "DRAFT").length;
  const live = events.filter((e) => e.status === "LIVE" || e.status === "APPROVED").length;
  const sold = ticketStats?.overall.total_sold ?? 0;
  const remaining = ticketStats?.overall.total_remaining ?? 0;
  const inventory = sold + remaining;
  const fillPct = inventory > 0 ? Math.round((sold / inventory) * 100) : 0;
  const bookingsCount = ticketStats?.overall.bookings_count ?? 0;
  const revenue = ticketStats?.overall.ticket_revenue ?? 0;
  const upcomingCount = ticketStats?.overall.events_count ?? events.length;
  const needsAttention = pending + drafts;

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

  const metrics = [
    {
      title: "Ticket revenue",
      value: `${formatMoney(revenue)} ETB`,
      sub: `${live} live / approved events`,
      icon: Banknote,
      href: "/organizer/ledger",
    },
    {
      title: "Tickets sold",
      value: sold.toLocaleString(),
      sub: inventory > 0 ? `${fillPct}% of inventory` : `${remaining} remaining`,
      icon: Ticket,
      href: "/organizer/tickets",
    },
    {
      title: "Customer bookings",
      value: bookingsCount.toLocaleString(),
      sub: "View all ticket orders",
      icon: Users,
      href: "/organizer/bookings",
    },
    {
      title: "Your events",
      value: String(upcomingCount),
      sub: needsAttention > 0 ? `${needsAttention} need attention` : "All clear",
      icon: CalendarDays,
      href: "/organizer/events",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="org-section-label mb-2">Organizer overview</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {greeting}, {firstName}.
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Here&apos;s what&apos;s happening across your events today.
          </p>
        </div>
        <Link href="/organizer/events/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus size={18} /> Create event
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.title}
              href={m.href}
              className="org-card p-5 hover:border-primary/25 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{m.title}</p>
                <span className="h-8 w-8 rounded-lg bg-muted text-muted-foreground inline-flex items-center justify-center group-hover:metric-brand transition-colors">
                  <Icon size={16} />
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground mt-3 tracking-tight">
                {m.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">{m.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <section className="org-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Your events</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track status, contracts, and visibility.
              </p>
            </div>
            <Link
              href="/organizer/events"
              className="text-sm font-semibold text-primary hover:opacity-80 inline-flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="px-5 pb-6 pt-2">
              <p className="text-sm text-muted-foreground mb-3">No events yet.</p>
              <Link href="/organizer/events/new" className="text-sm font-semibold text-primary">
                Create your first event →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/organizer/events/${event.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-[5.5rem] shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {event.event_starts_at
                          ? new Date(event.event_starts_at).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.event_starts_at
                          ? new Date(event.event_starts_at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "Date TBD"}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {event.category_name || "Uncategorized"}
                        {event.is_visible ? " · Visible" : " · Hidden"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusPill(event.status)}`}
                    >
                      {organizerWorkflowLabel(event)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="org-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-foreground">Needs attention</h3>
            {attentionItems.length > 0 && (
              <span className="metric-warning px-2.5 py-1 rounded-full text-[11px] font-bold">
                {attentionItems.length} task{attentionItems.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {attentionItems.length === 0 ? (
            <div className="rounded-xl bg-success-soft/60 border border-success/15 p-4 flex gap-3">
              <Info size={16} className="text-success shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">
                Nothing urgent. Create an event or check ticket stats when you&apos;re ready.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attentionItems.map((item) => (
                <li
                  key={`${item.href}-${item.title}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3"
                >
                  <AlertCircle size={16} className="text-warning shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-border bg-primary-soft/40 p-4 text-sm">
            <p className="font-semibold text-foreground mb-1">How approval works</p>
            <ol className="text-muted-foreground list-decimal list-inside space-y-1 text-xs sm:text-sm">
              <li>Save a draft or submit the full form for review.</li>
              <li>Super Admin approves or rejects with a reason.</li>
              <li>
                Approved events appear on the public{" "}
                <Link href="/events" className="text-primary font-medium hover:underline">
                  Events page
                </Link>
                .
              </li>
            </ol>
          </div>
        </section>
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

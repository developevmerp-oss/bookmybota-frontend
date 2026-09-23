"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Clapperboard,
  Film,
  LayoutGrid,
  Map,
  Store,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Wallet,
  UtensilsCrossed,
  Mic2,
  CalendarDays,
  Ticket,
  Banknote,
  HandCoins,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGetAdminStatsQuery, type AdminStatsPanel } from "@/services/api";

const PANEL_ICONS: Record<string, typeof Store> = {
  dining: UtensilsCrossed,
  event: Store,
  venue: Store,
  artist: Mic2,
  cinema: Clapperboard,
  events: CalendarDays,
  movies: Film,
  customers: Users,
  venue_layouts: Map,
  event_layouts: LayoutGrid,
  revenue: TrendingUp,
  payouts: Wallet,
};

const PIE_COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706"];

function money(n: number | undefined | null) {
  return `$${(Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MetricCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  href: string;
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Store;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-rose-200 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className={`p-1.5 rounded-lg ${accent}`}>
          <Icon size={15} />
        </div>
        <ArrowRight
          size={13}
          className="text-slate-300 group-hover:text-rose-500 transition-colors mt-0.5"
        />
      </div>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
    </Link>
  );
}

function PanelTile({ panel }: { panel: AdminStatsPanel }) {
  const Icon = PANEL_ICONS[panel.id] || Store;
  return (
    <Link
      href={panel.href}
      className="group flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm hover:border-rose-200 hover:shadow-md transition-all"
    >
      <div className="p-1.5 rounded-md bg-slate-50 text-slate-600 group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800 truncate">{panel.label}</p>
        <p className="text-[10px] text-slate-500 truncate">{panel.hint}</p>
      </div>
      <div className="text-right shrink-0">
        {panel.count != null ? (
          <p className="text-sm font-bold text-slate-900 tabular-nums">{panel.count}</p>
        ) : null}
        <ArrowRight
          size={12}
          className="text-slate-300 group-hover:text-rose-500 ml-auto transition-colors"
        />
      </div>
    </Link>
  );
}

function ChartCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 shrink-0 inline-flex items-center gap-1"
          >
            Open <ArrowRight size={12} />
          </Link>
        ) : null}
      </div>
      <div className="px-1.5 sm:px-2 py-2.5 sm:py-3 h-48 sm:h-56 md:h-64 lg:h-72 min-h-[12rem]">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

export default function GlobalDashboard() {
  const { data: stats, isLoading, isError } = useGetAdminStatsQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-3 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        Could not load dashboard metrics. Refresh the page or check that the API is running.
      </div>
    );
  }

  const pendingWork = stats.pending_work || [];
  const panels = stats.panels || [];
  const pendingTotal = stats.pending_total ?? pendingWork.reduce((s, i) => s + i.count, 0);
  const live = stats.live;
  const series = stats.series_daily || [];
  const mix = (stats.mix || []).filter((m) => m.tickets > 0 || m.revenue > 0);

  return (
    <div className="w-full space-y-3 sm:space-y-3.5 md:space-y-4 max-w-full overflow-x-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
        <MetricCard
          href="/admin/customers"
          label="Customers"
          value={stats.customers ?? "—"}
          hint="Open customers"
          icon={Users}
          accent="bg-blue-50 text-blue-600"
        />
        <MetricCard
          href="/admin/businesses/dining"
          label="Active partners"
          value={stats.active_businesses}
          hint={
            (stats.pending_partners_total || 0) > 0
              ? `${stats.pending_partners_total} awaiting approval`
              : "All partner modules"
          }
          icon={Store}
          accent="bg-violet-50 text-violet-600"
        />
        <MetricCard
          href="/admin/events?status=LIVE"
          label="Live events"
          value={stats.live_events ?? 0}
          hint={
            (stats.pending_events || 0) > 0
              ? `${stats.pending_events} pending review`
              : "Published events"
          }
          icon={CalendarCheck}
          accent="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          href="/admin/revenue"
          label="Platform revenue"
          value={money(stats.platform_revenue)}
          hint="Fees + commission (live)"
          icon={TrendingUp}
          accent="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <section className="md:col-span-5 lg:col-span-5 xl:col-span-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-100 bg-amber-50/60">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle size={14} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Pending work</h2>
                <p className="text-[10px] text-slate-500">Click an item to open the panel</p>
              </div>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                pendingTotal > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {pendingTotal > 0 ? `${pendingTotal} open` : "All clear"}
            </span>
          </div>

          {pendingWork.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5" />
              <p className="text-sm font-semibold text-slate-800">No pending work</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Approvals, layouts, contracts, and payouts are up to date.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[22rem] overflow-y-auto">
              {pendingWork.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-rose-50/50 transition-colors group"
                  >
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold px-1.5 tabular-nums">
                      {item.count}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-400">{item.group}</p>
                    </div>
                    <ArrowRight
                      size={13}
                      className="text-slate-300 group-hover:text-rose-500 shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="md:col-span-7 lg:col-span-7 xl:col-span-7 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Manage panels</h2>
              <p className="text-[10px] text-slate-500 truncate">Jump to partners, events, layouts, finance</p>
            </div>
            <Link
              href="/admin/event-contracts"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 shrink-0"
            >
              <FileSignature size={12} /> <span className="hidden sm:inline">Contracts</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-2">
            {panels.map((panel) => (
              <PanelTile key={panel.id} panel={panel} />
            ))}
          </div>
        </section>
      </div>

      {/* Live finance dashboard */}
      <section className="space-y-2.5 pt-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Live finance dashboard</h2>
            <p className="text-[10px] text-slate-500">
              Last 14 days · tickets, platform revenue, and partner disbursements · refreshes every
              minute
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/admin/revenue"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-rose-200 hover:text-rose-600"
            >
              Revenue detail
            </Link>
            <Link
              href="/admin/organizer-payouts"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-rose-200 hover:text-rose-600"
            >
              Disbursements
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm min-w-0">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Ticket size={14} className="text-rose-600 shrink-0" />
              <span className="text-[11px] font-medium truncate">Tickets sold</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
              {(live?.tickets_sold ?? 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Events {(live?.event_tickets ?? 0).toLocaleString()} · Movies{" "}
              {(live?.movie_tickets ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm min-w-0">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Banknote size={14} className="text-emerald-600 shrink-0" />
              <span className="text-[11px] font-medium truncate">Platform revenue</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">
              {money(live?.platform_revenue)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Fees + commission earned</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm min-w-0">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <HandCoins size={14} className="text-violet-600 shrink-0" />
              <span className="text-[11px] font-medium truncate">Disbursed to partners</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">
              {money(live?.disbursed_paid)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Pending payouts {money(live?.disbursed_pending)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm min-w-0">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Wallet size={14} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-medium truncate">Partner payable</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">
              {money(live?.partner_payable)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Customer paid {money(live?.customer_paid)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <ChartCard
            title="Ticket sales trend"
            subtitle="Tickets sold per day (events + movies)"
            href="/admin/events"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ticketsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="tickets"
                  name="Tickets"
                  stroke="#e11d48"
                  fill="url(#ticketsFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Platform revenue"
            subtitle="Fees + commission earned per day"
            href="/admin/revenue"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => money(Number(value))}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Payment disbursements"
            subtitle="Paid partner payouts vs partner due from bookings"
            href="/admin/organizer-payouts"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => money(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="disbursed" name="Disbursed" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="partner_due" name="Partner due" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Sales mix" subtitle="Events vs movies · tickets & revenue share">
            {mix.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No confirmed ticket sales yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="tickets"
                    nameKey="name"
                    cx="45%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {mix.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as { name?: string; revenue?: number };
                      return [
                        `${Number(value).toLocaleString()} tickets · ${money(row?.revenue)}`,
                        row?.name || "Segment",
                      ];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>
    </div>
  );
}

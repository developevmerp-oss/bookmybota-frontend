"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  UserPlus,
  User,
  Users,
  Minus,
  X,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessBookingsQuery,
  useCancelBookingMutation,
  useCreateBookingMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";
import { extractApiError } from "@/lib/apiErrors";
import {
  diningWalkInFormSchema,
  emptyDiningWalkInFormValues,
  type DiningWalkInFormValues,
} from "@/lib/diningPartnerFormSchemas";
import {
  formatDateCustomer,
  formatTime12h,
  formatWeekdayCustomer,
  formatInstantLocalDate,
  formatInstantLocalTime,
  venueDateStr,
  venueCalendarAddDays,
  venueDateLabels,
} from "@/lib/dateFormat";
import { formatDiningOfferDiscount } from "@/lib/diningOffers";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const SOURCE_OPTIONS = [
  { value: "ALL", label: "All sources" },
  { value: "ONLINE", label: "Online" },
  { value: "WALK_IN", label: "Walk-in" },
] as const;

const filterControlClass =
  "h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";

function buildDateStrip(todayKey: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const key = venueCalendarAddDays(todayKey, i);
    const labels = venueDateLabels(key);
    return {
      key,
      weekday: i === 0 ? "Today" : labels.weekdayShort,
      day: labels.dayNumber,
      month: labels.monthName,
    };
  });
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

export default function BookingsManager() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const todayKey = useMemo(() => venueDateStr(), []);
  const tomorrowKey = useMemo(() => venueCalendarAddDays(todayKey, 1), [todayKey]);
  const dateStrip = useMemo(() => buildDateStrip(todayKey), [todayKey]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(todayKey);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [sortColumn, setSortColumn] = useState<string>("booking_time");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const {
    data: bookingsData,
    isLoading,
    isFetching,
  } = useGetBusinessBookingsQuery(
    {
      bizId,
      page: currentPage,
      limit: pageSize,
      sort_by: sortColumn,
      sort_dir: sortDirection,
      ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(sourceFilter !== "ALL" ? { source: sourceFilter } : {}),
    },
    { skip: !bizId }
  );

  const dateLabels = dateFilter ? venueDateLabels(dateFilter) : null;
  const dateHeading = dateFilter
    ? dateFilter === todayKey
      ? "Today"
      : dateFilter === tomorrowKey
        ? "Tomorrow"
        : dateLabels
          ? `${dateLabels.weekdayShort}, ${dateLabels.dayNumber} ${dateLabels.monthName}`
          : dateFilter
    : "All dates";

  const dateInStrip = dateStrip.some((d) => d.key === dateFilter);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    dateFilter !== todayKey ||
    statusFilter !== "ALL" ||
    sourceFilter !== "ALL";

  const resetFilters = () => {
    setSearchTerm("");
    setDateFilter(todayKey);
    setStatusFilter("ALL");
    setSourceFilter("ALL");
    setCurrentPage(1);
  };

  const selectDate = (key: string) => {
    setDateFilter(key);
    setCurrentPage(1);
  };
  const bookings = bookingsData?.items ?? [];
  const [cancelBooking] = useCancelBookingMutation();
  const [createBooking, { isLoading: isAddingWalkIn }] = useCreateBookingMutation();

  const [showModal, setShowModal] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DiningWalkInFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningWalkInFormSchema) as any,
    defaultValues: emptyDiningWalkInFormValues(),
    mode: "onSubmit",
  });

  const guestsValue = Number(watch("guests") || 2);

  const adjustGuests = (delta: number) => {
    const next = Math.min(20, Math.max(1, guestsValue + delta));
    setValue("guests", String(next), { shouldValidate: true, shouldDirty: true });
  };

  const openWalkInModal = () => {
    reset(emptyDiningWalkInFormValues());
    setShowModal(true);
  };

  const closeWalkInModal = () => {
    setShowModal(false);
    reset(emptyDiningWalkInFormValues());
  };

  const handleCancelBooking = (id: string) => {
    setPendingCancelId(id);
  };

  const onWalkInSubmit = handleSubmit(async (values) => {
    try {
      const res = await createBooking({
        business_id: bizId,
        customer_name: values.customer_name.trim() || "Walk-in Guest",
        customer_phone: (values.customer_phone || "").trim() || "0000000000",
        booking_time: new Date().toISOString(),
        booking_source: "WALK_IN",
        guests: Number(values.guests),
      }).unwrap();
      toast.success(res.message || "Walk-in seated.");
      closeWalkInModal();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to add walk-in. Check table availability."));
    }
  });

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const renderSortHeader = (column: string, label: string) => {
    const isSorted = sortColumn === column;
    return (
      <th
        onClick={() => toggleSort(column)}
        className="px-3 py-2.5 font-semibold cursor-pointer select-none hover:text-slate-700 transition-colors whitespace-nowrap"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isSorted ? (
            sortDirection === "asc" ? (
              <ChevronUp size={12} className="text-rose-500 shrink-0" />
            ) : (
              <ChevronDown size={12} className="text-rose-500 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={11} className="text-slate-300 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  // Filters + sort are applied server-side; use API page as-is.
  const paginatedBookings = bookings;
  const startIndex =
    ((bookingsData?.meta?.page ?? currentPage) - 1) * (bookingsData?.meta?.limit ?? pageSize);
  const showTableShimmer = isLoading || (isFetching && bookings.length === 0);

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Compact header + filters */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-500 min-w-0">
              <span className="font-semibold text-slate-700">{dateHeading}</span>
              {bookingsData?.meta?.total != null
                ? ` · ${bookingsData.meta.total} booking${bookingsData.meta.total === 1 ? "" : "s"}`
                : null}
            </p>
            <button
              type="button"
              onClick={openWalkInModal}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Plus size={14} />
              Add Walk-in
            </button>
          </div>

          {/* Date strip — compact */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {dateStrip.map((day) => {
              const active = dateFilter === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => selectDate(day.key)}
                  title={`${day.weekday} ${day.day} ${day.month}`}
                  className={`shrink-0 h-8 px-2.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? "border-rose-500 bg-rose-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
                  }`}
                >
                  {day.key === todayKey ? "Today" : `${day.weekday} ${day.day}`}
                </button>
              );
            })}
            <label
              className={`shrink-0 inline-flex items-center gap-1 h-8 px-2 rounded-lg border cursor-pointer transition-colors ${
                dateFilter && !dateInStrip
                  ? "border-rose-400 bg-rose-50"
                  : "border-slate-200 bg-white hover:border-rose-300"
              }`}
              title="Pick another date"
            >
              <CalendarDays size={13} className="text-rose-500 shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => selectDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 outline-none max-w-[7.5rem]"
                aria-label="Pick reservation date"
              />
            </label>
            <button
              type="button"
              onClick={() => selectDate("")}
              className={`shrink-0 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                !dateFilter
                  ? "border-rose-500 bg-rose-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-rose-300"
              }`}
            >
              All
            </button>
          </div>

          {/* Status / Source / Search — one compact row */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={filterControlClass}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={filterControlClass}
              aria-label="Filter by source"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <SearchInput
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setCurrentPage(1);
              }}
              placeholder="Search name or phone..."
              className="w-full sm:w-52 [&_input]:!h-8 [&_input]:!py-0 [&_input]:!text-xs [&_input]:!rounded-lg"
            />

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 px-2 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        {/* Dense table — filters/sort/page all server-side */}
        {showTableShimmer ? (
          <div className="p-3 sm:p-4">
            <AdminListShimmer
              rows={8}
              columns={8}
              showTabs={false}
              showToolbar={false}
              showPagination
            />
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold w-10">#</th>
                    {renderSortHeader("customer_name", "Customer")}
                    {renderSortHeader("booking_time", "Reservation")}
                    {renderSortHeader("booking_source", "Source")}
                    {/* Assigned Table — hidden for now; keep for easy restore
                    {renderSortHeader("table_number", "Assigned Table")}
                    */}
                    {renderSortHeader("created_at", "Booked On")}
                    {renderSortHeader("status", "Status")}
                    <th className="px-3 py-2.5 font-semibold">Offer</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBookings.map((booking, index) => {
                    const serialNo = startIndex + index + 1;
                    return (
                      <tr
                        key={booking.id}
                        className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-xs font-bold text-rose-500 tabular-nums">
                          {serialNo}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-sm font-semibold text-slate-800 leading-tight">
                            {booking.customer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {booking.customer_phone}
                          </div>
                          {booking.special_request?.trim() ? (
                            <p className="text-[10px] text-amber-600 mt-0.5 leading-snug max-w-[200px]">
                              <span className="font-semibold">Request:</span>{" "}
                              {booking.special_request.trim()}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="text-xs font-bold text-slate-900">
                            {formatDateCustomer(booking.booking_time)}
                          </div>
                          {formatWeekdayCustomer(booking.booking_time) ? (
                            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                              {formatWeekdayCustomer(booking.booking_time)}
                            </div>
                          ) : null}
                          <div className="text-xs font-semibold text-slate-800 mt-1">
                            {formatTime12h(booking.booking_time)}
                          </div>
                          {booking.end_time ? (
                            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                              Arrive by {formatTime12h(booking.end_time)}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                              booking.booking_source === "ONLINE"
                                ? "bg-sky-50 text-sky-600 border border-sky-100"
                                : "bg-violet-50 text-violet-600 border border-violet-100"
                            }`}
                          >
                            {booking.booking_source}
                          </span>
                        </td>
                        {/* Assigned Table — hidden for now; keep for easy restore
                        <td className="py-2.5 px-3">
                          {booking.table_number ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                              Table {booking.table_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Unassigned</span>
                          )}
                        </td>
                        */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {booking.created_at ? (
                            <>
                              <div className="text-xs font-bold text-slate-900">
                                {formatInstantLocalDate(booking.created_at)}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                                {formatInstantLocalTime(booking.created_at)}
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                              booking.status === "CONFIRMED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : booking.status === "CANCELLED"
                                  ? "bg-rose-50 text-rose-600 border border-rose-100"
                                  : booking.status === "COMPLETED"
                                    ? "bg-sky-50 text-sky-700 border border-sky-100"
                                    : "bg-slate-50 text-slate-500 border border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                booking.status === "CONFIRMED"
                                  ? "bg-emerald-500"
                                  : booking.status === "CANCELLED"
                                    ? "bg-rose-500"
                                    : booking.status === "COMPLETED"
                                      ? "bg-sky-500"
                                      : "bg-slate-400"
                              }`}
                            />
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[160px]">
                          {booking.applied_offer?.title ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {booking.applied_offer.title}
                              </p>
                              {(booking.applied_offer.source === "platform" ||
                                String(booking.applied_offer.type || "")
                                  .toLowerCase()
                                  .includes("bookmybota")) && (
                                <p className="text-[9px] uppercase tracking-wider text-violet-500 font-bold">
                                  BookMyBota
                                </p>
                              )}
                              {booking.applied_offer.promo_code && (
                                <p className="text-[10px] font-mono text-rose-500 truncate">
                                  {booking.applied_offer.promo_code}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400">
                                {formatDiningOfferDiscount(
                                  booking.applied_offer as Parameters<
                                    typeof formatDiningOfferDiscount
                                  >[0]
                                )}
                              </p>
                              {booking.offer_redeemed_at ? (
                                <p className="text-[10px] text-emerald-600 font-semibold">Redeemed</p>
                              ) : booking.status === "COMPLETED" ? (
                                <p className="text-[10px] text-slate-400">Not redeemed</p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {booking.status === "CONFIRMED" && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(booking.id)}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:text-white hover:bg-rose-600 hover:border-rose-600 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedBookings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400 text-sm font-medium">
                        {dateFilter ||
                        statusFilter !== "ALL" ||
                        sourceFilter !== "ALL" ||
                        searchTerm.trim()
                          ? `No bookings found for ${dateHeading.toLowerCase()}. Try another date or clear filters.`
                          : "No bookings yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {bookingsData?.meta && (
              <div className="px-3 py-3 border-t border-slate-100">
                <Pagination
                  meta={bookingsData.meta}
                  onPageChange={setCurrentPage}
                  onLimitChange={(limit) => {
                    setPageSize(limit);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-sm animate-fadeIn">
            <div className="absolute inset-0" onClick={closeWalkInModal} aria-hidden />
            <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr]">
              {/* Left: form */}
              <div className="p-6 sm:p-8 flex flex-col">
                <div className="flex items-start gap-3 mb-6">
                  <span className="h-11 w-11 rounded-2xl bg-rose-50 text-[#e11d48] flex items-center justify-center shrink-0">
                    <UserPlus size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Add Walk-in</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Book a table for a walk-in guest
                    </p>
                  </div>
                </div>

                <form onSubmit={onWalkInSubmit} className="space-y-4 flex-1 flex flex-col" noValidate>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Guest Name (Optional)
                    </label>
                    <div className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/10">
                      <User size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        className="w-full bg-transparent border-0 p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                        placeholder="Walk-in Guest"
                        {...register("customer_name")}
                      />
                    </div>
                    {errors.customer_name && (
                      <p className={fieldErrorClass}>{errors.customer_name.message}</p>
                    )}
                  </div>

                  <Controller
                    name="customer_phone"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        label="Guest Phone (Optional)"
                        labelClassName="block text-[11px] font-semibold text-slate-500 mb-1.5"
                        variant="light"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        required={false}
                        placeholder="9876543210"
                        helperText="Leave empty or enter 9–12 digits"
                        error={errors.customer_phone?.message}
                        showIcon
                        inputClassName="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-3 text-sm text-slate-800 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 placeholder:text-slate-400"
                      />
                    )}
                  />

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                      Party Size <RequiredMark />
                    </label>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/10">
                      <Users size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm font-semibold text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        {...register("guests")}
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustGuests(-1)}
                          disabled={guestsValue <= 1}
                          className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-colors"
                          aria-label="Decrease party size"
                        >
                          <Minus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustGuests(1)}
                          disabled={guestsValue >= 20}
                          className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center transition-colors"
                          aria-label="Increase party size"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {errors.guests && <p className={fieldErrorClass}>{errors.guests.message}</p>}
                  </div>

                  <div className="mt-auto pt-4 flex flex-col-reverse sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={closeWalkInModal}
                      className="sm:flex-1 h-12 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingWalkIn}
                      className="sm:flex-[1.6] h-12 disabled:opacity-50 inline-flex items-center justify-between gap-3 rounded-full pl-5 pr-1.5 text-sm font-semibold text-white bg-gradient-to-r from-[#f43f5e] to-[#e11d48] shadow-[0_8px_20px_rgba(225,29,72,0.35)] hover:from-[#e11d48] hover:to-[#be123c] transition-all"
                    >
                      <span className="flex-1 text-center pl-2">
                        {isAddingWalkIn ? "Adding..." : "Seat Walk-in Now"}
                      </span>
                      <span className="h-9 w-9 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                        {isAddingWalkIn ? (
                          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: illustration */}
              <div className="relative hidden md:flex flex-col items-center justify-center px-6 py-8 bg-gradient-to-b from-rose-50 via-rose-50/80 to-white overflow-hidden min-h-[420px]">
                <button
                  type="button"
                  onClick={closeWalkInModal}
                  className="absolute top-4 right-4 z-10 h-9 w-9 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white flex items-center justify-center shadow-sm transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-rose-100/80" />
                <div className="pointer-events-none absolute bottom-16 -left-8 h-28 w-28 rounded-full bg-rose-100/60" />
                <div className="relative w-full max-w-[300px] aspect-square mb-5">
                  <Image
                    src="/images/dining-walk-in.png"
                    alt="Walk-ins Welcome"
                    fill
                    className="object-contain drop-shadow-lg"
                    sizes="280px"
                    priority
                  />
                </div>
                <h3 className="relative text-lg font-bold text-slate-900 text-center">
                  Walk-ins Welcome!
                </h3>
                <p className="relative text-sm text-slate-500 text-center mt-1.5 max-w-[240px] leading-relaxed">
                  Quickly add a walk-in guest and seat them at your restaurant.
                </p>
              </div>

              {/* Mobile close */}
              <button
                type="button"
                onClick={closeWalkInModal}
                className="md:hidden absolute top-4 right-4 h-9 w-9 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={!!pendingCancelId}
        title="Cancel booking?"
        body="Are you sure you want to cancel this booking?"
        confirmLabel="Cancel booking"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingCancelId(null)}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          setConfirmBusy(true);
          try {
            const res = await cancelBooking({ id: pendingCancelId }).unwrap();
            toast.success((res as { message?: string }).message || "Booking cancelled.");
            setPendingCancelId(null);
          } catch (err) {
            toast.error(extractApiError(err, "Failed to cancel booking"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  FaPlus,
  FaTrash,
  FaUserFriends,
  FaUtensils,
  FaTimes,
  FaCircle,
  FaThLarge,
  FaList,
  FaSort,
} from "react-icons/fa";
import { toast } from "sonner";
import {
  useGetTablesQuery,
  useAddTableMutation,
  useUpdateTableMutation,
  useDeleteTableMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import {
  diningTableFormSchema,
  emptyDiningTableFormValues,
  type DiningTableFormValues,
} from "@/lib/diningPartnerFormSchemas";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

type StatusTab = "ALL" | "ACTIVE" | "INACTIVE";
type ViewMode = "grid" | "list";
type SortKey = "table_number" | "capacity";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "table_number", label: "Table Number" },
  { value: "capacity", label: "Capacity" },
];

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const labelClass = "block text-[11px] font-semibold text-slate-500 mb-1.5";
const inputClass =
  "w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function StatusSwitch({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Deactivate table" : "Activate table"}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
        active ? "bg-emerald-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function TableManager() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("table_number");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [sortOpen]);

  const { data: tablesData, isLoading } = useGetTablesQuery(
    { bizId, page, limit: PAGE_SIZE, ...(q.trim() ? { q: q.trim() } : {}) },
    { skip: !bizId }
  );
  const tables = tablesData?.items ?? [];
  const [addTable, { isLoading: adding }] = useAddTableMutation();
  const [updateTable] = useUpdateTableMutation();
  const [deleteTable] = useDeleteTableMutation();

  const [showModal, setShowModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<{
    id: string;
    is_active: boolean;
    table_number: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DiningTableFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningTableFormSchema) as any,
    defaultValues: emptyDiningTableFormValues(),
    mode: "onSubmit",
  });

  const openModal = () => {
    reset(emptyDiningTableFormValues());
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    reset(emptyDiningTableFormValues());
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!bizId) return;
    try {
      const res = await addTable({
        bizId,
        table_number: values.table_number.trim(),
        capacity: parseInt(values.capacity, 10),
      }).unwrap();
      toast.success((res as { message?: string }).message || "Table created.");
      closeModal();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to add table"));
    }
  });

  const requestToggleActive = (table: {
    id: string;
    is_active: boolean;
    table_number: string;
  }) => {
    if (!bizId) return;
    setPendingToggle({
      id: table.id,
      is_active: table.is_active,
      table_number: table.table_number,
    });
  };

  const handleDeleteTable = (tableId: string) => {
    if (!bizId) return;
    setPendingDeleteId(tableId);
  };

  const stats = useMemo(() => {
    const active = tables.filter((t) => t.is_active).length;
    const inactive = tables.filter((t) => !t.is_active).length;
    const capacity = tables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0);
    const total = tablesData?.meta?.total ?? tables.length;
    return { total, active, inactive, capacity };
  }, [tables, tablesData?.meta?.total]);

  const filteredTables = useMemo(() => {
    let list =
      statusTab === "ACTIVE"
        ? tables.filter((t) => t.is_active)
        : statusTab === "INACTIVE"
          ? tables.filter((t) => !t.is_active)
          : [...tables];

    list.sort((a, b) => {
      if (sortKey === "capacity") {
        return (Number(a.capacity) || 0) - (Number(b.capacity) || 0);
      }
      return String(a.table_number).localeCompare(String(b.table_number), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
    return list;
  }, [tables, statusTab, sortKey]);

  const statusTabs: { key: StatusTab; label: string; count: number }[] = [
    { key: "ALL", label: "All Tables", count: tables.length },
    { key: "ACTIVE", label: "Active", count: stats.active },
    { key: "INACTIVE", label: "Inactive", count: stats.inactive },
  ];

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header — matches 1st reference */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Table Management
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Add physical tables and toggle them active/inactive.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center shrink-0 w-full lg:w-auto">
            <SearchInput
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(1);
              }}
              placeholder="Search table number..."
              className="w-full sm:w-64"
            />
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] shadow-sm shadow-rose-600/20 transition-colors shrink-0"
            >
              <FaPlus size={14} />
              Add Table
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg bg-rose-50 text-[#e11d48] flex items-center justify-center shrink-0">
              <FaUtensils size={16} />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                {stats.total}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">Total Tables</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FaCircle size={10} />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                {stats.active}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">Active Tables</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <FaCircle size={10} />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                {stats.inactive}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">Inactive Tables</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm flex items-center gap-3">
            <span className="h-10 w-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <FaUserFriends size={16} />
            </span>
            <div>
              <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                {stats.capacity}
              </p>
              <p className="text-[11px] font-semibold text-slate-400">Total Capacity</p>
            </div>
          </div>
        </div>

        {/* Tabs + sort / view */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  statusTab === tab.key
                    ? "bg-rose-50 text-[#e11d48] border border-rose-200"
                    : "bg-transparent text-slate-500 border border-transparent hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {tab.label}
                <span className="tabular-nums">({tab.count})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-500">
              <span className="whitespace-nowrap">Sort by</span>
              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50/40 pl-3.5 pr-3 text-xs sm:text-sm font-semibold text-[#e11d48] hover:bg-rose-50 focus:outline-none focus:border-[#e11d48] focus:ring-2 focus:ring-rose-500/15 transition-colors"
                >
                  {SORT_OPTIONS.find((o) => o.value === sortKey)?.label}
                  <FaSort size={11} className="text-[#e11d48]" />
                </button>
                {sortOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full z-30 mt-2 min-w-full w-max rounded-xl border border-rose-100 bg-white p-1 shadow-lg shadow-rose-600/10"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const selected = sortKey === opt.value;
                      return (
                        <li key={opt.value} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onClick={() => {
                              setSortKey(opt.value);
                              setSortOpen(false);
                            }}
                            className={`w-full text-left whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                              selected
                                ? "border border-[#e11d48] bg-rose-50 text-[#e11d48]"
                                : "border border-transparent text-slate-600 hover:bg-rose-50/60 hover:text-[#e11d48]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`h-9 w-9 flex items-center justify-center transition-colors ${
                  viewMode === "grid"
                    ? "bg-[#e11d48] text-white"
                    : "bg-white text-slate-400 hover:text-slate-600"
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <FaThLarge size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`h-9 w-9 flex items-center justify-center transition-colors border-l border-slate-200 ${
                  viewMode === "list"
                    ? "bg-[#e11d48] text-white"
                    : "bg-white text-slate-400 hover:text-slate-600"
                }`}
                title="List view"
                aria-label="List view"
              >
                <FaList size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Table cards / list */}
        {isLoading ? (
          <p className="text-slate-400 text-center py-10 text-sm">Loading your floor plan...</p>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm font-medium rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            {tables.length === 0
              ? "No tables configured. Add one!"
              : "No tables match this filter."}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((t) => (
              <div
                key={t.id}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    t.is_active ? "bg-[#e11d48]" : "bg-slate-300"
                  }`}
                />

                <div className="relative flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-900">{t.table_number}</h3>
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(t.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Table"
                  >
                    <FaTrash size={13} />
                  </button>
                </div>

                <p className="relative inline-flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                  <FaUserFriends size={13} className="text-slate-400" />
                  Capacity: {t.capacity} Guests
                </p>

                <div className="relative">
                  <StatusSwitch
                    active={t.is_active}
                    onToggle={() => requestToggleActive(t)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
            {filteredTables.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{t.table_number}</p>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5">
                      <FaUserFriends size={11} />
                      Capacity: {t.capacity} Guests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusSwitch
                    active={t.is_active}
                    onToggle={() => requestToggleActive(t)}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(t.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Table"
                  >
                    <FaTrash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tablesData?.meta && (
          <div className="pt-1">
            <Pagination
              meta={tablesData.meta}
              onPageChange={setPage}
              className="!border border-slate-200 !shadow-sm !bg-white !rounded-xl"
            />
          </div>
        )}
      </div>

      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm animate-fadeIn">
            <div className="absolute inset-0" onClick={closeModal} aria-hidden />
            <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <FaTimes size={14} />
              </button>
              <div className="flex items-center gap-3 mb-5 pr-8">
                <Image
                  src="/images/dining-table-icon.png"
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain shrink-0"
                />
                <h2 className="text-xl font-bold text-slate-900">Add Physical Table</h2>
              </div>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <label className={labelClass}>
                    Table Identifier <RequiredMark />
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="E.g., T-12, Bar-1"
                    {...register("table_number")}
                  />
                  {errors.table_number && (
                    <p className={fieldErrorClass}>{errors.table_number.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Seating Capacity <RequiredMark />
                  </label>
                  <input type="number" min={1} className={inputClass} {...register("capacity")} />
                  {errors.capacity && (
                    <p className={fieldErrorClass}>{errors.capacity.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={adding}
                  className="w-full h-11 mt-2 disabled:opacity-50 inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#f43f5e] to-[#e11d48] shadow-[0_8px_18px_rgba(225,29,72,0.28)] hover:from-[#e11d48] hover:to-[#be123c] transition-all"
                >
                  {adding ? "Creating..." : "Create Table"}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete table?"
        body="Are you sure you want to delete this table?"
        confirmLabel="Delete"
        danger
        theme="light"
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!bizId || !pendingDeleteId) return;
          setConfirmBusy(true);
          try {
            const res = await deleteTable({ bizId, tableId: pendingDeleteId }).unwrap();
            toast.success((res as { message?: string }).message || "Table deleted.");
            setPendingDeleteId(null);
          } catch (err) {
            toast.error(extractApiError(err, "Failed to delete table"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={!!pendingToggle}
        title={pendingToggle?.is_active ? "Deactivate table?" : "Activate table?"}
        body={
          pendingToggle?.is_active
            ? `Are you sure you want to deactivate ${pendingToggle.table_number}? It will no longer be available for seating.`
            : `Are you sure you want to activate ${pendingToggle?.table_number ?? "this table"}? It will become available for seating.`
        }
        confirmLabel={pendingToggle?.is_active ? "Deactivate" : "Activate"}
        danger={!!pendingToggle?.is_active}
        theme="light"
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingToggle(null)}
        onConfirm={async () => {
          if (!bizId || !pendingToggle) return;
          setConfirmBusy(true);
          try {
            const res = await updateTable({
              bizId,
              tableId: pendingToggle.id,
              is_active: !pendingToggle.is_active,
            }).unwrap();
            toast.success(
              (res as { message?: string }).message ||
                (pendingToggle.is_active ? "Table deactivated." : "Table activated.")
            );
            setPendingToggle(null);
          } catch (err) {
            toast.error(extractApiError(err, "Failed to update table"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

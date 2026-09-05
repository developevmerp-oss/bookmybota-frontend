"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Trash2 } from "lucide-react";
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

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
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

  const handleToggleActive = async (tableId: string, currentStatus: boolean) => {
    if (!bizId) return;
    try {
      const res = await updateTable({
        bizId,
        tableId,
        is_active: !currentStatus,
      }).unwrap();
      toast.success(
        (res as { message?: string }).message ||
          (currentStatus ? "Table deactivated." : "Table activated.")
      );
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update table"));
    }
  };

  const handleDeleteTable = (tableId: string) => {
    if (!bizId) return;
    setPendingDeleteId(tableId);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Interactive Table Management</h2>
          <p className="text-zinc-400">Add physical tables and toggle them active/inactive.</p>
        </div>
        <div className="flex gap-3 items-center">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search table number"
          />
          <button type="button" onClick={openModal} className="btn-primary">
            Add Table
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-zinc-400 text-center py-10">Loading your floor plan...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className={`glass-panel p-6 rounded-2xl border ${
                t.is_active ? "border-white/5" : "border-rose-500/20 opacity-60"
              } text-center transition-colors relative overflow-hidden group`}
            >
              <div
                className={`absolute top-0 left-0 w-full h-1 ${
                  t.is_active ? "bg-rose-500" : "bg-zinc-600"
                }`}
              />
              <button
                type="button"
                onClick={() => handleDeleteTable(t.id)}
                className="absolute top-3 right-3 text-zinc-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Table"
              >
                <Trash2 size={16} />
              </button>
              <h3 className="text-xl font-bold text-white mb-1 mt-2">{t.table_number}</h3>
              <p className="text-zinc-400 text-sm mb-4">Capacity: {t.capacity} Guests</p>
              <button
                type="button"
                onClick={() => void handleToggleActive(t.id, t.is_active)}
                className={`text-xs font-bold px-3 py-1 rounded-md border ${
                  t.is_active
                    ? "text-green-400 border-green-500/30 hover:bg-green-500/10"
                    : "text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10"
                } transition-colors`}
              >
                {t.is_active ? "ACTIVE" : "INACTIVE"}
              </button>
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-4 text-center py-10 text-zinc-500">
              No tables configured. Add one!
            </div>
          )}
        </div>
      )}
      {tablesData?.meta && <Pagination meta={tablesData.meta} onPageChange={setPage} />}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Physical Table</h2>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Table Identifier <RequiredMark />
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="E.g., T-12, Bar-1"
                  {...register("table_number")}
                />
                {errors.table_number && (
                  <p className={fieldErrorClass}>{errors.table_number.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Seating Capacity <RequiredMark />
                </label>
                <input type="number" min={1} className="input-field" {...register("capacity")} />
                {errors.capacity && (
                  <p className={fieldErrorClass}>{errors.capacity.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={adding}
                className="btn-primary w-full mt-4 disabled:opacity-50 flex items-center justify-center"
              >
                {adding ? "Creating..." : "Create Table"}
              </button>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete table?"
        body="Are you sure you want to delete this table?"
        confirmLabel="Delete"
        danger
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
    </div>
  );
}

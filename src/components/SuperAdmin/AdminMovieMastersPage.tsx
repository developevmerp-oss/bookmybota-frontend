"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Film, Languages, LayoutGrid, Loader2, Pencil, Plus, Tags, Trash2, Users, X } from "lucide-react";
import {
  useGetAdminMovieFormatsQuery,
  useGetAdminMovieGenresQuery,
  useGetAdminMovieLanguagesQuery,
  useGetAdminMovieCrewRolesQuery,
  useCreateAdminMovieFormatMutation,
  useCreateAdminMovieGenreMutation,
  useCreateAdminMovieLanguageMutation,
  useCreateAdminMovieCrewRoleMutation,
  useUpdateAdminMovieFormatMutation,
  useUpdateAdminMovieGenreMutation,
  useUpdateAdminMovieLanguageMutation,
  useUpdateAdminMovieCrewRoleMutation,
  useDeleteAdminMovieFormatMutation,
  useDeleteAdminMovieGenreMutation,
  useDeleteAdminMovieLanguageMutation,
  useDeleteAdminMovieCrewRoleMutation,
  type MovieMasterItem,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminMovieMasterFormSchema,
  type AdminMovieMasterFormValues,
} from "@/lib/adminFormSchemas";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

type MasterTab = "languages" | "genres" | "formats" | "crew_roles";

const TAB_META: Record<
  MasterTab,
  { label: string; singular: string; icon: typeof Languages; searchPlaceholder: string }
> = {
  languages: {
    label: "Languages",
    singular: "Language",
    icon: Languages,
    searchPlaceholder: "Search languages…",
  },
  genres: {
    label: "Genres",
    singular: "Genre",
    icon: Tags,
    searchPlaceholder: "Search genres…",
  },
  formats: {
    label: "Formats",
    singular: "Format",
    icon: LayoutGrid,
    searchPlaceholder: "Search formats…",
  },
  crew_roles: {
    label: "Crew Roles",
    singular: "Crew role",
    icon: Users,
    searchPlaceholder: "Search crew roles…",
  },
};

function ActiveToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        active ? "bg-green-500/30 border-green-500/50" : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={active ? "Active" : "Inactive"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminMovieMastersPage() {
  const [tab, setTab] = useState<MasterTab>("languages");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MovieMasterItem | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    confirmLabel?: string;
    danger?: boolean;
    variant?: "danger" | "success" | "warning";
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const form = useForm<AdminMovieMasterFormValues>({
    resolver: yupResolver(adminMovieMasterFormSchema),
    defaultValues: { name: "", sort_order: 0, is_active: true },
    mode: "onSubmit",
  });

  const queryArg = useMemo(
    () => ({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [q, page, limit]
  );

  const languagesQuery = useGetAdminMovieLanguagesQuery(queryArg, { skip: tab !== "languages" });
  const genresQuery = useGetAdminMovieGenresQuery(queryArg, { skip: tab !== "genres" });
  const formatsQuery = useGetAdminMovieFormatsQuery(queryArg, { skip: tab !== "formats" });
  const crewRolesQuery = useGetAdminMovieCrewRolesQuery(queryArg, { skip: tab !== "crew_roles" });

  const [createLanguage, { isLoading: creatingLanguage }] = useCreateAdminMovieLanguageMutation();
  const [updateLanguage, { isLoading: updatingLanguage }] = useUpdateAdminMovieLanguageMutation();
  const [deleteLanguage] = useDeleteAdminMovieLanguageMutation();

  const [createGenre, { isLoading: creatingGenre }] = useCreateAdminMovieGenreMutation();
  const [updateGenre, { isLoading: updatingGenre }] = useUpdateAdminMovieGenreMutation();
  const [deleteGenre] = useDeleteAdminMovieGenreMutation();

  const [createFormat, { isLoading: creatingFormat }] = useCreateAdminMovieFormatMutation();
  const [updateFormat, { isLoading: updatingFormat }] = useUpdateAdminMovieFormatMutation();
  const [deleteFormat] = useDeleteAdminMovieFormatMutation();

  const [createCrewRole, { isLoading: creatingCrewRole }] = useCreateAdminMovieCrewRoleMutation();
  const [updateCrewRole, { isLoading: updatingCrewRole }] = useUpdateAdminMovieCrewRoleMutation();
  const [deleteCrewRole] = useDeleteAdminMovieCrewRoleMutation();

  const tabMeta = TAB_META[tab];
  const saving =
    creatingLanguage ||
    updatingLanguage ||
    creatingGenre ||
    updatingGenre ||
    creatingFormat ||
    updatingFormat ||
    creatingCrewRole ||
    updatingCrewRole;

  const activeQuery =
    tab === "languages"
      ? languagesQuery
      : tab === "genres"
        ? genresQuery
        : tab === "formats"
          ? formatsQuery
          : crewRolesQuery;

  const items = activeQuery.data?.items ?? [];
  const activeMeta = activeQuery.data?.meta;

  const openCreate = () => {
    setEditingItem(null);
    form.reset({ name: "", sort_order: 0, is_active: true });
    setFormOpen(true);
  };

  const openEdit = (item: MovieMasterItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name || "",
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active !== false,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingItem(null);
  };

  const onSubmit = async (values: AdminMovieMasterFormValues) => {
    const payload = {
      name: values.name.trim(),
      sort_order: Number(values.sort_order) || 0,
      is_active: values.is_active !== false,
    };

    try {
      if (tab === "languages") {
        if (editingItem) {
          const updated = await updateLanguage({ id: editingItem.id, body: payload }).unwrap();
          toast.success(`Language "${updated.name}" updated`);
        } else {
          const created = await createLanguage(payload).unwrap();
          toast.success(`Language "${created.name}" added`);
        }
      } else if (tab === "genres") {
        if (editingItem) {
          const updated = await updateGenre({ id: editingItem.id, body: payload }).unwrap();
          toast.success(`Genre "${updated.name}" updated`);
        } else {
          const created = await createGenre(payload).unwrap();
          toast.success(`Genre "${created.name}" added`);
        }
      } else if (tab === "formats") {
        if (editingItem) {
          const updated = await updateFormat({ id: editingItem.id, body: payload }).unwrap();
          toast.success(`Format "${updated.name}" updated`);
        } else {
          const created = await createFormat(payload).unwrap();
          toast.success(`Format "${created.name}" added`);
        }
      } else {
        if (editingItem) {
          const updated = await updateCrewRole({ id: editingItem.id, body: payload }).unwrap();
          toast.success(`Crew role "${updated.name}" updated`);
        } else {
          const created = await createCrewRole(payload).unwrap();
          toast.success(`Crew role "${created.name}" added`);
        }
      }
      setFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error(extractApiError(err, editingItem ? "Failed to update" : "Failed to add"));
    }
  };

  const handleToggleActive = (item: MovieMasterItem) => {
    const next = !item.is_active;
    const singular = tabMeta.singular.toLowerCase();
    setPendingConfirm({
      title: next ? `Enable ${singular}?` : `Disable ${singular}?`,
      body: next
        ? tab === "crew_roles"
          ? `Enable "${item.name}" for movie crew forms?`
          : `Enable "${item.name}" for movie forms and customer filters?`
        : tab === "crew_roles"
          ? `"${item.name}" will be hidden from new crew selections.`
          : `"${item.name}" will be hidden from new movie selections.`,
      confirmLabel: next ? "Enable" : "Disable",
      variant: next ? "success" : "warning",
      run: async () => {
        const body = { is_active: next };
        if (tab === "languages") {
          await updateLanguage({ id: item.id, body }).unwrap();
        } else if (tab === "genres") {
          await updateGenre({ id: item.id, body }).unwrap();
        } else if (tab === "formats") {
          await updateFormat({ id: item.id, body }).unwrap();
        } else {
          await updateCrewRole({ id: item.id, body }).unwrap();
        }
        toast.success(next ? `"${item.name}" enabled` : `"${item.name}" disabled`);
      },
    });
  };

  const handleDelete = (item: MovieMasterItem) => {
    const singular = tabMeta.singular.toLowerCase();
    setPendingConfirm({
      title: `Delete ${singular}?`,
      body: `Delete "${item.name}"? Movies already using it will keep the label until edited.`,
      confirmLabel: "Delete",
      danger: true,
      variant: "danger",
      run: async () => {
        if (tab === "languages") {
          await deleteLanguage(item.id).unwrap();
        } else if (tab === "genres") {
          await deleteGenre(item.id).unwrap();
        } else if (tab === "formats") {
          await deleteFormat(item.id).unwrap();
        } else {
          await deleteCrewRole(item.id).unwrap();
        }
        toast.success(`${tabMeta.singular} "${item.name}" deleted`);
      },
    });
  };

  return (
    <div data-admin-page="movie-masters" className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Film size={20} className="text-fuchsia-400" /> Movie Masters
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Manage languages, genres, screen formats, and crew roles used when adding movies and on customer filters.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus size={16} />
          Add {tabMeta.singular}
        </button>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {(Object.keys(TAB_META) as MasterTab[]).map((key) => {
          const meta = TAB_META[key];
          const Icon = meta.icon;
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
                isActive
                  ? "border-rose-500 text-rose-400"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Icon size={16} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="admin-list-toolbar">
        <SearchInput
          className="w-full sm:max-w-sm"
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder={tabMeta.searchPlaceholder}
        />
        <span className="text-xs text-zinc-500">
          {activeMeta?.total ?? items.length} {tabMeta.label.toLowerCase()}
          {activeQuery.isFetching && !activeQuery.isLoading ? " · refreshing…" : ""}
        </span>
      </div>

      {activeQuery.isLoading ? (
        <AdminListShimmer rows={6} />
      ) : activeQuery.isError ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-8 text-center">
          <p className="text-zinc-400 mb-3">
            {extractApiError(activeQuery.error, `Failed to load ${tabMeta.label.toLowerCase()}`)}
          </p>
          <button type="button" onClick={() => activeQuery.refetch()} className="btn-secondary">
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center text-zinc-500">
          No {tabMeta.label.toLowerCase()} yet.{" "}
          <button type="button" onClick={openCreate} className="text-rose-400 hover:text-rose-300 font-semibold">
            Add {tabMeta.singular.toLowerCase()}
          </button>
        </div>
      ) : (
        <div
          className={`glass-panel rounded-2xl border border-white/10 overflow-hidden ${
            activeQuery.isFetching ? "opacity-70" : ""
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 text-left bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Sort</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 last:border-0 ${!item.is_active ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{item.slug || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{item.sort_order ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ActiveToggle active={item.is_active !== false} onToggle={() => handleToggleActive(item)} />
                        <span className={`text-xs ${item.is_active !== false ? "text-green-400" : "text-zinc-500"}`}>
                          {item.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                          title={`Edit ${tabMeta.singular.toLowerCase()}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                          title={`Delete ${tabMeta.singular.toLowerCase()}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        meta={
          activeMeta ?? {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_prev: false,
            has_next: false,
          }
        }
        disabled={activeQuery.isFetching}
        onPageChange={setPage}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
      />

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div className="w-full max-w-md glass-panel border border-white/10 rounded-2xl p-6 my-8">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editingItem ? `Edit ${tabMeta.singular}` : `Add ${tabMeta.singular}`}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {editingItem
                    ? `Update this ${tabMeta.singular.toLowerCase()} for movie forms and customer filters.`
                    : `New ${tabMeta.label.toLowerCase()} are active by default unless you turn them off.`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">{tabMeta.singular} name *</label>
                <input
                  className="input-field w-full"
                  placeholder={`e.g. ${
                    tab === "languages"
                      ? "English"
                      : tab === "genres"
                        ? "Action"
                        : tab === "formats"
                          ? "IMAX 2D"
                          : "Director"
                  }`}
                  {...form.register("name")}
                />
                {form.formState.errors.name?.message ? (
                  <p className="text-xs text-rose-400 mt-2">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Sort order</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input-field w-full"
                  {...form.register("sort_order", { valueAsNumber: true })}
                />
                {form.formState.errors.sort_order?.message ? (
                  <p className="text-xs text-rose-400 mt-2">{form.formState.errors.sort_order.message}</p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-1">Lower numbers appear first in dropdowns and filters.</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input type="checkbox" {...form.register("is_active")} className="rounded border-zinc-600" />
                Active — visible in movie forms{tab === "crew_roles" ? "" : " and customer filters"}
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} disabled={saving} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingItem ? "Save changes" : `Add ${tabMeta.singular.toLowerCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        body={pendingConfirm?.body ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel ?? "Confirm"}
        danger={pendingConfirm?.danger}
        variant={pendingConfirm?.variant}
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.run();
            setPendingConfirm(null);
          } catch (err) {
            toast.error(extractApiError(err, "Action failed"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

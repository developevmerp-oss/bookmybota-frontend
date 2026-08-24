"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Plus, Star, Trash2 } from "lucide-react";
import {
  useGetAdminCitiesQuery,
  useCreateAdminCityMutation,
  useUpdateAdminCityMutation,
  useDeleteAdminCityMutation,
  useUploadImageMutation,
  type CityMaster,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminCityCreateSchema,
  type AdminCityCreateValues,
} from "@/lib/adminFormSchemas";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { PAGE_SIZE } from "@/lib/pagination";

const CITY_COUNTRIES = ["India", "Ethiopia"] as const;

function ActiveToggle({
  active,
  onToggle,
  disabled,
  title,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        active
          ? "bg-green-500/30 border-green-500/50"
          : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={title}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminCitiesPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminCityCreateValues>({
    resolver: yupResolver(adminCityCreateSchema),
    defaultValues: {
      name: "",
      state: "",
      country: "",
      icon_url: "",
      is_popular: false,
    },
    mode: "onSubmit",
  });
  const isPopular = watch("is_popular");
  const iconUrl = watch("icon_url") || "";

  const queryArg = useMemo(
    () => ({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [q, page, limit]
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetAdminCitiesQuery(queryArg);
  const cities = data?.items ?? [];

  const [createCity, { isLoading: creating }] = useCreateAdminCityMutation();
  const [updateCity] = useUpdateAdminCityMutation();
  const [deleteCity] = useDeleteAdminCityMutation();
  const [uploadImage, { isLoading: uploadingIcon }] = useUploadImageMutation();

  const onCreateValid = async (values: AdminCityCreateValues) => {
    if (values.is_popular) {
      const popularCount = cities.filter((c) => c.is_popular).length;
      if (popularCount >= 10) {
        toast.error("Maximum 10 popular cities allowed. Unmark one first.");
        return;
      }
    }
    try {
      const created = await createCity({
        name: values.name.trim(),
        state: values.state?.trim() || undefined,
        country: values.country,
        icon_url: values.icon_url?.trim() || undefined,
        is_popular: values.is_popular,
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message ||
          `City "${created.name}" added successfully`
      );
      reset({ name: "", state: "", country: "", icon_url: "", is_popular: false });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add city"));
    }
  };

  const uploadCityIcon = async (city: CityMaster, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (!res.url) return;
      await updateCity({ id: city.id, body: { icon_url: res.url } }).unwrap();
      toast.success(`Icon updated for "${city.name}"`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to upload icon"));
    }
  };

  const clearCityIcon = async (city: CityMaster) => {
    try {
      await updateCity({ id: city.id, body: { icon_url: null } }).unwrap();
      toast.success(`Icon removed for "${city.name}"`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to remove icon"));
    }
  };

  const updateCountry = async (city: CityMaster, country: string) => {
    if ((city.country || "") === country) return;
    try {
      await updateCity({
        id: city.id,
        body: { country: country || null },
      }).unwrap();
      toast.success(`Country updated for "${city.name}"`);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update country"));
    }
  };

  const toggleActive = async (city: CityMaster) => {
    const next = !city.is_active;
    try {
      await updateCity({ id: city.id, body: { is_active: next } }).unwrap();
      toast.success(
        next
          ? `"${city.name}" is now active — visible in city pickers`
          : `"${city.name}" is inactive — hidden from city pickers`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update city status"));
    }
  };

  const togglePopular = async (city: CityMaster) => {
    const next = !city.is_popular;
    if (next) {
      const popularCount = cities.filter((c) => c.is_popular).length;
      if (popularCount >= 10) {
        toast.error("Maximum 10 popular cities allowed. Unmark one first.");
        return;
      }
    }
    try {
      await updateCity({ id: city.id, body: { is_popular: next } }).unwrap();
      toast.success(
        next
          ? `"${city.name}" marked as popular`
          : `"${city.name}" removed from popular`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update popular flag"));
    }
  };

  const askDelete = (city: CityMaster) => {
    setPendingConfirm({
      title: "Delete city?",
      body: `Remove "${city.name}" from the city master? This cannot be undone.`,
      run: async () => {
        await deleteCity(city.id).unwrap();
        toast.success(`City "${city.name}" deleted`);
      },
    });
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <form
        onSubmit={handleSubmit(onCreateValid)}
        noValidate
        className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Plus size={16} />
          Add city
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              placeholder="City name *"
              {...register("name")}
              className="input-field w-full"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.name.message}</p>
            )}
          </div>
          <div>
            <input
              type="text"
              placeholder="State / region"
              {...register("state")}
              className="input-field w-full"
            />
          </div>
          <div>
            <select {...register("country")} className="input-field w-full">
              <option value="">Select country *</option>
              {CITY_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.country.message}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 px-1">
            <input type="checkbox" {...register("is_popular")} className="rounded border-zinc-600" />
            Mark as popular
          </label>
        </div>
        {isPopular && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">
              Popular city icon (optional). Shown in the top-bar city picker. Square PNG/SVG works best.
            </p>
            <CroppedImageField
              value={iconUrl}
              aspect={1}
              disabled={uploadingIcon}
              previewClassName="w-16 h-16 rounded-xl border border-white/10 bg-zinc-900/40 object-contain"
              emptyClassName="flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-dashed border-white/20 hover:border-rose-400"
              onRemove={() => setValue("icon_url", "", { shouldDirty: true })}
              onCroppedFile={async (file) => {
                const fd = new FormData();
                fd.append("image", file);
                try {
                  const res = await uploadImage(fd).unwrap();
                  if (res.url) setValue("icon_url", res.url, { shouldDirty: true });
                } catch {
                  toast.error("Failed to upload icon");
                }
              }}
              emptyContent={<span className="text-[0.625rem] text-zinc-500">Icon</span>}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={creating}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <Plus size={16} />
          {creating ? "Adding..." : "Add city"}
        </button>
      </form>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search cities..."
          />
          <p className="text-xs text-zinc-500">
            {data?.meta?.total ?? cities.length} cit{(data?.meta?.total ?? cities.length) === 1 ? "y" : "ies"}
            {isFetching ? " · refreshing…" : ""}
          </p>
        </div>

        {isLoading ? (
          <AdminListShimmer rows={6} columns={7} showTabs={false} showToolbar={false} />
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-rose-400 text-sm">{extractApiError(error, "Failed to load cities")}</p>
            <button type="button" onClick={() => refetch()} className="text-sm text-rose-400 underline">
              Retry
            </button>
          </div>
        ) : cities.length === 0 ? (
          <div className="p-10 text-center text-zinc-400 text-sm">
            No cities yet. Add your first city above.
          </div>
        ) : (
          <>
            <div className="admin-card-grid">
              {cities.map((city) => (
                <article key={city.id} className="admin-data-card">
                  <div className="admin-data-card-header">
                    <div className="min-w-0">
                      <p className="admin-data-card-title">{city.name}</p>
                      {city.slug ? <p className="text-xs text-zinc-500 mt-0.5">{city.slug}</p> : null}
                    </div>
                    <CroppedImageField
                      value={city.icon_url || ""}
                      aspect={1}
                      disabled={uploadingIcon}
                      previewClassName="w-10 h-10 rounded-lg border border-white/10 bg-zinc-900/40 object-contain"
                      emptyClassName="flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-white/20 hover:border-rose-400"
                      onRemove={() => clearCityIcon(city)}
                      onCroppedFile={(file) => uploadCityIcon(city, file)}
                      emptyContent={<span className="text-[0.5625rem] text-zinc-500">+</span>}
                    />
                  </div>
                  <div className="admin-data-card-body">
                    <div className="admin-data-card-row">
                      <span className="admin-data-card-label">State</span>
                      <div className="admin-data-card-value">{city.state || "—"}</div>
                    </div>
                    <div className="admin-data-card-row">
                      <span className="admin-data-card-label">Country</span>
                      <div className="admin-data-card-value">
                        <select
                          value={
                            city.country && CITY_COUNTRIES.includes(city.country as (typeof CITY_COUNTRIES)[number])
                              ? city.country
                              : ""
                          }
                          onChange={(e) => updateCountry(city, e.target.value)}
                          className="bg-zinc-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-rose-500 w-full"
                        >
                          <option value="">Select country</option>
                          {CITY_COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="admin-data-card-row">
                      <span className="admin-data-card-label">Popular</span>
                      <div className="admin-data-card-value">
                        <button
                          type="button"
                          onClick={() => togglePopular(city)}
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                            city.is_popular
                              ? "text-amber-400 bg-amber-500/10"
                              : "text-zinc-500 hover:text-amber-400"
                          }`}
                          title={city.is_popular ? "Remove from popular" : "Mark as popular"}
                        >
                          <Star size={16} fill={city.is_popular ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>
                    <div className="admin-data-card-row">
                      <span className="admin-data-card-label">Active</span>
                      <div className="admin-data-card-value">
                        <ActiveToggle
                          active={city.is_active}
                          onToggle={() => toggleActive(city)}
                          title={
                            city.is_active
                              ? "Active — visible in city pickers"
                              : "Inactive — hidden from city pickers"
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="admin-data-card-actions">
                    <button
                      type="button"
                      onClick={() => askDelete(city)}
                      className="inline-flex items-center justify-center p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete city"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="admin-table-desktop overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-white/5">
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Icon</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium text-center">Popular</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((city) => (
                  <tr key={city.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{city.name}</div>
                      {city.slug ? (
                        <div className="text-xs text-zinc-500 mt-0.5">{city.slug}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CroppedImageField
                        value={city.icon_url || ""}
                        aspect={1}
                        disabled={uploadingIcon}
                        previewClassName="w-10 h-10 rounded-lg border border-white/10 bg-zinc-900/40 object-contain"
                        emptyClassName="flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-white/20 hover:border-rose-400"
                        onRemove={() => clearCityIcon(city)}
                        onCroppedFile={(file) => uploadCityIcon(city, file)}
                        emptyContent={<span className="text-[0.5625rem] text-zinc-500">+</span>}
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{city.state || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      <select
                        value={
                          city.country && CITY_COUNTRIES.includes(city.country as (typeof CITY_COUNTRIES)[number])
                            ? city.country
                            : ""
                        }
                        onChange={(e) => updateCountry(city, e.target.value)}
                        className="bg-zinc-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="">Select country</option>
                        {CITY_COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => togglePopular(city)}
                        className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                          city.is_popular
                            ? "text-amber-400 bg-amber-500/10"
                            : "text-zinc-500 hover:text-amber-400"
                        }`}
                        title={city.is_popular ? "Remove from popular" : "Mark as popular"}
                      >
                        <Star size={16} fill={city.is_popular ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex justify-center">
                        <ActiveToggle
                          active={city.is_active}
                          onToggle={() => toggleActive(city)}
                          title={
                            city.is_active
                              ? "Active — visible in city pickers"
                              : "Inactive — hidden from city pickers"
                          }
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => askDelete(city)}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete city"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

        <div className="admin-list-footer">
          <Pagination
            meta={
              data?.meta ?? {
                page,
                limit,
                total: 0,
                total_pages: 0,
                has_prev: false,
                has_next: false,
              }
            }
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
            disabled={isFetching}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        body={pendingConfirm?.body || ""}
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.run();
            setPendingConfirm(null);
          } catch (err: unknown) {
            toast.error(extractApiError(err, "Failed to delete city"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

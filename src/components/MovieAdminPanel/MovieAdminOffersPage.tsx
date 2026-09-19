"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateCinemaOfferMutation,
  useDeleteCinemaOfferMutation,
  useGetCinemaOfferEligibleMoviesQuery,
  useGetCinemaOffersQuery,
  useUpdateCinemaOfferMutation,
  type CinemaOffer,
  type CinemaOfferEligibleMovie,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatOfferDiscount } from "@/lib/currencyFormat";
import {
  buildCinemaOfferFormSchema,
  emptyCinemaOfferFormValues,
  type CinemaOfferFormValues,
} from "@/lib/cinemaOfferFormSchema";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const reqStar = <span className="text-rose-500">*</span>;

function applyLabel(applyTo?: string) {
  switch (applyTo) {
    case "ALL_MY_MOVIES":
      return "All my movies";
    case "SELECTED_MOVIES":
      return "Selected movies";
    default:
      return "One movie";
  }
}

function OfferFormPanel({
  editing,
  eligibleMovies,
  initialValues,
  onCancel,
  onSaved,
}: {
  editing: CinemaOffer | null;
  eligibleMovies: CinemaOfferEligibleMovie[];
  initialValues: CinemaOfferFormValues;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [createOffer, { isLoading: creating }] = useCreateCinemaOfferMutation();
  const [updateOffer, { isLoading: updating }] = useUpdateCinemaOfferMutation();
  const schema = useMemo(() => buildCinemaOfferFormSchema(), []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CinemaOfferFormValues>({
    resolver: yupResolver(schema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const applyTo = watch("apply_to");
  const movieId = watch("movieId");
  const movieIds = watch("movie_ids") || [];

  useEffect(() => {
    if (applyTo === "THIS_MOVIE" && movieId) {
      setValue("movie_ids", [movieId], { shouldValidate: true });
    }
  }, [applyTo, movieId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const body = {
      apply_to: values.apply_to,
      movie_id: values.apply_to === "THIS_MOVIE" ? values.movieId : values.movie_ids[0],
      movie_ids:
        values.apply_to === "ALL_MY_MOVIES"
          ? []
          : values.apply_to === "THIS_MOVIE"
            ? [values.movieId]
            : values.movie_ids,
      title: values.title.trim(),
      description: values.description.trim(),
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      promo_code: values.promo_code.trim().toUpperCase(),
      min_booking_amount: Number(values.min_booking_amount) || 0,
      usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
      per_customer_limit: values.per_customer_limit ? Number(values.per_customer_limit) : null,
      start_date: values.start_date,
      start_time: values.start_time || "00:00",
      end_date: values.end_date,
      end_time: values.end_time || "23:59",
      status: values.status,
      sort_order: Number(values.sort_order) || 0,
    };

    try {
      if (editing) {
        await updateOffer({ offerId: editing.id, body }).unwrap();
        toast.success("Offer updated.");
      } else {
        await createOffer(body).unwrap();
        toast.success("Offer created.");
      }
      onSaved();
    } catch (err) {
      toast.error(extractApiError(err, "Could not save offer."));
    }
  });

  const busy = creating || updating;

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">
        {editing ? "Edit offer" : "New cinema offer"}
      </h3>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Apply to {reqStar}
            </label>
            <select
              {...register("apply_to")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="THIS_MOVIE">One movie</option>
              <option value="SELECTED_MOVIES">Selected movies</option>
              <option value="ALL_MY_MOVIES">All movies I screen</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Status {reqStar}
            </label>
            <select
              {...register("status")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </div>
        </div>

        {applyTo === "THIS_MOVIE" && (
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Movie {reqStar}
            </label>
            <select
              {...register("movieId")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">Select movie</option>
              {eligibleMovies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            {errors.movie_ids && <p className={fieldErrorClass}>{errors.movie_ids.message}</p>}
          </div>
        )}

        {applyTo === "SELECTED_MOVIES" && (
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Movies {reqStar}
            </label>
            <Controller
              name="movie_ids"
              control={control}
              render={({ field }) => (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                  {eligibleMovies.map((m) => {
                    const checked = field.value?.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(field.value || []), m.id]
                              : (field.value || []).filter((id) => id !== m.id);
                            field.onChange(next);
                          }}
                        />
                        {m.title}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.movie_ids && <p className={fieldErrorClass}>{errors.movie_ids.message}</p>}
            {movieIds.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">{movieIds.length} selected</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Offer name {reqStar}
            </label>
            <input
              {...register("title")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
            {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Promo code {reqStar}
            </label>
            <input
              {...register("promo_code")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white font-mono uppercase"
            />
            {errors.promo_code && <p className={fieldErrorClass}>{errors.promo_code.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Description</label>
          <textarea
            {...register("description")}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Discount type {reqStar}
            </label>
            <select
              {...register("discount_type")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="PERCENT">Percent</option>
              <option value="FLAT">Flat (ETB)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Value {reqStar}
            </label>
            <input
              {...register("discount_value")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
            {errors.discount_value && (
              <p className={fieldErrorClass}>{errors.discount_value.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Min. booking</label>
            <input
              {...register("min_booking_amount")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Start date {reqStar}
            </label>
            <input
              type="date"
              {...register("start_date")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
            {errors.start_date && <p className={fieldErrorClass}>{errors.start_date.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Start time</label>
            <input
              type="time"
              {...register("start_time")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              End date {reqStar}
            </label>
            <input
              type="date"
              {...register("end_date")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
            {errors.end_date && <p className={fieldErrorClass}>{errors.end_date.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">End time</label>
            <input
              type="time"
              {...register("end_time")}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {editing ? "Save changes" : "Create offer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MovieAdminOffersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data: offersData, isLoading } = useGetCinemaOffersQuery({
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const offers = offersData?.items ?? [];
  const { data: eligibleMovies = [] } = useGetCinemaOfferEligibleMoviesQuery();
  const [deleteOffer] = useDeleteCinemaOfferMutation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CinemaOffer | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<CinemaOfferFormValues>(
    emptyCinemaOfferFormValues()
  );

  const openCreate = () => {
    setEditing(null);
    setInitialValues(emptyCinemaOfferFormValues(eligibleMovies[0]?.id || ""));
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const openEdit = (offer: CinemaOffer) => {
    setEditing(offer);
    const applyTo = offer.apply_to || "THIS_MOVIE";
    const movieIds = offer.movie_ids?.length
      ? offer.movie_ids
      : offer.movie_id
        ? [offer.movie_id]
        : [];
    setInitialValues({
      apply_to: applyTo,
      movieId: offer.movie_id || movieIds[0] || "",
      movie_ids: movieIds,
      title: offer.title,
      description: offer.description || "",
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value),
      promo_code: offer.promo_code || "",
      min_booking_amount: String(offer.min_booking_amount ?? 0),
      usage_limit: offer.usage_limit != null ? String(offer.usage_limit) : "",
      per_customer_limit:
        offer.per_customer_limit != null ? String(offer.per_customer_limit) : "",
      start_date: offer.valid_from?.slice(0, 10) || "",
      start_time: offer.valid_from?.slice(11, 16) || "",
      end_date: offer.valid_until?.slice(0, 10) || "",
      end_time: offer.valid_until?.slice(11, 16) || "",
      status: offer.status === "ACTIVE" || offer.is_active ? "ACTIVE" : "DRAFT",
      sort_order: String(offer.sort_order ?? 0),
    });
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag size={20} className="text-fuchsia-400" />
            Movie Offers
          </h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Create promo codes for movies you screen. Super Admin{" "}
            <strong className="text-zinc-300">Platform Offers</strong> stay separate and still apply
            at checkout with higher priority.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search offer or movie"
          />
          <button
            type="button"
            onClick={openCreate}
            disabled={eligibleMovies.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-semibold hover:bg-fuchsia-500 disabled:opacity-50 cursor-pointer"
          >
            <Plus size={16} /> New offer
          </button>
        </div>
      </div>

      {eligibleMovies.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No eligible movies. Add showtimes for a movie first, then create offers.
        </div>
      )}

      {showForm && (
        <OfferFormPanel
          key={formKey}
          editing={editing}
          eligibleMovies={eligibleMovies}
          initialValues={initialValues}
          onCancel={closeForm}
          onSaved={closeForm}
        />
      )}

      <div className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="animate-spin" size={22} />
            Loading offers…
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 mb-4">
              <Tag size={26} />
            </div>
            <h3 className="text-lg font-bold portal-heading">No cinema offers yet</h3>
            <p className="text-sm portal-muted mt-2 max-w-md mx-auto">
              Create a promo for movies you screen. Customers use the code at checkout for your
              cinema.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 shadow-sm flex flex-wrap justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{o.title}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {formatOfferDiscount(o.discount_type, o.discount_value)}
                    {o.promo_code ? ` · Code: ${o.promo_code}` : ""}
                    {` · ${applyLabel(o.apply_to)}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {o.apply_to === "ALL_MY_MOVIES"
                      ? "All movies you screen"
                      : o.movie_title || "Movie"}
                    {" · "}
                    {(o.status || (o.is_active ? "ACTIVE" : "DRAFT")).replace("_", " ")}
                    {o.valid_from
                      ? ` · ${String(o.valid_from).slice(0, 10)} → ${String(o.valid_until || "—").slice(0, 10)}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(o)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(o.id)}
                    className="p-2 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {(offersData?.meta?.total || 0) > 0 && (
              <Pagination meta={offersData!.meta} onPageChange={setPage} />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete offer?"
        body="This cinema offer will be removed. Platform offers are not affected."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          setConfirmBusy(true);
          try {
            await deleteOffer(pendingDeleteId).unwrap();
            toast.success("Offer deleted.");
            setPendingDeleteId(null);
          } catch (err) {
            toast.error(extractApiError(err, "Could not delete offer."));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

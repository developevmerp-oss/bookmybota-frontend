"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventOfferMutation,
  useDeleteEventOfferMutation,
  useGetOfferEligibleEventsQuery,
  useGetOrganizerOffersQuery,
  useUpdateEventOfferMutation,
  type EventOffer,
  type OfferEligibleEvent,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatOfferDiscount } from "@/lib/currencyFormat";
import {
  buildEventOfferFormSchema,
  emptyEventOfferFormValues,
  type EventOfferFormValues,
} from "@/lib/eventOfferFormSchema";

/** YYYY-MM-DD for the day before a given date string */
function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const reqStar = <span className="text-rose-500">*</span>;

function applyLabel(applyTo?: string) {
  switch (applyTo) {
    case "ALL_MY_EVENTS":
      return "All my events";
    case "SELECTED_EVENTS":
      return "Selected events";
    default:
      return "This event";
  }
}

type OfferFormPanelProps = {
  editing: EventOffer | null;
  eligibleEvents: OfferEligibleEvent[];
  initialValues: EventOfferFormValues;
  onCancel: () => void;
  onSaved: () => void;
};

function OfferFormPanel({
  editing,
  eligibleEvents,
  initialValues,
  onCancel,
  onSaved,
}: OfferFormPanelProps) {
  const [createOffer, { isLoading: creating }] = useCreateEventOfferMutation();
  const [updateOffer, { isLoading: updating }] = useUpdateEventOfferMutation();
  const saving = creating || updating;

  const startDateByEventId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of eligibleEvents) {
      if (ev.starts_on) map.set(ev.id, ev.starts_on);
    }
    return map;
  }, [eligibleEvents]);

  const resolver = useMemo(
    () =>
      async (
        values: EventOfferFormValues,
        context: unknown,
        options: Parameters<ReturnType<typeof yupResolver>>[2]
      ) => {
        const ids =
          values.apply_to === "ALL_MY_EVENTS"
            ? eligibleEvents.map((e) => e.id)
            : values.apply_to === "THIS_EVENT"
              ? values.eventId
                ? [values.eventId]
                : []
              : values.event_ids;
        let earliest = "";
        for (const id of ids) {
          const starts = startDateByEventId.get(id);
          if (starts && (!earliest || starts < earliest)) earliest = starts;
        }
        return yupResolver(buildEventOfferFormSchema(earliest))(
          values,
          context,
          options as never
        );
      },
    [eligibleEvents, startDateByEventId]
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<EventOfferFormValues>({
    resolver: resolver as never,
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const applyTo = watch("apply_to");
  const eventId = watch("eventId");
  const eventIds = watch("event_ids");
  const startDate = watch("start_date");
  const endDate = watch("end_date");

  const boundEventIds = useMemo(() => {
    if (applyTo === "ALL_MY_EVENTS") return eligibleEvents.map((e) => e.id);
    if (applyTo === "THIS_EVENT") return eventId ? [eventId] : [];
    return eventIds || [];
  }, [applyTo, eligibleEvents, eventId, eventIds]);

  const earliestEventStart = useMemo(() => {
    let earliest = "";
    for (const id of boundEventIds) {
      const starts = startDateByEventId.get(id);
      if (starts && (!earliest || starts < earliest)) earliest = starts;
    }
    return earliest;
  }, [boundEventIds, startDateByEventId]);

  const lastOfferDate = earliestEventStart ? dayBefore(earliestEventStart) : "";

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const discount_value = Number(values.discount_value);
    const primaryEventId =
      values.apply_to === "THIS_EVENT"
        ? values.eventId
        : values.apply_to === "SELECTED_EVENTS"
          ? values.event_ids[0]
          : values.eventId || eligibleEvents[0]?.id || "";

    if (!primaryEventId) {
      toast.error("Select an event.");
      return;
    }

    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      discount_type: values.discount_type,
      discount_value,
      promo_code: values.promo_code.trim().toUpperCase(),
      min_booking_amount: Number(values.min_booking_amount) || 0,
      apply_to: values.apply_to,
      event_ids:
        values.apply_to === "THIS_EVENT"
          ? [values.eventId]
          : values.apply_to === "SELECTED_EVENTS"
            ? values.event_ids
            : [],
      usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
      per_customer_limit: values.per_customer_limit
        ? Number(values.per_customer_limit)
        : null,
      start_date: values.start_date,
      start_time: values.start_time || undefined,
      end_date: values.end_date,
      end_time: values.end_time || undefined,
      status: values.status,
      is_active: values.status === "ACTIVE",
      sort_order: Number(values.sort_order) || 0,
    };

    try {
      if (editing) {
        await updateOffer({ offerId: editing.id, ...payload }).unwrap();
        toast.success("Offer updated.");
      } else {
        await createOffer({ eventId: primaryEventId, ...payload }).unwrap();
        toast.success("Offer created.");
      }
      onSaved();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save offer"));
    }
  });

  return (
    <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-5 space-y-5" noValidate>
      <h3 className="portal-heading font-semibold text-lg">
        {editing ? "Edit offer" : "Create offer"}
      </h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Offer name {reqStar}
          </label>
          <input className="input-field" placeholder="Early bird 20% off" {...register("title")} />
          {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Offer code {reqStar}
          </label>
          <input
            className="input-field uppercase"
            placeholder="SAVE20"
            {...register("promo_code", {
              onChange: (e) =>
                setValue("promo_code", String(e.target.value || "").toUpperCase(), {
                  shouldDirty: true,
                }),
            })}
          />
          {errors.promo_code && <p className={fieldErrorClass}>{errors.promo_code.message}</p>}
        </div>
      </div>

      <div>
        <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Description</label>
        <textarea className="input-field resize-none" rows={2} {...register("description")} />
        {errors.description && <p className={fieldErrorClass}>{errors.description.message}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Discount type {reqStar}
          </label>
          <select className="portal-select" {...register("discount_type")}>
            <option value="PERCENT">Percentage</option>
            <option value="FLAT">Flat amount</option>
          </select>
          {errors.discount_type && <p className={fieldErrorClass}>{errors.discount_type.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Discount value {reqStar}
          </label>
          <input type="number" min={1} step="any" className="input-field" {...register("discount_value")} />
          {errors.discount_value && (
            <p className={fieldErrorClass}>{errors.discount_value.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
          Minimum booking amount
        </label>
        <input
          type="number"
          min={0}
          step="any"
          className="input-field sm:max-w-xs"
          {...register("min_booking_amount")}
        />
        {errors.min_booking_amount && (
          <p className={fieldErrorClass}>{errors.min_booking_amount.message}</p>
        )}
      </div>

      <div>
        <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
          Apply to <span className="text-rose-500">*</span>
        </label>
        <select
          className="portal-select"
          {...register("apply_to", {
            onChange: (e) => {
              const next = e.target.value;
              if (next === "THIS_EVENT" && eventId) {
                setValue("event_ids", [eventId]);
              }
            },
          })}
        >
          <option value="THIS_EVENT">This event</option>
          <option value="SELECTED_EVENTS">Selected events</option>
          <option value="ALL_MY_EVENTS">All my events</option>
        </select>
        {errors.apply_to && <p className={fieldErrorClass}>{errors.apply_to.message}</p>}
      </div>

      {applyTo === "THIS_EVENT" && (
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Select event <span className="text-rose-500">*</span>
          </label>
          <select
            className="portal-select"
            {...register("eventId", {
              onChange: (e) => {
                const id = e.target.value;
                setValue("event_ids", id ? [id] : []);
                setValue("start_date", "");
                setValue("end_date", "");
              },
            })}
          >
            <option value="">Choose an event…</option>
            {eligibleEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status.replace("_", " ")})
              </option>
            ))}
          </select>
          {errors.eventId && <p className={fieldErrorClass}>{errors.eventId.message}</p>}
          {errors.event_ids && <p className={fieldErrorClass}>{errors.event_ids.message}</p>}
        </div>
      )}

      {applyTo === "SELECTED_EVENTS" && (
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Select event(s) <span className="text-rose-500">*</span>
          </label>
          <Controller
            name="event_ids"
            control={control}
            render={({ field }) => (
              <div className="rounded-xl border border-slate-200 divide-y max-h-48 overflow-y-auto">
                {eligibleEvents.map((ev) => {
                  const checked = field.value?.includes(ev.id);
                  return (
                    <label
                      key={ev.id}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...(field.value || []), ev.id]
                            : (field.value || []).filter((id) => id !== ev.id);
                          field.onChange(next);
                          if (next[0]) setValue("eventId", next[0]);
                        }}
                      />
                      <span>
                        {ev.name}{" "}
                        <span className="text-xs text-slate-400">
                          ({ev.status.replace("_", " ")})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          />
          {errors.event_ids && <p className={fieldErrorClass}>{errors.event_ids.message}</p>}
        </div>
      )}

      {applyTo === "ALL_MY_EVENTS" && (
        <p className="text-xs portal-muted">
          This offer applies to all of your Live and Pending Approval events.
        </p>
      )}

      {earliestEventStart && (
        <p className="text-xs portal-muted">
          Offers must end before the earliest event date{" "}
          <strong>{earliestEventStart}</strong>
          {lastOfferDate ? ` (latest end date: ${lastOfferDate})` : ""}.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Total usage limit
          </label>
          <input
            type="number"
            min={1}
            className="input-field"
            placeholder="Unlimited"
            {...register("usage_limit")}
          />
          {errors.usage_limit && <p className={fieldErrorClass}>{errors.usage_limit.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Per customer limit
          </label>
          <input
            type="number"
            min={1}
            className="input-field"
            placeholder="Unlimited"
            {...register("per_customer_limit")}
          />
          {errors.per_customer_limit && (
            <p className={fieldErrorClass}>{errors.per_customer_limit.message}</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Start date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            className="input-field"
            max={lastOfferDate || endDate || undefined}
            {...register("start_date")}
          />
          {errors.start_date && <p className={fieldErrorClass}>{errors.start_date.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Start time</label>
          <input type="time" className="input-field" {...register("start_time")} />
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            End date {reqStar}
          </label>
          <input
            type="date"
            className="input-field"
            min={startDate || undefined}
            max={lastOfferDate || undefined}
            {...register("end_date")}
          />
          {errors.end_date && <p className={fieldErrorClass}>{errors.end_date.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">End time</label>
          <input type="time" className="input-field" {...register("end_time")} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
            Status <span className="text-rose-500">*</span>
          </label>
          <select className="portal-select" {...register("status")}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Sort order</label>
          <input type="number" min={0} className="input-field" {...register("sort_order")} />
          {errors.sort_order && <p className={fieldErrorClass}>{errors.sort_order.message}</p>}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="inline animate-spin mr-1" />}
          {editing ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function OrganizerOffersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data: offersData, isLoading } = useGetOrganizerOffersQuery({
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const offers = offersData?.items ?? [];
  const { data: eligibleEvents = [] } = useGetOfferEligibleEventsQuery();
  const [deleteOffer] = useDeleteEventOfferMutation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EventOffer | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<EventOfferFormValues>(
    emptyEventOfferFormValues()
  );

  const openCreate = () => {
    setEditing(null);
    setInitialValues(emptyEventOfferFormValues(eligibleEvents[0]?.id || ""));
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const openEdit = (offer: EventOffer) => {
    setEditing(offer);
    const applyTo = offer.apply_to || "THIS_EVENT";
    const eventIds = offer.event_ids?.length
      ? offer.event_ids
      : offer.event_id
        ? [offer.event_id]
        : [];
    setInitialValues({
      apply_to: applyTo,
      eventId: offer.event_id,
      event_ids: eventIds,
      title: offer.title,
      description: offer.description || "",
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value),
      promo_code: offer.promo_code || "",
      min_booking_amount: String(offer.min_booking_amount ?? 0),
      usage_limit: offer.usage_limit != null ? String(offer.usage_limit) : "",
      per_customer_limit:
        offer.per_customer_limit != null ? String(offer.per_customer_limit) : "",
      start_date: offer.start_date || offer.valid_from?.slice(0, 10) || "",
      start_time: offer.start_time || "",
      end_date: offer.end_date || offer.valid_until?.slice(0, 10) || "",
      end_time: offer.end_time || "",
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

  const discountLabel = (o: EventOffer) => formatOfferDiscount(o.discount_type, o.discount_value);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
            <Tag className="text-violet-500" /> Event Offers
          </h2>
          <p className="portal-muted text-sm mt-1">
            Create promo offers for <strong>Live</strong> or <strong>Pending Approval</strong>{" "}
            events. Closed events cannot receive new offers.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search offer or event"
          />
          <button
            type="button"
            onClick={openCreate}
            disabled={eligibleEvents.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
          >
            <Plus size={16} /> New offer
          </button>
        </div>
      </div>

      {eligibleEvents.length === 0 && (
        <div className="portal-banner-warning rounded-xl px-4 py-3 text-sm">
          No eligible events. Offers can be added when an event is Live or Pending Approval.
        </div>
      )}

      {showForm && (
        <OfferFormPanel
          key={formKey}
          editing={editing}
          eligibleEvents={eligibleEvents}
          initialValues={initialValues}
          onCancel={closeForm}
          onSaved={closeForm}
        />
      )}

      {isLoading ? (
        <p className="portal-muted text-center py-10">Loading offers...</p>
      ) : offers.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
          No offers yet. Create one for a live or pending event.
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <div key={o.id} className="glass-panel rounded-2xl p-4 flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-semibold portal-heading">{o.title}</p>
                <p className="text-sm portal-muted">
                  {discountLabel(o)}
                  {o.promo_code ? ` · Code: ${o.promo_code}` : ""}
                  {` · ${applyLabel(o.apply_to)}`}
                </p>
                <p className="text-xs portal-muted mt-1">
                  {o.apply_to === "ALL_MY_EVENTS"
                    ? "All eligible events"
                    : o.event_name || "Event"}
                  {" · "}
                  {(o.status || (o.is_active ? "ACTIVE" : "DRAFT")).replace("_", " ")}
                  {o.start_date || o.valid_from
                    ? ` · ${o.start_date || o.valid_from?.slice(0, 10)} → ${o.end_date || o.valid_until?.slice(0, 10) || "—"}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(o)}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(o.id)}
                  className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {offersData?.meta && <Pagination meta={offersData.meta} onPageChange={setPage} />}
      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete offer?"
        body="Delete this offer?"
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          setConfirmBusy(true);
          try {
            await deleteOffer(pendingDeleteId).unwrap();
            toast.success("Offer deleted.");
            setPendingDeleteId(null);
          } catch (err) {
            toast.error(extractApiError(err, "Failed to delete"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}

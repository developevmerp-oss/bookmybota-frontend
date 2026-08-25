"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
        const eventStartDate = startDateByEventId.get(values.eventId) || "";
        return yupResolver(buildEventOfferFormSchema(eventStartDate))(
          values,
          context,
          options as never
        );
      },
    [startDateByEventId]
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EventOfferFormValues>({
    resolver: resolver as never,
    defaultValues: initialValues,
    mode: "onBlur",
  });

  const eventId = watch("eventId");
  const validFrom = watch("valid_from");
  const validUntil = watch("valid_until");

  const selectedEvent = useMemo(
    () => eligibleEvents.find((ev) => ev.id === eventId),
    [eligibleEvents, eventId]
  );
  const eventStartDate = selectedEvent?.starts_on || "";
  const lastOfferDate = eventStartDate ? dayBefore(eventStartDate) : "";

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const discount_value = Number(values.discount_value);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      discount_type: values.discount_type,
      discount_value,
      promo_code: values.promo_code.trim() || undefined,
      valid_from: values.valid_from || undefined,
      valid_until: values.valid_until || undefined,
      is_active: values.is_active,
    };

    try {
      if (editing) {
        await updateOffer({ offerId: editing.id, ...payload }).unwrap();
        toast.success("Offer updated.");
      } else {
        await createOffer({ eventId: values.eventId, ...payload }).unwrap();
        toast.success("Offer created.");
      }
      onSaved();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save offer"));
    }
  });

  return (
    <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-5 space-y-4" noValidate>
      <h3 className="portal-heading font-semibold">{editing ? "Edit offer" : "Create offer"}</h3>

      {!editing && (
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Event</label>
          <select
            className="portal-select"
            {...register("eventId", {
              onChange: () => {
                setValue("valid_from", "");
                setValue("valid_until", "");
              },
            })}
          >
            <option value="">Select event</option>
            {eligibleEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status.replace("_", " ")})
              </option>
            ))}
          </select>
          {errors.eventId && <p className={fieldErrorClass}>{errors.eventId.message}</p>}
          {eventStartDate && (
            <p className="text-xs portal-muted mt-1">
              Offers run before the event. Valid until must be before <strong>{eventStartDate}</strong>
              {lastOfferDate ? ` (latest: ${lastOfferDate})` : ""}.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Title</label>
        <input className="input-field" placeholder="Early bird 20% off" {...register("title")} />
        {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
      </div>

      <div>
        <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Description</label>
        <textarea className="input-field resize-none" rows={2} {...register("description")} />
        {errors.description && <p className={fieldErrorClass}>{errors.description.message}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Discount type</label>
          <select className="portal-select" {...register("discount_type")}>
            <option value="PERCENT">Percent (%)</option>
            <option value="FLAT">Flat amount (ETB)</option>
          </select>
          {errors.discount_type && <p className={fieldErrorClass}>{errors.discount_type.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Value</label>
          <input type="number" min={1} className="input-field" {...register("discount_value")} />
          {errors.discount_value && (
            <p className={fieldErrorClass}>{errors.discount_value.message}</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Promo code</label>
          <input
            className="input-field"
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
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Valid from</label>
          <input
            type="date"
            className="input-field"
            max={lastOfferDate || validUntil || undefined}
            {...register("valid_from")}
          />
          <p className="text-[10px] portal-muted mt-1">When the offer starts (optional)</p>
          {errors.valid_from && <p className={fieldErrorClass}>{errors.valid_from.message}</p>}
        </div>
        <div>
          <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Valid until</label>
          <input
            type="date"
            className="input-field"
            min={validFrom || undefined}
            max={lastOfferDate || undefined}
            {...register("valid_until")}
          />
          <p className="text-[10px] portal-muted mt-1">Must be before event day</p>
          {errors.valid_until && <p className={fieldErrorClass}>{errors.valid_until.message}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm portal-muted">
        <input type="checkbox" {...register("is_active")} />
        Active offer
      </label>

      <div className="flex gap-2">
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
    setInitialValues({
      eventId: offer.event_id,
      title: offer.title,
      description: offer.description || "",
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value),
      promo_code: offer.promo_code || "",
      valid_from: offer.valid_from?.slice(0, 10) || "",
      valid_until: offer.valid_until?.slice(0, 10) || "",
      is_active: offer.is_active,
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
            Add offers only on <strong>Live</strong> or <strong>Pending Approval</strong> events.
            Closed or rejected events cannot have offers.
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
                  {o.event_name} · {discountLabel(o)}
                  {o.promo_code ? ` · Code: ${o.promo_code}` : ""}
                </p>
                <p className="text-xs portal-muted mt-1">
                  Status: {o.event_status?.replace("_", " ")} · {o.is_active ? "Active" : "Inactive"}
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

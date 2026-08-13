"use client";

import { useMemo, useState } from "react";
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
import { formatMoney, formatOfferDiscount } from "@/lib/currencyFormat";

/** YYYY-MM-DD for the day before a given date string */
function dayBefore(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EMPTY_FORM = {
  eventId: "",
  title: "",
  description: "",
  discount_type: "PERCENT" as "PERCENT" | "FLAT",
  discount_value: "",
  promo_code: "",
  valid_from: "",
  valid_until: "",
  is_active: true,
};

export default function OrganizerOffersPage() {
  const { data: offers = [], isLoading } = useGetOrganizerOffersQuery();
  const { data: eligibleEvents = [] } = useGetOfferEligibleEventsQuery();
  const [createOffer, { isLoading: creating }] = useCreateEventOfferMutation();
  const [updateOffer, { isLoading: updating }] = useUpdateEventOfferMutation();
  const [deleteOffer] = useDeleteEventOfferMutation();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EventOffer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const selectedEvent = useMemo<OfferEligibleEvent | undefined>(
    () => eligibleEvents.find((ev) => ev.id === form.eventId),
    [eligibleEvents, form.eventId]
  );
  const eventStartDate = selectedEvent?.starts_on || "";
  /** Latest allowed date for offer validity — must be before event day */
  const lastOfferDate = eventStartDate ? dayBefore(eventStartDate) : "";

  const openCreate = () => {
    setEditing(null);
    const eventId = eligibleEvents[0]?.id || "";
    setForm({
      ...EMPTY_FORM,
      eventId,
      valid_from: "",
      valid_until: "",
    });
    setShowForm(true);
  };

  const openEdit = (offer: EventOffer) => {
    setEditing(offer);
    setForm({
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
    setShowForm(true);
  };

  const handleEventChange = (eventId: string) => {
    setForm((f) => ({
      ...f,
      eventId,
      valid_from: "",
      valid_until: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const discount_value = Number(form.discount_value);
    if (!form.title.trim() || !form.eventId || !discount_value) {
      toast.error("Event, title and discount are required.");
      return;
    }
    if (form.valid_from && form.valid_until && form.valid_from > form.valid_until) {
      toast.error("Valid until must be on or after valid from.");
      return;
    }
    if (!form.valid_until) {
      toast.error("Valid until date is required.");
      return;
    }
    if (eventStartDate && form.valid_until >= eventStartDate) {
      toast.error(`Valid until must be before the event date (${eventStartDate}).`);
      return;
    }
    if (eventStartDate && form.valid_from && form.valid_from >= eventStartDate) {
      toast.error(`Valid from must be before the event date (${eventStartDate}).`);
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      discount_type: form.discount_type,
      discount_value,
      promo_code: form.promo_code.trim() || undefined,
      valid_from: form.valid_from || undefined,
      valid_until: form.valid_until || undefined,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await updateOffer({ offerId: editing.id, ...payload }).unwrap();
        toast.success("Offer updated.");
      } else {
        await createOffer({ eventId: form.eventId, ...payload }).unwrap();
        toast.success("Offer created.");
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save offer"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    try {
      await deleteOffer(id).unwrap();
      toast.success("Offer deleted.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete"));
    }
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
        <button
          type="button"
          onClick={openCreate}
          disabled={eligibleEvents.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
        >
          <Plus size={16} /> New offer
        </button>
      </div>

      {eligibleEvents.length === 0 && (
        <div className="portal-banner-warning rounded-xl px-4 py-3 text-sm">
          No eligible events. Offers can be added when an event is Live or Pending Approval.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-5 space-y-4">
          <h3 className="portal-heading font-semibold">
            {editing ? "Edit offer" : "Create offer"}
          </h3>
          {!editing && (
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Event</label>
              <select
                value={form.eventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="portal-select"
                required
              >
                <option value="">Select event</option>
                {eligibleEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.status.replace("_", " ")})
                  </option>
                ))}
              </select>
              {eventStartDate && (
                <p className="text-xs portal-muted mt-1">
                  Offers run before the event. Valid until must be before{" "}
                  <strong>{eventStartDate}</strong>
                  {lastOfferDate ? ` (latest: ${lastOfferDate})` : ""}.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="Early bird 20% off"
              required
            />
          </div>
          <div>
            <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field resize-none"
              rows={2}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Discount type</label>
              <select
                value={form.discount_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    discount_type: e.target.value as "PERCENT" | "FLAT",
                  }))
                }
                className="portal-select"
              >
                <option value="PERCENT">Percent (%)</option>
                <option value="FLAT">Flat amount (ETB)</option>
              </select>
            </div>
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Value</label>
              <input
                type="number"
                min={1}
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                className="input-field"
                required
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Promo code</label>
              <input
                value={form.promo_code}
                onChange={(e) => setForm((f) => ({ ...f, promo_code: e.target.value.toUpperCase() }))}
                className="input-field"
                placeholder="SAVE20"
              />
            </div>
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Valid from</label>
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                className="input-field"
                max={lastOfferDate || form.valid_until || undefined}
              />
              <p className="text-[10px] portal-muted mt-1">When the offer starts (optional)</p>
            </div>
            <div>
              <label className="portal-label text-xs font-bold uppercase mb-1.5 block">Valid until</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                className="input-field"
                min={form.valid_from || undefined}
                max={lastOfferDate || undefined}
                required
              />
              <p className="text-[10px] portal-muted mt-1">Must be before event day</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm portal-muted">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active offer
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || updating}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {(creating || updating) && <Loader2 size={14} className="inline animate-spin mr-1" />}
              {editing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
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
                  Status: {o.event_status?.replace("_", " ")} ·{" "}
                  {o.is_active ? "Active" : "Inactive"}
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
                  onClick={() => handleDelete(o.id)}
                  className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

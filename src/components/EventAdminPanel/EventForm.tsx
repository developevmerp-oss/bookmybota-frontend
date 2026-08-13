"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ImagePlus, Plus, Trash2, Upload, FileText, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessTypesQuery,
  useGetEventMastersQuery,
  useUploadImageMutation,
  type EventDocumentUpload,
  type EventFormPayload,
  type OrganizerEvent,
} from "@/services/api";
import { AGE_GROUP_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/eventValidation";
import {
  eventDraftSchema,
  eventSubmitSchema,
  validateRequiredDocuments,
  type EventFormValues,
  defaultEventFormValues,
} from "@/lib/eventFormSchema";
import {
  formatDateTime12h,
  fromDatetimeLocal,
  toDatetimeLocal,
  validateShowtimeEnd,
  showtimeEndErrorMessage,
} from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";

function normalizeFormDocuments(docs?: EventDocumentUpload[] | string[]): EventDocumentUpload[] {
  if (!docs?.length) return [];
  if (typeof docs[0] === "string") {
    return (docs as string[]).map((url, i) => ({ document_type_id: -(i + 1), url }));
  }
  return docs as EventDocumentUpload[];
}

function eventToValues(event?: OrganizerEvent | null): EventFormValues {
  if (!event) return defaultEventFormValues();
  return {
    name: event.name || "",
    category_type_id: event.category_type_id ?? null,
    genres: event.genres || [],
    poster_horizontal_url: event.poster_horizontal_url || "",
    poster_vertical_url: event.poster_vertical_url || "",
    language: event.language || "",
    about_event: event.about_event || "",
    age_group: event.age_group || "",
    duration_minutes: event.duration_minutes ?? null,
    ticket_types:
      event.ticket_types?.map((t) => ({
        ticket_type: t.ticket_type,
        total_count: Number(t.total_count),
        price: Number(t.price),
      })) || [{ ticket_type: "", total_count: 100, price: 0 }],
    showtimes:
      event.showtimes?.map((s) => ({
        venue_name: s.venue_name || "",
        venue_address: s.venue_address || "",
        starts_at: toDatetimeLocal(s.starts_at),
        ends_at: toDatetimeLocal(s.ends_at),
      })) || [{ venue_name: "", venue_address: "", starts_at: "", ends_at: "" }],
  };
}

interface EventFormProps {
  event?: OrganizerEvent | null;
  readOnly?: boolean;
  canSubmit?: boolean;
  onSaveDraft: (payload: EventFormPayload) => Promise<void>;
  onSubmitForApproval: (payload: EventFormPayload) => Promise<void>;
  saving?: boolean;
  submitting?: boolean;
}

export default function EventForm({
  event,
  readOnly = false,
  canSubmit = !event || event.status === "DRAFT",
  onSaveDraft,
  onSubmitForApproval,
  saving = false,
  submitting = false,
}: EventFormProps) {
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const [documents, setDocuments] = useState<EventDocumentUpload[]>(() =>
    normalizeFormDocuments(event?.documents)
  );

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm<EventFormValues>({
    defaultValues: eventToValues(event),
    resolver: yupResolver(eventDraftSchema),
    mode: "onBlur",
  });

  const categoryTypeId = watch("category_type_id");
  const genres = watch("genres") || [];
  const posterHorizontal = watch("poster_horizontal_url");
  const posterVertical = watch("poster_vertical_url");
  const showtimes = watch("showtimes") || [];

  const { data: masters, isLoading: mastersLoading } = useGetEventMastersQuery(categoryTypeId!, {
    skip: !categoryTypeId,
  });

  const {
    fields: ticketFields,
    append: appendTicket,
    remove: removeTicket,
  } = useFieldArray({ control, name: "ticket_types" });

  const {
    fields: showtimeFields,
    append: appendShowtime,
    remove: removeShowtime,
  } = useFieldArray({ control, name: "showtimes" });

  useEffect(() => {
    if (event) {
      reset(eventToValues(event));
      setDocuments(normalizeFormDocuments(event.documents));
    }
  }, [event?.id, event?.updated_at, reset, event]);

  useEffect(() => {
    if (!masters?.genres?.length) return;
    const allowed = new Set(masters.genres.map((g) => g.name));
    const current = getValues("genres") || [];
    const filtered = current.filter((g) => allowed.has(g));
    if (filtered.length !== current.length) {
      setValue("genres", filtered);
    }
  }, [categoryTypeId, masters?.genres, getValues, setValue]);

  const buildPayload = (values: EventFormValues): EventFormPayload => ({
    name: values.name.trim(),
    category_type_id: values.category_type_id,
    genres: values.genres || [],
    poster_horizontal_url: values.poster_horizontal_url || "",
    poster_vertical_url: values.poster_vertical_url || "",
    documents: documents.filter((d) => d.document_type_id > 0 && d.url?.trim()),
    language: values.language || "",
    about_event: values.about_event.trim(),
    age_group: values.age_group || "",
    duration_minutes: values.duration_minutes,
    ticket_types: (values.ticket_types || []).map((t) => ({
      ticket_type: t.ticket_type.trim(),
      total_count: Number(t.total_count),
      price: Number(t.price),
    })),
    showtimes: (values.showtimes || []).map((s) => ({
      venue_name: s.venue_name.trim(),
      venue_address: s.venue_address?.trim() || "",
      starts_at: fromDatetimeLocal(s.starts_at),
      ends_at: s.ends_at ? fromDatetimeLocal(s.ends_at) : "",
    })),
  });

  const validateMasters = (forSubmit: boolean) => {
    if (!forSubmit || !masters) return null;
    if (masters.genres.length > 0 && (!genres || genres.length === 0)) {
      return "Select at least one genre for this category.";
    }
    const requiredDocs = masters.documents.filter((d) => d.is_required);
    return validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0),
      requiredDocs.map((d) => d.id),
      Object.fromEntries(requiredDocs.map((d) => [d.id, d.name]))
    );
  };

  const runSaveDraft = handleSubmit(async (values) => {
    const payload = buildPayload(values);
    try {
      await onSaveDraft(payload);
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save draft"));
    }
  });

  const runSubmit = async (values: EventFormValues) => {
    try {
      await eventSubmitSchema.validate(values, { abortEarly: true });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Validation failed";
      toast.error(msg);
      return;
    }
    const masterErr = validateMasters(true);
    if (masterErr) {
      toast.error(masterErr);
      return;
    }
    const payload = buildPayload(values);
    try {
      await onSubmitForApproval(payload);
    } catch (e) {
      toast.error(extractApiError(e, "Failed to submit event"));
    }
  };

  const handlePosterUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "poster_horizontal_url" | "poster_vertical_url"
  ) => {
    if (!e.target.files?.length || readOnly) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) setValue(field, res.url, { shouldDirty: true });
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
    e.target.value = "";
  };

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    documentTypeId: number
  ) => {
    if (!e.target.files?.length || readOnly) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) {
        setDocuments((prev) => [
          ...prev.filter((d) => d.document_type_id !== documentTypeId),
          { document_type_id: documentTypeId, url: res.url },
        ]);
      }
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
    e.target.value = "";
  };

  const toggleGenre = (name: string) => {
    if (readOnly) return;
    const next = genres.includes(name) ? genres.filter((g) => g !== name) : [...genres, name];
    setValue("genres", next, { shouldDirty: true });
  };

  const onShowtimeEndChange = (index: number, startsAt: string, endsAt: string) => {
    const result = validateShowtimeEnd(startsAt, endsAt);
    if (result === "same_as_start") {
      toast.warning("End date & time cannot be the same as start. Please pick a later end time.");
    } else if (result === "before_start") {
      toast.warning("End date & time cannot be before the start date & time.");
    }
  };

  const statusBanner = () => {
    if (!event?.status) return null;
    if (event.status === "PENDING_APPROVAL") {
      return (
        <div className="portal-banner-warning rounded-xl border p-4 flex gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="font-medium">
            Submitted for Super Admin review. You can still edit details until it is approved.
          </p>
        </div>
      );
    }
    if (event.rejection_reason) {
      return (
        <div className="portal-banner-error rounded-xl border p-4 flex gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Event was rejected</p>
            <p className="mt-1">{event.rejection_reason}</p>
            <p className="portal-muted mt-2 text-xs">Update the details below and submit again.</p>
          </div>
        </div>
      );
    }
    if (event.status === "APPROVED" || event.status === "LIVE") {
      return (
        <div className="portal-banner-success rounded-xl border p-4 text-sm font-medium">
          This event is {event.status === "LIVE" ? "live" : "approved"}. Details are read-only here.
        </div>
      );
    }
    return null;
  };

  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "text-rose-600 text-xs mt-1";
  const inputClass = "input-field w-full";

  return (
    <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
      {statusBanner()}

      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
        <h3 className="portal-heading text-lg font-semibold">Basic details</h3>

        <div>
          <label className={labelClass}>Event name <span className="text-rose-500">*</span></label>
          <input disabled={readOnly} {...register("name")} placeholder="e.g. Stand-up Comedy Night" className={inputClass} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Category <span className="text-rose-500">*</span></label>
            <select
              disabled={readOnly}
              className={inputClass}
              value={categoryTypeId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setValue("category_type_id", val, { shouldDirty: true });
                setValue("genres", []);
                setDocuments([]);
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_type_id && <p className={errorClass}>{errors.category_type_id.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Duration (minutes) <span className="text-rose-500">*</span></label>
            <input disabled={readOnly} type="number" min={1} className={inputClass} {...register("duration_minutes", { valueAsNumber: true })} />
            {errors.duration_minutes && <p className={errorClass}>{errors.duration_minutes.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Genres {masters?.genres?.length ? <span className="text-rose-500">*</span> : null}
          </label>
          {!categoryTypeId ? (
            <p className="portal-muted text-sm">Select a category to see available genres.</p>
          ) : mastersLoading ? (
            <p className="portal-muted text-sm">Loading genres...</p>
          ) : masters?.genres?.length ? (
            <div className="flex flex-wrap gap-2">
              {masters.genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleGenre(g.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    genres.includes(g.name)
                      ? "bg-violet-500/20 text-violet-700 border-violet-500/40"
                      : "portal-muted border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-amber-700 text-sm">No genres configured. Ask Super Admin to add genres.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Language <span className="text-rose-500">*</span></label>
            <select disabled={readOnly} className={inputClass} {...register("language")}>
              <option value="">Select language</option>
              {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {errors.language && <p className={errorClass}>{errors.language.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Age group <span className="text-rose-500">*</span></label>
            <select disabled={readOnly} className={inputClass} {...register("age_group")}>
              <option value="">Select age group</option>
              {AGE_GROUP_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {errors.age_group && <p className={errorClass}>{errors.age_group.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>About event <span className="text-rose-500">*</span></label>
          <textarea disabled={readOnly} rows={4} className={`${inputClass} resize-y min-h-[100px]`} {...register("about_event")} placeholder="Describe the event..." />
          {errors.about_event && <p className={errorClass}>{errors.about_event.message}</p>}
        </div>
      </section>

      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
        <h3 className="portal-heading text-lg font-semibold">Posters</h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Horizontal poster <span className="text-rose-500">*</span></label>
            {posterHorizontal ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-2">
                <img src={posterHorizontal} alt="Horizontal poster" className="w-full h-36 object-cover" />
                {!readOnly && (
                  <button type="button" onClick={() => setValue("poster_horizontal_url", "")} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-slate-300 hover:border-violet-400 cursor-pointer">
                <ImagePlus className="text-slate-400 mb-2" size={28} />
                <span className="text-xs portal-muted">Upload landscape poster</span>
                <input type="file" accept="image/*" className="hidden" disabled={readOnly || uploading} onChange={(e) => handlePosterUpload(e, "poster_horizontal_url")} />
              </label>
            )}
          </div>
          <div>
            <label className={labelClass}>Vertical poster</label>
            {posterVertical ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 mb-2 max-w-[200px]">
                <img src={posterVertical} alt="Vertical poster" className="w-full h-48 object-cover" />
                {!readOnly && (
                  <button type="button" onClick={() => setValue("poster_vertical_url", "")} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-slate-300 hover:border-violet-400 cursor-pointer max-w-[200px]">
                <ImagePlus className="text-slate-400 mb-2" size={28} />
                <span className="text-xs portal-muted">Upload portrait poster</span>
                <input type="file" accept="image/*" className="hidden" disabled={readOnly || uploading} onChange={(e) => handlePosterUpload(e, "poster_vertical_url")} />
              </label>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <div>
          <h3 className="portal-heading text-lg font-semibold">Event-specific documents</h3>
          <p className="portal-muted text-sm mt-1">Upload documents required by Super Admin for each event.</p>
        </div>
        {!categoryTypeId ? (
          <p className="portal-muted text-sm">Select a category to see the document checklist.</p>
        ) : mastersLoading ? (
          <p className="portal-muted text-sm">Loading document requirements...</p>
        ) : masters?.documents?.length ? (
          <div className="space-y-4">
            {masters.documents.map((doc) => {
              const uploadedUrl = documents.find((d) => d.document_type_id === doc.id)?.url;
              return (
                <div key={doc.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="portal-heading font-semibold">{doc.name}</span>
                      {doc.is_required && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">Required</span>
                      )}
                    </div>
                    {doc.description && <p className="portal-muted text-sm mt-1.5 leading-relaxed">{doc.description}</p>}
                  </div>
                  {uploadedUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200">
                      <FileText size={16} className="text-violet-600 shrink-0" />
                      <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-800 truncate flex-1 hover:text-violet-700">View uploaded file</a>
                      {!readOnly && (
                        <button type="button" onClick={() => setDocuments((p) => p.filter((d) => d.document_type_id !== doc.id))} className="text-slate-400 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    !readOnly && (
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm portal-muted hover:border-violet-400 cursor-pointer">
                        <Upload size={16} /> Upload PDF or image
                        <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={(e) => handleDocumentUpload(e, doc.id)} />
                      </label>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-amber-700 text-sm">No document types configured yet.</p>
        )}
      </section>

      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="portal-heading text-lg font-semibold">Ticket types <span className="text-rose-500 text-sm">*</span></h3>
          {!readOnly && (
            <button type="button" onClick={() => appendTicket({ ticket_type: "", total_count: 100, price: 0 })} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
              <Plus size={14} /> Add type
            </button>
          )}
        </div>
        {ticketFields.map((field, i) => (
          <div key={field.id} className="grid sm:grid-cols-4 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className={labelClass}>Type name</label>
              <input disabled={readOnly} className={inputClass} {...register(`ticket_types.${i}.ticket_type`)} placeholder="General, VIP..." />
              {errors.ticket_types?.[i]?.ticket_type && <p className={errorClass}>{errors.ticket_types[i]?.ticket_type?.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Total seats</label>
              <input disabled={readOnly} type="number" min={1} className={inputClass} {...register(`ticket_types.${i}.total_count`, { valueAsNumber: true })} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>Price (ETB)</label>
                <input disabled={readOnly} type="number" min={0} step="0.01" className={inputClass} {...register(`ticket_types.${i}.price`, { valueAsNumber: true })} />
              </div>
              {!readOnly && ticketFields.length > 1 && (
                <button type="button" onClick={() => removeTicket(i)} className="p-2.5 text-slate-400 hover:text-rose-600 self-end"><Trash2 size={16} /></button>
              )}
            </div>
          </div>
        ))}
        {errors.ticket_types && typeof errors.ticket_types.message === "string" && (
          <p className={errorClass}>{errors.ticket_types.message}</p>
        )}
      </section>

      <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="portal-heading text-lg font-semibold">Venue & showtimes <span className="text-rose-500 text-sm">*</span></h3>
          {!readOnly && (
            <button type="button" onClick={() => appendShowtime({ venue_name: "", venue_address: "", starts_at: "", ends_at: "" })} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
              <Plus size={14} /> Add showtime
            </button>
          )}
        </div>
        <p className="portal-muted text-xs">Dates shown as MM-DD-YYYY, 12-hour time. End must be after start.</p>
        {showtimeFields.map((field, i) => {
          const startsAt = showtimes[i]?.starts_at || "";
          const endsAt = showtimes[i]?.ends_at || "";
          return (
            <div key={field.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Venue name</label>
                  <input disabled={readOnly} className={inputClass} {...register(`showtimes.${i}.venue_name`)} placeholder="City Auditorium" />
                  {errors.showtimes?.[i]?.venue_name && <p className={errorClass}>{errors.showtimes[i]?.venue_name?.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Venue address</label>
                  <input disabled={readOnly} className={inputClass} {...register(`showtimes.${i}.venue_address`)} placeholder="Full address" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Starts at</label>
                  <input
                    disabled={readOnly}
                    type="datetime-local"
                    className={inputClass}
                    {...register(`showtimes.${i}.starts_at`, {
                      onChange: (e) => {
                        if (endsAt) onShowtimeEndChange(i, e.target.value, endsAt);
                      },
                    })}
                  />
                  {startsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(startsAt)}</p>}
                  {errors.showtimes?.[i]?.starts_at && <p className={errorClass}>{errors.showtimes[i]?.starts_at?.message}</p>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelClass}>Ends at (optional)</label>
                    <input
                      disabled={readOnly}
                      type="datetime-local"
                      min={startsAt || undefined}
                      className={inputClass}
                      {...register(`showtimes.${i}.ends_at`, {
                        onChange: (e) => onShowtimeEndChange(i, startsAt, e.target.value),
                      })}
                    />
                    {endsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(endsAt)}</p>}
                    {errors.showtimes?.[i]?.ends_at && <p className={errorClass}>{errors.showtimes[i]?.ends_at?.message}</p>}
                  </div>
                  {!readOnly && showtimeFields.length > 1 && (
                    <button type="button" onClick={() => removeShowtime(i)} className="p-2.5 text-slate-400 hover:text-rose-600 self-end"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {errors.showtimes && typeof errors.showtimes.message === "string" && (
          <p className={errorClass}>{errors.showtimes.message}</p>
        )}
      </section>

      {!readOnly && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={saving || submitting}
            onClick={runSaveDraft}
            className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          {canSubmit && (
            <button
              type="button"
              disabled={saving || submitting}
              onClick={handleSubmit(runSubmit)}
              className="btn-primary disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for approval"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, useFormContext, FormProvider } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ImagePlus, Plus, Trash2, Upload, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessTypesQuery,
  useGetEventMastersQuery,
  useUploadImageMutation,
  type EventDocumentUpload,
  type EventFormPayload,
  type OrganizerEvent,
} from "@/services/api";
import { AGE_GROUP_OPTIONS, LANGUAGE_OPTIONS, parseEventLanguages } from "@/lib/eventValidation";
import {
  eventDraftSchema,
  eventSubmitSchema,
  validateRequiredDocuments,
  type EventFormValues,
  defaultEventFormValues,
  defaultVenue,
  showtimeToIso,
} from "@/lib/eventFormSchema";
import {
  formatDate,
  formatDateTime12h,
  formatTime12h,
  inferDurationType,
  toDateInput,
  toDatetimeLocal,
  toTimeInput,
} from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import ImageCropPicker, { CroppedImageField } from "@/components/Shared/ImageCropPicker";

function normalizeFormDocuments(docs?: EventDocumentUpload[] | string[]): EventDocumentUpload[] {
  if (!docs?.length) return [];
  if (typeof docs[0] === "string") {
    return (docs as string[]).map((url, i) => ({ document_type_id: -(i + 1), url }));
  }
  return docs as EventDocumentUpload[];
}

function parseEventTerms(raw?: OrganizerEvent["terms_points"]): {
  selected: Array<{ id: number; text: string }>;
  custom: string[];
} {
  const selected: Array<{ id: number; text: string }> = [];
  const custom: string[] = [];
  if (!raw) return { selected, custom };
  for (const item of raw.selected || []) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) custom.push(text);
      continue;
    }
    const id = Number(item.id);
    const text = String(item.text || "").trim();
    if (Number.isFinite(id) && id > 0 && text) selected.push({ id, text });
    else if (text) custom.push(text);
  }
  for (const line of raw.custom || []) {
    const text = String(line || "").trim();
    if (text) custom.push(text);
  }
  return { selected, custom };
}

function ticketsForShow(
  event: OrganizerEvent,
  showId: string,
  showIndex: number
): EventFormValues["showtimes"][number]["ticket_types"] {
  const all = event.ticket_types || [];
  const nested = (event.showtimes?.find((s) => s.id === showId)?.ticket_types || []).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
  }));
  if (nested.length) return nested;
  const scoped = all.filter((t) => t.showtime_id === showId).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
  }));
  if (scoped.length) return scoped;
  const unscoped = all.filter((t) => !t.showtime_id).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
  }));
  if (showIndex === 0 && unscoped.length) return unscoped;
  return [{ ticket_type: "", total_count: 100, price: 0 }];
}

function eventToValues(event?: OrganizerEvent | null): EventFormValues {
  if (!event) return defaultEventFormValues();
  const gallery = Array.isArray(event.gallery_images) ? event.gallery_images : [];
  return {
    name: event.name || "",
    category_type_id: event.category_type_id ?? null,
    genres: event.genres || [],
    poster_horizontal_url: event.poster_horizontal_url || "",
    poster_vertical_url: event.poster_vertical_url || "",
    gallery_images: gallery,
    languages: parseEventLanguages(event.language),
    about_event: event.about_event || "",
    age_group: event.age_group || "",
    duration_minutes: event.duration_minutes ?? null,
    showtimes:
      event.showtimes?.map((s, i) => {
        const durationType =
          s.duration_type || inferDurationType(s.starts_at, s.ends_at || s.starts_at);
        return {
          venue_name: s.venue_name || "",
          venue_address: s.venue_address || "",
          duration_type: durationType,
          event_date: toDateInput(s.starts_at),
          start_time: toTimeInput(s.starts_at),
          end_time: toTimeInput(s.ends_at || s.starts_at),
          starts_at: toDatetimeLocal(s.starts_at),
          ends_at: toDatetimeLocal(s.ends_at),
          ticket_types: ticketsForShow(event, s.id, i),
        };
      }) || [defaultVenue()],
  };
}

function VenueBlock({
  index,
  readOnly,
  canRemove,
  onRemove,
}: {
  index: number;
  readOnly: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const {
    fields: ticketFields,
    append,
    remove,
  } = useFieldArray({ control, name: `showtimes.${index}.ticket_types` });

  const durationType = watch(`showtimes.${index}.duration_type`) || "ONE_DAY";
  const eventDate = watch(`showtimes.${index}.event_date`);
  const startTime = watch(`showtimes.${index}.start_time`);
  const endTime = watch(`showtimes.${index}.end_time`);
  const startsAt = watch(`showtimes.${index}.starts_at`);
  const endsAt = watch(`showtimes.${index}.ends_at`);
  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "text-rose-600 text-xs mt-1";
  const inputClass = "input-field w-full";

  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">Venue {index + 1}</p>
        {!readOnly && canRemove && (
          <button type="button" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Venue name</label>
          <input disabled={readOnly} className={inputClass} {...register(`showtimes.${index}.venue_name`)} placeholder="City Auditorium" />
          {errors.showtimes?.[index]?.venue_name && (
            <p className={errorClass}>{errors.showtimes[index]?.venue_name?.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Venue address</label>
          <input disabled={readOnly} className={inputClass} {...register(`showtimes.${index}.venue_address`)} placeholder="Full address" />
        </div>
      </div>

      <div>
        <p className={labelClass}>Event duration</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              disabled={readOnly}
              checked={durationType === "ONE_DAY"}
              onChange={() => setValue(`showtimes.${index}.duration_type`, "ONE_DAY", { shouldDirty: true })}
            />
            One day event
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              disabled={readOnly}
              checked={durationType === "MULTI_DAY"}
              onChange={() => setValue(`showtimes.${index}.duration_type`, "MULTI_DAY", { shouldDirty: true })}
            />
            Multiple day event
          </label>
        </div>
      </div>

      {durationType === "ONE_DAY" ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Date (mm-dd-yyyy)</label>
            <input disabled={readOnly} type="date" className={inputClass} {...register(`showtimes.${index}.event_date`)} />
            {eventDate && <p className="text-xs text-slate-600 mt-1">{formatDate(eventDate)}</p>}
          </div>
          <div>
            <label className={labelClass}>Start time</label>
            <input disabled={readOnly} type="time" className={inputClass} {...register(`showtimes.${index}.start_time`)} />
            {startTime && eventDate && (
              <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${startTime}`)}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>End time</label>
            <input disabled={readOnly} type="time" className={inputClass} {...register(`showtimes.${index}.end_time`)} />
            {endTime && eventDate && (
              <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${endTime}`)}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start date & time</label>
            <input disabled={readOnly} type="datetime-local" className={inputClass} {...register(`showtimes.${index}.starts_at`)} />
            {startsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(startsAt)}</p>}
          </div>
          <div>
            <label className={labelClass}>End date & time</label>
            <input disabled={readOnly} type="datetime-local" className={inputClass} {...register(`showtimes.${index}.ends_at`)} />
            {endsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(endsAt)}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Ticket types for this venue</p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => append({ ticket_type: "", total_count: 100, price: 0 })}
              className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
            >
              <Plus size={14} /> Add type
            </button>
          )}
        </div>
        {ticketFields.map((field, ti) => (
          <div key={field.id} className="grid sm:grid-cols-4 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className={labelClass}>Type name</label>
              <input
                disabled={readOnly}
                className={inputClass}
                {...register(`showtimes.${index}.ticket_types.${ti}.ticket_type`)}
                placeholder="General, VIP..."
              />
            </div>
            <div>
              <label className={labelClass}>Total seats</label>
              <input
                disabled={readOnly}
                type="number"
                min={1}
                className={inputClass}
                {...register(`showtimes.${index}.ticket_types.${ti}.total_count`, { valueAsNumber: true })}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>Price (ETB)</label>
                <input
                  disabled={readOnly}
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  {...register(`showtimes.${index}.ticket_types.${ti}.price`, { valueAsNumber: true })}
                />
              </div>
              {!readOnly && ticketFields.length > 1 && (
                <button type="button" onClick={() => remove(ti)} className="p-2.5 text-slate-400 hover:text-rose-600 self-end">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const initialTerms = parseEventTerms(event?.terms_points);
  const [selectedTerms, setSelectedTerms] = useState(initialTerms.selected);
  const [customTerms, setCustomTerms] = useState<string[]>(initialTerms.custom);
  const [customTermDraft, setCustomTermDraft] = useState("");

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const methods = useForm<EventFormValues>({
    defaultValues: eventToValues(event),
    resolver: yupResolver(eventDraftSchema),
    mode: "onBlur",
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = methods;

  const categoryTypeId = watch("category_type_id");
  const genres = watch("genres") || [];
  const languages = watch("languages") || [];
  const posterHorizontal = watch("poster_horizontal_url");
  const posterVertical = watch("poster_vertical_url");
  const galleryImages = watch("gallery_images") || [];

  const { data: masters, isLoading: mastersLoading } = useGetEventMastersQuery(categoryTypeId!, {
    skip: !categoryTypeId,
  });

  const {
    fields: showtimeFields,
    append: appendShowtime,
    remove: removeShowtime,
  } = useFieldArray({ control, name: "showtimes" });

  useEffect(() => {
    if (event) {
      reset(eventToValues(event));
      setDocuments(normalizeFormDocuments(event.documents));
      const terms = parseEventTerms(event.terms_points);
      setSelectedTerms(terms.selected);
      setCustomTerms(terms.custom);
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

  const buildPayload = (values: EventFormValues): EventFormPayload => {
    const showtimes = (values.showtimes || []).map((s) => {
      const range = showtimeToIso(s);
      return {
        venue_name: s.venue_name.trim(),
        venue_address: s.venue_address?.trim() || "",
        starts_at: range.starts_at,
        ends_at: range.ends_at,
        duration_type: (s.duration_type === "MULTI_DAY" ? "MULTI_DAY" : "ONE_DAY") as "ONE_DAY" | "MULTI_DAY",
        ticket_types: (s.ticket_types || []).map((t) => ({
          ticket_type: t.ticket_type.trim(),
          total_count: Number(t.total_count),
          price: Number(t.price),
        })),
      };
    });
    const ticket_types = showtimes.flatMap((s) => s.ticket_types);
    return {
      name: values.name.trim(),
      category_type_id: values.category_type_id,
      genres: values.genres || [],
      poster_horizontal_url: values.poster_horizontal_url || "",
      poster_vertical_url: values.poster_vertical_url || "",
      gallery_images: values.gallery_images || [],
      documents: documents.filter((d) => d.document_type_id > 0 && d.url?.trim()),
      languages: values.languages || [],
      language: (values.languages || []).join(", "),
      about_event: values.about_event.trim(),
      age_group: values.age_group || "",
      duration_minutes: values.duration_minutes,
      terms_points: {
        selected: selectedTerms,
        custom: customTerms.map((t) => t.trim()).filter(Boolean),
      },
      ticket_types,
      showtimes,
    };
  };

  const toggleMasterTerm = (term: { id: number; text: string }) => {
    setSelectedTerms((prev) => {
      if (prev.some((t) => t.id === term.id)) return prev.filter((t) => t.id !== term.id);
      return [...prev, { id: term.id, text: term.text }];
    });
  };

  const addCustomTerm = () => {
    const text = customTermDraft.trim();
    if (!text) {
      toast.error("Enter a terms & conditions point");
      return;
    }
    if (customTerms.some((t) => t.toLowerCase() === text.toLowerCase())) {
      toast.error("That point is already added");
      return;
    }
    setCustomTerms((prev) => [...prev, text]);
    setCustomTermDraft("");
  };

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

  const uploadCropped = async (file: File, onUrl: (url: string) => void) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) onUrl(res.url);
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentTypeId: number) => {
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

  const toggleLanguage = (name: string) => {
    if (readOnly) return;
    const next = languages.includes(name) ? languages.filter((l) => l !== name) : [...languages, name];
    setValue("languages", next, { shouldDirty: true });
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
    <FormProvider {...methods}>
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
              <label className={labelClass}>Languages <span className="text-rose-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleLanguage(l)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      languages.includes(l)
                        ? "bg-violet-500/20 text-violet-700 border-violet-500/40"
                        : "portal-muted border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {errors.languages && <p className={errorClass}>{errors.languages.message as string}</p>}
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
          <p className="portal-muted text-xs">Drag a crop box on the photo, then save. You can edit or remove any image later.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Horizontal poster <span className="text-rose-500">*</span></label>
              <CroppedImageField
                value={posterHorizontal}
                aspect={16 / 9}
                disabled={readOnly || uploading}
                previewClassName="w-full h-36 rounded-xl"
                emptyClassName="flex flex-col items-center justify-center h-36 w-full rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onRemove={() => setValue("poster_horizontal_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_horizontal_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add landscape poster</span>
                  </>
                }
              />
            </div>
            <div>
              <label className={labelClass}>Vertical poster</label>
              <CroppedImageField
                value={posterVertical}
                aspect={2 / 3}
                disabled={readOnly || uploading}
                previewClassName="w-[200px] h-48 rounded-xl"
                emptyClassName="flex flex-col items-center justify-center h-36 w-full max-w-[200px] rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onRemove={() => setValue("poster_vertical_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_vertical_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add portrait poster</span>
                  </>
                }
              />
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Gallery</h3>
          <p className="portal-muted text-sm">Photos customers will see on the event details page.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {galleryImages.map((url, i) => (
              <CroppedImageField
                key={`${url}-${i}`}
                value={url}
                aspect={4 / 3}
                disabled={readOnly || uploading}
                previewClassName="h-28 rounded-xl w-full"
                onRemove={() =>
                  setValue(
                    "gallery_images",
                    galleryImages.filter((_, idx) => idx !== i),
                    { shouldDirty: true }
                  )
                }
                onCroppedFile={(file) =>
                  uploadCropped(file, (next) =>
                    setValue(
                      "gallery_images",
                      galleryImages.map((u, idx) => (idx === i ? next : u)),
                      { shouldDirty: true }
                    )
                  )
                }
              />
            ))}
            {!readOnly && (
              <ImageCropPicker
                aspect={4 / 3}
                disabled={uploading}
                className="flex flex-col items-center justify-center h-28 rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onCroppedFile={(file) =>
                  uploadCropped(file, (url) =>
                    setValue("gallery_images", [...galleryImages, url], { shouldDirty: true })
                  )
                }
              >
                <ImagePlus className="text-slate-400 mb-1" size={22} />
                <span className="text-[11px] portal-muted">Add photo</span>
              </ImageCropPicker>
            )}
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
          <div>
            <h3 className="portal-heading text-lg font-semibold">Customer terms &amp; conditions</h3>
            <p className="portal-muted text-sm mt-1">
              Tick Super Admin master points to show on this event. Extra points you add here stay on this event only — they are not saved to the Super Admin master list.
            </p>
          </div>
          {!categoryTypeId ? (
            <p className="portal-muted text-sm">Select a category to load the T&amp;C checklist.</p>
          ) : mastersLoading ? (
            <p className="portal-muted text-sm">Loading terms &amp; conditions...</p>
          ) : (
            <div className="space-y-4">
              {(masters?.terms?.length || selectedTerms.length) ? (
                <div className="space-y-2">
                  {(masters?.terms || []).map((term) => {
                    const checked = selectedTerms.some((t) => t.id === term.id);
                    return (
                      <label
                        key={term.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                          checked ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"
                        } ${readOnly ? "cursor-default" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-slate-300"
                          checked={checked}
                          disabled={readOnly}
                          onChange={() => toggleMasterTerm({ id: term.id, text: term.text })}
                        />
                        <span className="text-sm text-slate-800 leading-relaxed">{term.text}</span>
                      </label>
                    );
                  })}
                  {selectedTerms
                    .filter((t) => !(masters?.terms || []).some((m) => m.id === t.id))
                    .map((term) => (
                      <label
                        key={`kept-${term.id}`}
                        className="flex items-start gap-3 p-3 rounded-xl border border-violet-300 bg-violet-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-slate-300"
                          checked
                          disabled={readOnly}
                          onChange={() => toggleMasterTerm(term)}
                        />
                        <span className="text-sm text-slate-800 leading-relaxed">{term.text}</span>
                      </label>
                    ))}
                </div>
              ) : (
                <p className="portal-muted text-sm">No master T&amp;C points yet. You can still add event-specific points below.</p>
              )}

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700">Event-only T&amp;C points</p>
                {customTerms.length > 0 && (
                  <ul className="space-y-2">
                    {customTerms.map((line, idx) => (
                      <li
                        key={`${line}-${idx}`}
                        className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200"
                      >
                        <span className="flex-1 text-sm text-slate-800 leading-relaxed">{line}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setCustomTerms((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Remove custom T&C"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!readOnly && (
                  <div className="flex gap-2">
                    <input
                      value={customTermDraft}
                      onChange={(e) => setCustomTermDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomTerm();
                        }
                      }}
                      placeholder="Add a point for this event only"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={addCustomTerm}
                      className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 inline-flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="portal-heading text-lg font-semibold">Venues, timings & tickets <span className="text-rose-500 text-sm">*</span></h3>
            {!readOnly && (
              <button type="button" onClick={() => appendShowtime(defaultVenue())} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
                <Plus size={14} /> Add venue
              </button>
            )}
          </div>
          <p className="portal-muted text-xs">
            Each venue has its own ticket types and show times. Dates display as MM-DD-YYYY.
          </p>
          {showtimeFields.map((field, i) => (
            <VenueBlock
              key={field.id}
              index={i}
              readOnly={readOnly}
              canRemove={showtimeFields.length > 1}
              onRemove={() => removeShowtime(i)}
            />
          ))}
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
    </FormProvider>
  );
}

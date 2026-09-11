"use client";
import { use } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  MapPin,
  Radio,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetAdminEventDetailQuery,
  useUpdateAdminEventMutation,
  type EventDocumentUpload,
} from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import { parseEventLanguages } from "@/lib/eventValidation";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  adminEventRejectionSchema,
  type AdminEventRejectionValues,
} from "@/lib/adminFormSchemas";

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    APPROVED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    LIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    DRAFT: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    CLOSED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return map[status] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
}

function parseGenres(genres?: string[] | string | null): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseDocuments(
  docs?: EventDocumentUpload[] | string[] | null
): EventDocumentUpload[] {
  if (!docs?.length) return [];
  if (typeof docs[0] === "string") {
    return (docs as string[]).map((url, i) => ({
      document_type_id: -(i + 1),
      url,
      document_name: `Document ${i + 1}`,
    }));
  }
  return docs as EventDocumentUpload[];
}

function ticketModeLabel(mode: string) {
  const map: Record<string, string> = {
    M_TICKET: "M-Ticket",
    BOX_OFFICE: "Box office",
    PHYSICAL_DELIVERY: "Physical delivery",
  };
  return map[mode] || mode;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="portal-muted shrink-0">{label}</dt>
      <dd className="text-slate-800 text-right">{value ?? "—"}</dd>
    </div>
  );
}

export default function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading } = useGetAdminEventDetailQuery(id);
  const [updateEvent, { isLoading: isUpdating }] = useUpdateAdminEventMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminEventRejectionValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminEventRejectionSchema) as any,
    defaultValues: { rejection_reason: "" },
    mode: "onSubmit",
  });

  const handleAction = async (action: "approve" | "go_live" | "close") => {
    try {
      await updateEvent({ id, action }).unwrap();
      toast.success(
        action === "approve"
          ? "Event approved"
          : action === "go_live"
            ? "Event published and now live"
            : "Event closed"
      );
    } catch (err) {
      toast.error(extractApiError(err, "Update failed"));
    }
  };

  const onReject = async (values: AdminEventRejectionValues) => {
    try {
      await updateEvent({
        id,
        action: "reject",
        rejection_reason: values.rejection_reason.trim(),
      }).unwrap();
      toast.success("Event rejected (back to draft)");
      reset({ rejection_reason: "" });
    } catch (err) {
      toast.error(extractApiError(err, "Update failed"));
    }
  };

  const toggleVisibility = async () => {
    if (!event) return;
    try {
      await updateEvent({
        id,
        is_visible: !event.is_visible,
      }).unwrap();
      toast.success(event.is_visible ? "Hidden from customers" : "Visible to customers");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update visibility"));
    }
  };

  if (isLoading) {
    return <div className="portal-muted p-10 text-center">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="portal-muted mb-4">Event not found.</p>
        <Link href="/admin/events" className="text-rose-600 hover:text-rose-700">
          Back to events
        </Link>
      </div>
    );
  }

  const genres = parseGenres(event.genres);
  const languages = parseEventLanguages(event.language);
  const gallery = (event.gallery_images || []).map((u) => resolveMediaUrl(u)).filter(Boolean);
  const documents = parseDocuments(event.documents);
  const termSelected = (event.terms_points?.selected || [])
    .map((t) => (typeof t === "string" ? t : t.text || ""))
    .map((t) => t.trim())
    .filter(Boolean);
  const termCustom = (event.terms_points?.custom || []).map((t) => String(t).trim()).filter(Boolean);
  const ticketsSold = (event.ticket_types || []).reduce(
    (sum, t) => sum + Math.max(0, Number(t.total_count || 0) - Number(t.available_count || 0)),
    0
  );
  const ticketsTotal = (event.ticket_types || []).reduce(
    (sum, t) => sum + Number(t.total_count || 0),
    0
  );
  const sportMeta =
    event.category_meta &&
    typeof event.category_meta === "object" &&
    event.category_meta.sport &&
    typeof event.category_meta.sport === "object"
      ? (event.category_meta.sport as Record<string, unknown>)
      : null;
  const posterH = resolveMediaUrl(event.poster_horizontal_url);
  const posterV = resolveMediaUrl(event.poster_vertical_url);
  const showCreateContract =
    event.status === "PENDING_APPROVAL" || event.status === "APPROVED";

  return (
    <div className="w-full space-y-6">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm portal-muted hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to events
      </Link>

      {(posterH || posterV) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {posterH && (
            <div className="sm:col-span-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-100 h-56">
              <img
                src={posterH}
                alt={`${event.name} horizontal poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {posterV && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-100 h-56">
              <img
                src={posterV}
                alt={`${event.name} vertical poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      {gallery.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
            Gallery
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div key={`${url}-${i}`} className="rounded-xl overflow-hidden h-28 border border-white/10">
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${statusBadge(event.status)}`}
            >
              {event.status.replaceAll("_", " ")}
            </span>
            {event.category_name && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                {event.category_name}
              </span>
            )}
            {event.hosting_type === "tour" && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Tour event
              </span>
            )}
          </div>
          <h2 className="portal-heading text-2xl font-bold">{event.name}</h2>
          <p className="portal-muted mt-1">
            {event.organizer_name || "Organizer"}
            {event.organizer_email ? ` · ${event.organizer_email}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={isUpdating}
            onClick={toggleVisibility}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium inline-flex items-center gap-2 hover:bg-white/5 disabled:opacity-50"
          >
            {event.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
            {event.is_visible ? "Visible" : "Hidden"}
          </button>
          {showCreateContract && (
            <Link
              href={`/admin/event-contracts/create?eventId=${event.id}`}
              className="px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 text-sm font-medium inline-flex items-center gap-2"
            >
              <FileSignature size={16} /> Create contract
            </Link>
          )}
          {event.status === "PENDING_APPROVAL" && (
            <>
              <button
                disabled={isUpdating}
                onClick={() => handleAction("approve")}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                disabled={isUpdating}
                onClick={handleSubmit(onReject)}
                className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-50 text-sm font-medium flex items-center gap-2"
              >
                <XCircle size={16} /> Reject
              </button>
            </>
          )}
          {event.status === "APPROVED" && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction("go_live")}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Radio size={16} /> Publish
            </button>
          )}
          {event.status === "LIVE" && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction("close")}
              className="px-4 py-2 rounded-xl border border-white/10 text-zinc-600 hover:bg-white/5 text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {event.rejection_reason && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Rejection reason</p>
          <p className="whitespace-pre-wrap">{event.rejection_reason}</p>
        </div>
      )}

      {event.status === "PENDING_APPROVAL" && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Rejection reason <RequiredMark />
          </label>
          <textarea
            rows={3}
            {...register("rejection_reason")}
            placeholder="e.g. Poster quality is low, please upload a clearer image..."
            className="input-field resize-y min-h-[80px] w-full"
          />
          {errors.rejection_reason && (
            <p className={fieldErrorClass}>{errors.rejection_reason.message}</p>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Event details</h3>
          <dl className="space-y-3 text-sm">
            <DetailRow label="Category" value={event.category_name || "—"} />
            <DetailRow label="Hosting" value={event.hosting_type === "tour" ? "Tour" : "Single"} />
            <DetailRow label="Language" value={languages.join(", ") || "—"} />
            <DetailRow label="Age group" value={event.age_group || "—"} />
            <DetailRow
              label="Duration"
              value={event.duration_minutes ? `${event.duration_minutes} min` : "—"}
            />
            <DetailRow
              label="Ticket delivery"
              value={
                event.allowed_ticket_modes?.length
                  ? event.allowed_ticket_modes.map(ticketModeLabel).join(", ")
                  : "—"
              }
            />
            <DetailRow label="Visible to customers" value={event.is_visible ? "Yes" : "No"} />
            <DetailRow
              label="Tickets sold"
              value={`${ticketsSold} / ${ticketsTotal || "—"}`}
            />
            <DetailRow label="Created" value={formatDateTime12h(event.created_at)} />
            <DetailRow label="Updated" value={formatDateTime12h(event.updated_at)} />
          </dl>

          {genres.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                Genres
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.about_event && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                About
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {event.about_event}
              </p>
            </div>
          )}

          {event.youtube_url && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                YouTube
              </p>
              <a
                href={event.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-rose-600 hover:text-rose-700 break-all"
              >
                {event.youtube_url}
              </a>
            </div>
          )}

          {(termSelected.length > 0 || termCustom.length > 0) && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                Customer terms &amp; conditions
              </p>
              <ul className="space-y-2">
                {termSelected.map((line, i) => (
                  <li key={`m-${i}`} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-rose-500 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
                {termCustom.map((line, i) => (
                  <li key={`c-${i}`} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-rose-500 mt-0.5">•</span>
                    <span>
                      {line}{" "}
                      <span className="text-[0.625rem] uppercase tracking-wide text-zinc-400">
                        (event-only)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-3">
            <h3 className="portal-heading text-lg font-semibold">Organizer</h3>
            <dl className="space-y-3 text-sm">
              <DetailRow label="Name" value={event.organizer_name || "—"} />
              <DetailRow
                label="Email"
                value={
                  <span className="break-all">{event.organizer_email || "—"}</span>
                }
              />
              <DetailRow label="Phone" value={event.organizer_phone || "—"} />
              <DetailRow label="Address" value={event.organizer_address || "—"} />
            </dl>
            {event.business_id && (
              <Link
                href="/admin/businesses/event"
                className="inline-block text-sm font-medium text-rose-600 hover:text-rose-700 mt-1"
              >
                View event organizers
              </Link>
            )}
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-3">
            <h3 className="portal-heading text-lg font-semibold">Fees</h3>
            <p className="text-xs text-zinc-500">Set on the event contract. Read-only here.</p>
            <dl className="space-y-3 text-sm">
              <DetailRow
                label="Convenience fee"
                value={`${Number(event.convenience_fee_percent || 0).toFixed(2)}%`}
              />
              <DetailRow
                label="Commission"
                value={`${Number(event.commission_percent || 0).toFixed(2)}%`}
              />
            </dl>
          </div>

          {sportMeta && (
            <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-3">
              <h3 className="portal-heading text-lg font-semibold">Sport match</h3>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Home team" value={String(sportMeta.home_team || "—")} />
                <DetailRow label="Away team" value={String(sportMeta.away_team || "—")} />
                {sportMeta.league != null && String(sportMeta.league).trim() && (
                  <DetailRow label="League" value={String(sportMeta.league)} />
                )}
                {sportMeta.venue_note != null && String(sportMeta.venue_note).trim() && (
                  <DetailRow label="Venue note" value={String(sportMeta.venue_note)} />
                )}
              </dl>
            </div>
          )}

          {event.tour && (
            <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-3">
              <h3 className="portal-heading text-lg font-semibold">Tour</h3>
              <dl className="space-y-3 text-sm">
                <DetailRow label="Name" value={event.tour.name || "—"} />
                <DetailRow label="Main artist" value={event.tour.main_artist_name || "—"} />
                <DetailRow label="Status" value={event.tour.status || "—"} />
                {event.tour.description && (
                  <div className="pt-2">
                    <p className="text-xs portal-muted mb-1">Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {event.tour.description}
                    </p>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Artists</h3>
        {event.artists && event.artists.length > 0 ? (
          <ul className="grid sm:grid-cols-2 gap-4">
            {event.artists.map((a, idx) => {
              const img = resolveMediaUrl(a.image_url || a.artist_business_image || undefined);
              return (
                <li
                  key={a.id || `${a.name}-${idx}`}
                  className="flex gap-3 border border-slate-100 rounded-xl p-3"
                >
                  {img ? (
                    <img
                      src={img}
                      alt={a.name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{a.name}</p>
                    {a.role_title && (
                      <p className="text-xs text-zinc-500">{a.role_title}</p>
                    )}
                    <p className="text-xs portal-muted mt-0.5 capitalize">
                      {a.artist_source?.replaceAll("_", " ") || "artist"}
                      {a.artist_business_name ? ` · ${a.artist_business_name}` : ""}
                    </p>
                    {a.description && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-3">{a.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No artists added.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Documents</h3>
        {documents.length > 0 ? (
          <ul className="space-y-3">
            {documents.map((doc, idx) => (
              <li
                key={`${doc.document_type_id}-${idx}`}
                className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <span className="inline-flex items-center gap-2 text-slate-800">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  {doc.document_name || `Document ${idx + 1}`}
                </span>
                {doc.url ? (
                  <a
                    href={resolveMediaUrl(doc.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-600 hover:text-rose-700 font-medium shrink-0"
                  >
                    Open
                  </a>
                ) : (
                  <span className="portal-muted">No file</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No documents uploaded.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Ticket types</h3>
        {event.ticket_types && event.ticket_types.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Venue</th>
                  <th className="py-2 font-medium">Price</th>
                  <th className="py-2 font-medium">Max / order</th>
                  <th className="py-2 font-medium">Available</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {event.ticket_types.map((t) => {
                  const sold = Math.max(
                    0,
                    Number(t.total_count || 0) - Number(t.available_count || 0)
                  );
                  return (
                    <tr key={t.id}>
                      <td className="py-3 font-medium">{t.ticket_type}</td>
                      <td className="py-3 portal-muted">{t.venue_name || "—"}</td>
                      <td className="py-3">{formatMoney(t.price)}</td>
                      <td className="py-3">{t.max_per_order ?? "—"}</td>
                      <td className="py-3">{t.available_count}</td>
                      <td className="py-3">{t.total_count}</td>
                      <td className="py-3">{sold}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No ticket types yet.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Showtimes &amp; venues</h3>
        {event.showtimes && event.showtimes.length > 0 ? (
          <ul className="space-y-4">
            {event.showtimes.map((s) => {
              const cityParts = [s.city_name, s.city_state, s.city_country]
                .map((x) => (x ? String(x) : ""))
                .filter(Boolean);
              return (
                <li
                  key={s.id}
                  className="text-sm border border-slate-100 rounded-xl p-4 space-y-2"
                >
                  <div className="font-semibold portal-heading text-base">
                    {s.venue_name || s.venue_business_name || "Venue TBD"}
                  </div>
                  {s.venue_address && (
                    <div className="portal-muted flex items-start gap-1.5">
                      <MapPin size={13} className="mt-0.5 shrink-0" />
                      {s.venue_address}
                    </div>
                  )}
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {cityParts.length > 0 && (
                      <div className="flex justify-between gap-2 sm:col-span-2">
                        <dt className="portal-muted">City</dt>
                        <dd className="text-slate-800">{cityParts.join(", ")}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 sm:col-span-2">
                      <dt className="portal-muted">Schedule</dt>
                      <dd className="text-slate-800 text-right">
                        {formatDateTime12h(s.starts_at)}
                        {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                      </dd>
                    </div>
                    {s.duration_type && (
                      <div className="flex justify-between gap-2">
                        <dt className="portal-muted">Duration type</dt>
                        <dd className="text-slate-800">
                          {s.duration_type === "MULTI_DAY" ? "Multi-day" : "One day"}
                        </dd>
                      </div>
                    )}
                    {s.venue_source && (
                      <div className="flex justify-between gap-2">
                        <dt className="portal-muted">Venue source</dt>
                        <dd className="text-slate-800 capitalize">
                          {String(s.venue_source).replaceAll("_", " ")}
                        </dd>
                      </div>
                    )}
                    {s.layout_mode && s.layout_mode !== "none" && (
                      <div className="flex justify-between gap-2">
                        <dt className="portal-muted">Layout</dt>
                        <dd className="text-slate-800 capitalize">
                          {s.layout_mode}
                          {s.custom_layout_name ? ` · ${s.custom_layout_name}` : ""}
                        </dd>
                      </div>
                    )}
                    {s.custom_layout_capacity != null && (
                      <div className="flex justify-between gap-2">
                        <dt className="portal-muted">Custom capacity</dt>
                        <dd className="text-slate-800">{s.custom_layout_capacity}</dd>
                      </div>
                    )}
                    {(s.latitude != null || s.longitude != null) && (
                      <div className="flex justify-between gap-2 sm:col-span-2">
                        <dt className="portal-muted">Coordinates</dt>
                        <dd className="text-slate-800">
                          {s.latitude ?? "—"}, {s.longitude ?? "—"}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {s.custom_layout_notes && (
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {s.custom_layout_notes}
                    </p>
                  )}
                  {s.ticket_types && s.ticket_types.length > 0 && (
                    <p className="text-xs portal-muted">
                      Tickets:{" "}
                      {s.ticket_types
                        .map((t) => `${t.ticket_type} (${formatMoney(t.price)})`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No showtimes yet.</p>
        )}
      </div>

      {event.layout_requests && event.layout_requests.length > 0 && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <h3 className="portal-heading text-lg font-semibold mb-4">Layout requests</h3>
          <ul className="space-y-3">
            {event.layout_requests.map((lr) => (
              <li
                key={lr.id}
                className="text-sm border border-slate-100 rounded-xl p-4 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{lr.layout_name}</p>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {lr.status}
                  </span>
                </div>
                <p className="portal-muted">
                  {[lr.venue_name, lr.layout_type, lr.capacity != null ? `Cap ${lr.capacity}` : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                {lr.notes && (
                  <p className="text-slate-700 whitespace-pre-wrap">{lr.notes}</p>
                )}
                {lr.organizer_change_notes && (
                  <p className="text-slate-600 text-xs whitespace-pre-wrap">
                    Change notes: {lr.organizer_change_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Promotion request</h3>
        {event.promotions && event.promotions.length > 0 ? (
          <ul className="space-y-4">
            {event.promotions.map((p) => {
              const banner = resolveMediaUrl(p.banner_image_url || undefined);
              return (
                <li
                  key={String(p.id)}
                  className="flex flex-col sm:flex-row gap-4 border border-slate-100 rounded-xl p-4"
                >
                  {banner && (
                    <img
                      src={banner}
                      alt={p.title || "Promotion banner"}
                      className="w-full sm:w-40 h-24 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">
                        {p.title || p.plan_name || "Promotion"}
                      </p>
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        {p.status || "—"}
                      </span>
                    </div>
                    <p className="text-sm portal-muted">
                      {[p.plan_name, p.duration_days != null ? `${p.duration_days} days` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                      {p.plan_price != null ? ` · ${formatMoney(p.plan_price)}` : ""}
                    </p>
                    <p className="text-xs portal-muted">
                      {[
                        p.listing_boost ? "Listing boost" : "",
                        p.landing_slider ? "Landing slider" : "",
                        p.category_rail ? "Category rail" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No placement flags"}
                    </p>
                    {(p.start_date || p.end_date) && (
                      <p className="text-xs text-slate-600">
                        {p.start_date ? formatDateTime12h(p.start_date) : "—"}
                        {" → "}
                        {p.end_date ? formatDateTime12h(p.end_date) : "—"}
                      </p>
                    )}
                    {p.admin_note && (
                      <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-2 py-1 mt-1">
                        Admin note: {p.admin_note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">
            No promotion requested with this event.
          </p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Recent bookings</h3>
        {event.bookings && event.bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 font-medium">Guest</th>
                  <th className="py-2 font-medium">Tickets</th>
                  <th className="py-2 font-medium">Convenience</th>
                  <th className="py-2 font-medium">Commission</th>
                  <th className="py-2 font-medium">Customer total</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {event.bookings.map((b: Record<string, unknown>) => (
                  <tr key={String(b.id)}>
                    <td className="py-3">{String(b.guest_name || b.guest_email || "—")}</td>
                    <td className="py-3">{String(b.items_qty ?? b.ticket_qty ?? "—")}</td>
                    <td className="py-3">
                      {formatMoney(Number(b.convenience_fee_total) || 0)}
                    </td>
                    <td className="py-3">{formatMoney(Number(b.commission_total) || 0)}</td>
                    <td className="py-3">{formatMoney(Number(b.grand_total) || 0)}</td>
                    <td className="py-3">{String(b.status || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}

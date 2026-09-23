"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle,
  ImageOff,
  Mail,
  MapPin,
  Megaphone,
  Pencil,
  Phone,
  Undo2,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import PartnerDocumentsFields from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { parseContactPerson, resolveContactPersons } from "@/lib/venuePartnerInfo";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import {
  useArchiveBusinessMutation,
  useGetAdminBusinessQuery,
  useGetMarketingCampaignsQuery,
  useUnarchiveBusinessMutation,
  type MarketingCampaign,
  type PartnerDocumentUpload,
} from "@/services/api";

interface AdminPartnerDetailPageProps {
  module: "dining" | "event" | "venue" | "artist" | "cinema";
}

type DetailTab = "overview" | "promotions";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:grid sm:grid-cols-[9rem_1fr] sm:gap-3 py-2 border-b border-slate-100 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 font-medium min-w-0 break-words">{children}</dd>
    </div>
  );
}

function promotionStatusClass(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "REJECTED") return "bg-rose-50 text-rose-700 border-rose-200";
  if (s === "PAUSED") return "bg-sky-50 text-sky-700 border-sky-200";
  if (s === "EXPIRED") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatMoney(v?: number | string | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function PromotionCard({ camp }: { camp: MarketingCampaign }) {
  const banner = resolveMediaUrl(camp.banner_image_url);
  const href = "/admin/marketing?tab=requests";
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm block hover:border-rose-200 hover:shadow-md transition-all"
    >
      <div className="aspect-[16/7] bg-slate-100 relative">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt={camp.title || camp.plan_name || "Promotion"} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <Megaphone size={28} />
          </div>
        )}
        <span
          className={`absolute top-2 right-2 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${promotionStatusClass(
            camp.status
          )}`}
        >
          {String(camp.status || "—").replaceAll("_", " ")}
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-bold text-slate-900 truncate">
          {camp.title?.trim() || camp.plan_name || "Promotion"}
        </h3>
        <p className="text-xs text-slate-500">
          Plan: {camp.plan_name || "—"}
          {camp.duration_days != null ? ` · ${camp.duration_days} days` : ""}
        </p>
        <p className="text-xs text-slate-500">
          {camp.start_date || "—"} → {camp.end_date || "—"}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-slate-600 font-medium">
            {formatMoney(camp.amount ?? camp.price)}
          </span>
          <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-slate-600 font-medium">
            Payment: {String(camp.payment_status || "UNPAID").replaceAll("_", " ")}
          </span>
          {camp.requested_by ? (
            <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700 font-medium">
              Partner request
            </span>
          ) : (
            <span className="rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-slate-600 font-medium">
              Admin assigned
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AdminPartnerDetailPage({ module }: AdminPartnerDetailPageProps) {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const isDining = module === "dining";
  const isVenue = module === "venue";
  const isArtist = module === "artist";
  const isCinema = module === "cinema";
  const hasSubtype = isDining || isVenue || isArtist;
  const showPromotions = isDining || isCinema || module === "event";
  const listHref = `/admin/businesses/${module}`;
  const { data: biz, isLoading } = useGetAdminBusinessQuery(id, { skip: !id });
  const [archiveBusiness, { isLoading: isArchiving }] = useArchiveBusinessMutation();
  const [unarchiveBusiness, { isLoading: isUnarchiving }] = useUnarchiveBusinessMutation();
  const [confirmAction, setConfirmAction] = useState<"archive" | "unarchive" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [tab, setTab] = useState<DetailTab>("overview");

  const { data: promotionsData, isLoading: promotionsLoading } = useGetMarketingCampaignsQuery(
    { business_id: id, page: 1, limit: 50 },
    { skip: !id || !showPromotions }
  );
  const promotions = promotionsData?.items ?? [];

  const listLabel = isDining
    ? "dining businesses"
    : isVenue
      ? "venue partners"
      : isArtist
        ? "artist partners"
        : isCinema
          ? "cinema partners"
          : "event organizers";
  const entityLabel = isDining
    ? "Restaurant"
    : isVenue
      ? "Venue"
      : isArtist
        ? "Artist"
        : isCinema
          ? "Cinema"
          : "Organizer";
  const typeLabel = isArtist
    ? "Artist type"
    : isCinema
      ? "Cinema type"
      : isDining
        ? "Dining type"
        : isVenue
          ? "Venue type"
          : "Module";
  const typeValue = hasSubtype ? biz?.type_name : isCinema ? "Cinema" : "Event";
  const contactPersons = resolveContactPersons(biz);
  const aboutText = (biz?.description || "")
    .replace(/Contact persons?:\s*.+/i, "")
    .trim();
  const coverUrl = resolveMediaUrl(biz?.cover_image_url);

  const tabs = useMemo(() => {
    const items: Array<{ id: DetailTab; label: string }> = [{ id: "overview", label: "Overview" }];
    if (showPromotions) items.push({ id: "promotions", label: "Promotions" });
    return items;
  }, [showPromotions]);

  const goToList = () => {
    router.push(listHref);
  };

  if (isLoading) {
    return (
      <div className="w-full py-16 text-center text-sm text-slate-500">Loading partner...</div>
    );
  }

  if (!biz) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4 text-sm">Partner not found.</p>
        <button
          type="button"
          onClick={goToList}
          className="text-rose-600 hover:text-rose-700 text-sm font-semibold cursor-pointer"
        >
          Back to list
        </button>
      </div>
    );
  }

  const documents: PartnerDocumentUpload[] = Array.isArray(biz.documents)
    ? biz.documents.filter((d) => d.document_type_id > 0 && d.url)
    : [];
  const isArchived = !!biz.deleted_at;
  const archiveBlocked = isDining
    ? (biz.upcoming_booking_count ?? 0) > 0
    : isVenue || isArtist || isCinema
      ? false
      : (biz.live_event_count ?? 0) > 0;
  const actionBusy = isArchiving || isUnarchiving || confirmBusy;

  const runConfirmed = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction === "archive") {
        await archiveBusiness(biz.id).unwrap();
        toast.success("Partner archived");
      } else {
        await unarchiveBusiness(biz.id).unwrap();
        toast.success(
          biz.credentials_sent_at
            ? "Partner unarchived — they can log in with their existing password"
            : "Partner unarchived — login credentials were emailed"
        );
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(
        extractApiError(
          err,
          confirmAction === "archive" ? "Failed to archive" : "Failed to unarchive"
        )
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy =
    confirmAction === "unarchive"
      ? {
          title: "Unarchive partner?",
          body: biz.credentials_sent_at
            ? `Unarchive "${biz.name}"? They return to the Active list and can log in with their existing password. No new credentials email is sent.`
            : `Unarchive "${biz.name}"? They return to the Active list. Login credentials will be emailed once because they were never sent.`,
          confirmLabel: "Unarchive",
          danger: false,
        }
      : {
          title: "Archive partner?",
          body: archiveBlocked
            ? isDining
              ? `You cannot archive "${biz.name}" while they have upcoming or in-progress reservations. Wait until those bookings finish.`
              : `You cannot archive "${biz.name}" while they still have LIVE events. Close live events first.`
            : isDining
              ? `Archive "${biz.name}"? After archive they cannot log in. Booking history is kept.`
              : isVenue
                ? `Archive "${biz.name}"? After archive they cannot log in. Layout request history is kept.`
                : isArtist
                  ? `Archive "${biz.name}"? After archive they cannot log in. Artist profile history is kept.`
                  : isCinema
                    ? `Archive "${biz.name}"? After archive they cannot log in. Cinema partner history is kept.`
                    : `Archive "${biz.name}"? After archive they cannot log in. Booking and fee history is kept.`,
          confirmLabel: "Archive",
          danger: true,
        };

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goToList}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer self-start"
        >
          <ArrowLeft size={16} /> Back to {listLabel}
        </button>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {isVenue && (
            <Link
              href={`/admin/venue-layouts?business_id=${biz.id}`}
              className="btn-secondary !py-2 !px-3 text-sm flex-1 sm:flex-none justify-center"
            >
              Review venue layouts
            </Link>
          )}
          {isCinema && (
            <>
              <Link
                href={`/admin/venue-layouts?business_id=${biz.id}`}
                className="btn-secondary !py-2 !px-3 text-sm flex-1 sm:flex-none justify-center"
              >
                Review screen layouts
              </Link>
              <Link
                href="/admin/movies"
                className="btn-secondary !py-2 !px-3 text-sm flex-1 sm:flex-none justify-center"
              >
                Movie catalog
              </Link>
            </>
          )}
          {!isArchived ? (
            <>
              <Link
                href={`${listHref}/${biz.id}/edit`}
                className="btn-primary !py-2 !px-3 text-sm inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              >
                <Pencil size={15} /> Edit
              </Link>
              <button
                type="button"
                onClick={() => setConfirmAction("archive")}
                disabled={actionBusy || archiveBlocked}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                title={
                  archiveBlocked
                    ? isDining
                      ? "Wait until reservations finish"
                      : "Close live events first"
                    : "Archive partner"
                }
              >
                <Archive size={15} /> Archive
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction("unarchive")}
              disabled={actionBusy}
              className="btn-primary !py-2 !px-3 text-sm inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              <Undo2 size={15} /> Unarchive
            </button>
          )}
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="flex items-center gap-1 rounded-lg bg-slate-100/90 p-0.5 w-full sm:w-fit overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.id
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.id === "promotions" && promotions.length > 0 ? (
                <span className="ml-1.5 text-[10px] font-bold text-slate-400">{promotions.length}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "overview" ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-7 xl:col-span-8 order-2 md:order-1 p-3 sm:p-4 md:p-5 border-t md:border-t-0 md:border-r border-slate-100">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {isArchived ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <Archive size={11} /> Archived
                    </span>
                  ) : biz.is_enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <CheckCircle size={11} /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      <XCircle size={11} /> Disabled
                    </span>
                  )}
                  {hasSubtype && biz.type_name ? (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {biz.type_name}
                    </span>
                  ) : !hasSubtype ? (
                    <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                      {isCinema ? "Cinema" : "Event"}
                    </span>
                  ) : null}
                </div>

                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                  {biz.name}
                </h1>
                {biz.address ? (
                  <p className="mt-1.5 text-sm text-slate-500 flex items-start gap-1.5">
                    <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                    <span>{biz.address}</span>
                  </p>
                ) : null}

                <dl className="mt-4">
                  {hasSubtype && biz.parent_type_name ? (
                    <InfoRow label="Category">{biz.parent_type_name}</InfoRow>
                  ) : null}
                  <InfoRow label={typeLabel}>{typeValue || "—"}</InfoRow>
                  <InfoRow label="Phone">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" />
                      {biz.phone?.trim() || "—"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Admin login">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {biz.admin_email?.trim() || contactPersons[0]?.email || "—"}
                      </span>
                    </span>
                    {biz.admin_role ? (
                      <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                        {biz.admin_role}
                      </span>
                    ) : null}
                  </InfoRow>
                  {isDining ? (
                    <InfoRow label="Collections">
                      {Array.isArray(biz.collection_titles) && biz.collection_titles.length > 0
                        ? biz.collection_titles.join(", ")
                        : "—"}
                    </InfoRow>
                  ) : null}
                  {isDining ? <InfoRow label="Cuisine">{biz.cuisine?.trim() || "—"}</InfoRow> : null}
                  <InfoRow label={isVenue ? "About" : "Description"}>
                    {aboutText || parseContactPerson(biz.description) ? aboutText || "—" : "—"}
                  </InfoRow>
                </dl>
              </div>

              <div className="md:col-span-5 xl:col-span-4 order-1 md:order-2 bg-slate-50 p-3 sm:p-4 md:p-5 flex flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  {entityLabel} profile image
                </p>
                <div className="relative w-full aspect-[16/10] md:aspect-auto md:flex-1 md:min-h-[12rem] lg:min-h-[14rem] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt={`${biz.name} profile`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <ImageOff size={28} />
                      <p className="text-xs font-medium">No profile image uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                <UserRound size={15} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Contact persons</h2>
                <p className="text-[11px] text-slate-500">
                  Primary contact is used for admin login and notifications
                </p>
              </div>
            </div>

            {contactPersons.length === 0 ? (
              <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                No contact persons on file
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {contactPersons.map((c, idx) => (
                  <div
                    key={`${c.email}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name || "—"}</p>
                      {idx === 0 ? (
                        <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
                      <Mail size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate">{c.email || "—"}</span>
                    </p>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Phone size={12} className="shrink-0 text-slate-400" />
                      {c.phone || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PartnerDocumentsFields
            module={module}
            value={documents}
            onChange={() => {}}
            variant="light"
            editable={false}
            className="!shadow-sm"
          />
        </>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 sm:p-4 md:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <Megaphone size={15} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Promotions</h2>
                <p className="text-[11px] text-slate-500">
                  Marketing campaigns requested or run by this {entityLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <Link
              href="/admin/marketing?tab=requests"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              Open Marketing Plans →
            </Link>
          </div>

          {promotionsLoading ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading promotions…</p>
          ) : promotions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 sm:py-12 text-center">
              <Megaphone size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-800">Not running any promotions</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                This {entityLabel.toLowerCase()} has not requested or been assigned any promotion
                campaigns yet. When they purchase a visibility or marketing plan, those campaigns
                will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {promotions.map((camp) => (
                <PromotionCard key={camp.id} camp={camp} />
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        danger={confirmCopy.danger}
        variant={confirmAction === "unarchive" ? "success" : "warning"}
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
}

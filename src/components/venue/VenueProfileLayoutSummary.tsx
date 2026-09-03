"use client";

import {
  formatVenueFieldValue,
  getVenueMetaFields,
  getVenueTypeFields,
  groupVenueFieldsBySection,
  type VenueMeta,
} from "@/lib/venueCategoryConfig";

type Snapshot = {
  fields?: Record<string, string | number | boolean>;
  venue_type_slug?: string | null;
  venue_type_name?: string | null;
  gross_capacity?: number | null;
  sellable_capacity?: number | null;
  damaged_seats?: number | null;
};

type Props = {
  venueMeta?: VenueMeta | Record<string, unknown> | null;
  venueTypeSlug?: string | null;
  venueTypeName?: string | null;
  specSnapshot?: Snapshot | null;
  compact?: boolean;
};

function resolveSnapshot(props: Props): {
  fields: Record<string, string | number | boolean>;
  slug: string;
  label: string;
  gross: number | null;
  sellable: number | null;
  damaged: number | null;
} {
  const snap = props.specSnapshot;
  const metaFields =
    snap?.fields && typeof snap.fields === "object"
      ? snap.fields
      : getVenueMetaFields(
          props.venueMeta && typeof props.venueMeta === "object"
            ? (props.venueMeta as VenueMeta)
            : null
        );

  return {
    fields: metaFields,
    slug: snap?.venue_type_slug || props.venueTypeSlug || "",
    label: snap?.venue_type_name || props.venueTypeName || "Venue",
    gross: snap?.gross_capacity ?? null,
    sellable: snap?.sellable_capacity ?? null,
    damaged: snap?.damaged_seats ?? null,
  };
}

export default function VenueProfileLayoutSummary({ compact, ...props }: Props) {
  const { fields, slug, label, gross, sellable, damaged } = resolveSnapshot(props);
  const fieldDefs = getVenueTypeFields(slug);
  const sections = groupVenueFieldsBySection(fieldDefs).filter((section) =>
    section.fields.some((field) => {
      const value = fields[field.key];
      return value !== undefined && value !== null && value !== "";
    })
  );

  const hasCapacity = gross != null || sellable != null;
  const hasFields = sections.length > 0;

  if (!hasCapacity && !hasFields) {
    return (
      <p className="text-sm text-zinc-500">
        No venue profile details attached. Ask the venue admin to complete their profile.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Venue profile</p>
        <p className="text-sm text-white font-medium">{label}</p>
        {hasCapacity && (
          <p className="text-xs text-zinc-400 mt-1">
            {gross != null ? <>Gross: {gross}</> : null}
            {sellable != null ? (
              <>
                {gross != null ? " · " : ""}
                Sellable: {sellable}
              </>
            ) : null}
            {damaged != null && damaged > 0 ? ` · Damaged: ${damaged}` : ""}
          </p>
        )}
      </div>

      {sections.map((section) => (
        <div key={section.section}>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">{section.section}</p>
          <div className="space-y-1">
            {section.fields.map((field) => {
              const value = fields[field.key];
              if (value === undefined || value === null || value === "") return null;
              return (
                <div key={field.key} className="flex justify-between gap-3 text-xs">
                  <span className="text-zinc-500">{field.label}</span>
                  <span className="text-zinc-200 text-right">{formatVenueFieldValue(field, value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

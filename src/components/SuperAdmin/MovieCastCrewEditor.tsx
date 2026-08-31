"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import type { MovieCastCrewMember } from "@/services/api";

export type MovieCastCrewFormMember = {
  clientId: string;
  name: string;
  role: string;
  image_url: string;
  sort_order: number;
};

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyCastCrewMember(sortOrder: number): MovieCastCrewFormMember {
  return {
    clientId: createClientId(),
    name: "",
    role: "",
    image_url: "",
    sort_order: sortOrder,
  };
}

export function parseMovieCastCrewFromApi(
  items: MovieCastCrewMember[] | undefined | null
): MovieCastCrewFormMember[] {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    clientId: createClientId(),
    name: item.name ?? "",
    role: item.role ?? "",
    image_url: item.image_url ?? "",
    sort_order: item.sort_order ?? index,
  }));
}

export function serializeMovieCastCrew(members: MovieCastCrewFormMember[]): MovieCastCrewMember[] {
  return members
    .filter((member) => member.name.trim() && member.role.trim())
    .map((member, index) => ({
      name: member.name.trim(),
      role: member.role.trim(),
      image_url: member.image_url.trim() || null,
      sort_order: member.sort_order ?? index,
    }));
}

type MovieCastCrewEditorProps = {
  kind: "cast" | "crew";
  title: string;
  description: string;
  members: MovieCastCrewFormMember[];
  onChange: (members: MovieCastCrewFormMember[]) => void;
  crewRoleOptions?: Array<{ id: number; name: string }>;
  onUploadImage: (file: File) => Promise<string | null>;
  uploading?: boolean;
  max?: number;
};

function AddMemberButton({
  kind,
  disabled,
  onClick,
  variant = "primary",
}: {
  kind: "cast" | "crew";
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const label = kind === "cast" ? "cast member" : "crew member";
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/40 disabled:opacity-50 w-full";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <Plus size={16} />
      Add {label}
    </button>
  );
}

export default function MovieCastCrewEditor({
  kind,
  title,
  description,
  members,
  onChange,
  crewRoleOptions = [],
  onUploadImage,
  uploading = false,
  max = kind === "cast" ? 30 : 20,
}: MovieCastCrewEditorProps) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const updateMember = (clientId: string, patch: Partial<MovieCastCrewFormMember>) => {
    onChange(members.map((member) => (member.clientId === clientId ? { ...member, ...patch } : member)));
  };

  const removeMember = (clientId: string) => {
    rowRefs.current.delete(clientId);
    if (highlightedId === clientId) setHighlightedId(null);
    if (newlyAddedId === clientId) setNewlyAddedId(null);
    onChange(
      members
        .filter((member) => member.clientId !== clientId)
        .map((member, index) => ({ ...member, sort_order: index }))
    );
  };

  const addMember = () => {
    if (members.length >= max) return;
    const newMember = createEmptyCastCrewMember(members.length);
    setHighlightedId(newMember.clientId);
    setNewlyAddedId(newMember.clientId);
    onChange([...members, newMember]);
  };

  useEffect(() => {
    if (!newlyAddedId) return;

    const id = newlyAddedId;
    const scrollTimer = window.setTimeout(() => {
      const row = rowRefs.current.get(id);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      const nameInput = row.querySelector<HTMLInputElement>("[data-member-name]");
      nameInput?.focus({ preventScroll: true });
    }, 80);

    const highlightTimer = window.setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
      setNewlyAddedId((current) => (current === id ? null : current));
    }, 2400);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [newlyAddedId]);

  const memberLabel = kind === "cast" ? "cast member" : "crew member";
  const atMax = members.length >= max;

  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {members.length > 0 ? (
              <span className="inline-flex rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {members.length} {members.length === 1 ? memberLabel : `${kind} entries`}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
          {members.length > 0 ? (
            <p className="text-xs text-slate-400 mt-1">
              New {memberLabel}s are added at the bottom and scrolled into view automatically.
            </p>
          ) : null}
        </div>
        <AddMemberButton kind={kind} disabled={atMax} onClick={addMember} />
      </div>

      {kind === "crew" && !crewRoleOptions.length ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No crew roles yet. Add them in{" "}
          <Link href="/admin/movie-masters" className="font-semibold text-rose-600 hover:text-rose-500">
            Movie Masters
          </Link>
          .
        </p>
      ) : null}

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No {kind === "cast" ? "cast" : "crew"} added yet.
        </div>
      ) : (
        <div className="space-y-4">
          {members.map((member, index) => {
            const isNew = highlightedId === member.clientId;
            const isLast = index === members.length - 1;

            return (
              <div
                key={member.clientId}
                ref={(node) => {
                  if (node) rowRefs.current.set(member.clientId, node);
                  else rowRefs.current.delete(member.clientId);
                }}
                className={`grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-4 rounded-xl border bg-white p-4 transition-all duration-300 ${
                  isNew
                    ? "border-rose-300 ring-2 ring-rose-300/60 ring-offset-2 shadow-sm"
                    : "border-slate-200"
                }`}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Photo
                  </p>
                  <CroppedImageField
                    value={member.image_url}
                    aspect={1}
                    disabled={uploading}
                    previewClassName="w-full h-28 rounded-xl border border-slate-200 object-cover"
                    emptyClassName="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-500 text-xs"
                    emptyLabel="Add photo"
                    onRemove={() => updateMember(member.clientId, { image_url: "" })}
                    onCroppedFile={async (file) => {
                      const url = await onUploadImage(file);
                      if (url) updateMember(member.clientId, { image_url: url });
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Name *
                    </label>
                    <input
                      data-member-name
                      className="input-field w-full"
                      value={member.name}
                      onChange={(e) => updateMember(member.clientId, { name: e.target.value })}
                      placeholder={kind === "cast" ? "Yash" : "Geetu Mohandas"}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      {kind === "cast" ? "Role *" : "Position *"}
                    </label>
                    {kind === "crew" ? (
                      <select
                        className="input-field w-full"
                        value={member.role}
                        onChange={(e) => updateMember(member.clientId, { role: e.target.value })}
                      >
                        <option value="">Select position</option>
                        {crewRoleOptions.map((option) => (
                          <option key={option.id} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input-field w-full"
                        value={member.role}
                        onChange={(e) => updateMember(member.clientId, { role: e.target.value })}
                        placeholder="as Raya"
                      />
                    )}
                  </div>
                  <p className="sm:col-span-2 text-xs text-slate-400">
                    Entry {index + 1}
                    {isNew ? <span className="ml-2 font-semibold text-rose-500">New</span> : null}
                  </p>
                </div>

                <div className="flex md:flex-col items-end justify-between md:justify-start">
                  <button
                    type="button"
                    onClick={() => removeMember(member.clientId)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>

                {isLast && !atMax ? (
                  <div className="md:col-span-3 pt-1 border-t border-slate-100">
                    <AddMemberButton kind={kind} onClick={addMember} variant="secondary" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {atMax ? (
        <p className="text-xs text-slate-400 text-center">
          Maximum of {max} {kind === "cast" ? "cast" : "crew"} entries reached.
        </p>
      ) : null}
    </div>
  );
}

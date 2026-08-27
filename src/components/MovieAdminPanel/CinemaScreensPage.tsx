"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Plus } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useApproveVenueLayoutTemplateMutation,
  useCreateCinemaScreenMutation,
  useCreateVenueLayoutRequestMutation,
  useGetCinemaScreensQuery,
  useGetVenueLayoutTemplatesQuery,
  useRejectVenueLayoutTemplateMutation,
  useUpdateCinemaScreenMutation,
  type CinemaScreen,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

const SCREEN_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "imax", label: "IMAX" },
  { value: "4dx", label: "4DX" },
  { value: "other", label: "Other" },
];

export default function CinemaScreensPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: screens = [], isLoading } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: layoutOptions = [] } = useGetVenueLayoutTemplatesQuery(bizId, { skip: !bizId });
  const [createScreen, { isLoading: creating }] = useCreateCinemaScreenMutation();
  const [updateScreen, { isLoading: updating }] = useUpdateCinemaScreenMutation();
  const [createLayoutRequest, { isLoading: submittingLayout }] = useCreateVenueLayoutRequestMutation();
  const [approveLayout, { isLoading: approving }] = useApproveVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [name, setName] = useState("");
  const [screenType, setScreenType] = useState("standard");
  const [capacity, setCapacity] = useState("200");
  const [description, setDescription] = useState("");
  const [layoutScreenId, setLayoutScreenId] = useState<string | null>(null);

  const selectedScreen = useMemo(
    () => screens.find((s) => s.id === layoutScreenId) || null,
    [screens, layoutScreenId]
  );

  const resetForm = () => {
    setName("");
    setScreenType("standard");
    setCapacity("200");
    setDescription("");
  };

  const onCreate = async () => {
    if (!bizId) return;
    if (!name.trim()) {
      toast.error("Screen name is required");
      return;
    }
    try {
      await createScreen({
        bizId,
        name: name.trim(),
        screen_type: screenType,
        capacity: Number(capacity) || 0,
        description: description.trim() || undefined,
      }).unwrap();
      toast.success("Screen created");
      resetForm();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create screen"));
    }
  };

  const toggleActive = async (screen: CinemaScreen) => {
    if (!bizId) return;
    try {
      await updateScreen({
        bizId,
        screenId: screen.id,
        body: { is_active: !screen.is_active },
      }).unwrap();
      toast.success(screen.is_active ? "Screen disabled" : "Screen enabled");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update screen"));
    }
  };

  const submitLayout = async (submitNow: boolean) => {
    if (!bizId || !selectedScreen?.hall_id) {
      toast.error("This screen is missing a linked hall. Recreate the screen.");
      return;
    }
    const cap = Number(selectedScreen.capacity) || Number(capacity) || 100;
    try {
      await createLayoutRequest({
        bizId,
        hall_id: selectedScreen.hall_id,
        hall_name: selectedScreen.name,
        hall_capacity: cap,
        layout_name: `${selectedScreen.name} seating`,
        layout_type: "theater",
        capacity: cap,
        is_indoor: true,
        spec_json: {
          hall_name: selectedScreen.name,
          hall_capacity: cap,
          zones: [
            { name: "Premium", capacity: Math.max(1, Math.round(cap * 0.3)) },
            { name: "Regular", capacity: Math.max(1, Math.round(cap * 0.7)) },
          ],
          notes: `Cinema screen layout for ${selectedScreen.name}`,
          intake_mode: "structured_request",
        },
        submit_now: submitNow,
      }).unwrap();
      toast.success(submitNow ? "Layout request submitted to Super Admin" : "Layout draft saved");
      setLayoutScreenId(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to submit layout request"));
    }
  };

  if (!bizId) {
    return <p className="text-zinc-400">Cinema business not linked to this account.</p>;
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clapperboard size={20} className="text-fuchsia-400" /> Screens & layouts
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Add each auditorium, then request a seat layout. Super Admin builds the map using the same
          venue layout tool (temporary — cinema layout will get its own builder later).
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
        <h3 className="text-white font-semibold">Add screen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="portal-label">Screen name *</label>
            <input
              className="input-field"
              placeholder="Screen 1 / IMAX"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="portal-label">Screen type</label>
            <select
              className="input-field"
              value={screenType}
              onChange={(e) => setScreenType(e.target.value)}
            >
              {SCREEN_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="portal-label">Expected capacity</label>
            <input
              className="input-field"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <label className="portal-label">Notes</label>
            <input
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> {creating ? "Creating…" : "Create screen"}
        </button>
      </div>

      {layoutOptions.filter((opt) => opt.status === "PUBLISHED" && !opt.is_default).length > 0 && (
        <div className="glass-panel rounded-2xl border border-amber-500/20 p-5 space-y-3">
          <h3 className="text-white font-semibold">Layouts waiting for your approval</h3>
          <p className="text-sm text-zinc-400">
            Super Admin published these seat maps. Approve to attach them to the matching screen.
          </p>
          {layoutOptions
            .filter((opt) => opt.status === "PUBLISHED" && !opt.is_default)
            .map((opt) => (
              <div
                key={opt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-white/10 p-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{opt.name}</p>
                  <p className="text-xs text-zinc-500">
                    {opt.hall_name || "Screen"} · capacity {opt.capacity} · {opt.seat_count ?? 0} seats
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={approving}
                    onClick={async () => {
                      try {
                        await approveLayout({ bizId, templateId: opt.id }).unwrap();
                        toast.success("Layout approved for this screen");
                      } catch (err) {
                        toast.error(extractApiError(err, "Approve failed"));
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={rejecting}
                    onClick={() => {
                      setRejectId(opt.id);
                      setRejectReason("");
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-3">
            <h3 className="text-white font-semibold">Reject layout</h3>
            <textarea
              className="input-field min-h-[88px]"
              placeholder="Reason for Super Admin"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRejectId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary bg-rose-600 hover:bg-rose-500"
                disabled={rejecting || !rejectReason.trim()}
                onClick={async () => {
                  try {
                    await rejectLayout({
                      bizId,
                      templateId: rejectId,
                      reason: rejectReason.trim(),
                    }).unwrap();
                    toast.success("Layout rejected");
                    setRejectId(null);
                  } catch (err) {
                    toast.error(extractApiError(err, "Reject failed"));
                  }
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-zinc-400">Loading screens…</p>
        ) : screens.length === 0 ? (
          <p className="p-8 text-center text-zinc-500">No screens yet. Create Screen 1 to get started.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {screens.map((screen) => (
              <div
                key={screen.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-white font-semibold">{screen.name}</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {(screen.screen_type || "standard").toUpperCase()} · capacity {screen.capacity}
                    {screen.layout_name
                      ? ` · layout: ${screen.layout_name}${screen.layout_is_default ? " (approved)" : ""}`
                      : " · no approved layout yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLayoutScreenId(screen.id)}
                    className="btn-secondary text-sm"
                    disabled={!screen.hall_id}
                  >
                    Request layout
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(screen)}
                    disabled={updating}
                    className="px-3 py-2 rounded-xl text-sm border border-white/10 text-zinc-300 hover:bg-white/5"
                  >
                    {screen.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedScreen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-white font-semibold">Layout request — {selectedScreen.name}</h3>
            <p className="text-sm text-zinc-400">
              This sends a theater layout request to Super Admin (Venue Layouts queue). After they
              publish a seat map, approve it here so this screen is ready for showtimes.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLayoutScreenId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={submittingLayout}
                onClick={() => submitLayout(false)}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submittingLayout}
                onClick={() => submitLayout(true)}
              >
                {submittingLayout ? "Submitting…" : "Submit to Super Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

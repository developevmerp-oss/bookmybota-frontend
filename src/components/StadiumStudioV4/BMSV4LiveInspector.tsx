"use client";

import React from "react";
import {
  Sliders,
  Trash2,
  Layers,
  Armchair,
  Users,
  Compass,
  Building,
  DoorOpen,
  DollarSign,
  Maximize2,
  Palette,
  Tag,
  Grid,
} from "lucide-react";
import { BMSSectionDefV4, BMSStageGroundDefV4, BMSAmenityPOIV4, BMSTableDefV4 } from "./types";

interface BMSV4LiveInspectorProps {
  selectedSection: BMSSectionDefV4 | null;
  selectedAmenity: BMSAmenityPOIV4 | null;
  groundConfig: BMSStageGroundDefV4;
  ticketTypes: Array<{ id: string; name: string; price?: number }>;
  onUpdateSection: (updated: Partial<BMSSectionDefV4>) => void;
  onDeleteSection: (sectionId: string) => void;
  onUpdateAmenity: (updated: Partial<BMSAmenityPOIV4>) => void;
  onDeleteAmenity: (amenityId: string) => void;
  onUpdateGround: (updated: Partial<BMSStageGroundDefV4>) => void;
  onOpenPainter: (section: BMSSectionDefV4) => void;
}

export default function BMSV4LiveInspector({
  selectedSection,
  selectedAmenity,
  groundConfig,
  ticketTypes,
  onUpdateSection,
  onDeleteSection,
  onUpdateAmenity,
  onDeleteAmenity,
  onUpdateGround,
  onOpenPainter,
}: BMSV4LiveInspectorProps) {
  // 1. Amenity Selected
  if (selectedAmenity) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col p-4 text-white overflow-y-auto select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-sm">Amenity / Gate POI</h3>
          </div>
          <button
            type="button"
            onClick={() => onDeleteAmenity(selectedAmenity.id)}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            title="Delete POI"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">POI Label</label>
            <input
              type="text"
              value={selectedAmenity.label}
              onChange={(e) => onUpdateAmenity({ label: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Category Type</label>
            <select
              value={selectedAmenity.type}
              onChange={(e) => onUpdateAmenity({ type: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            >
              <option value="gate">Turnstile Gate / Entrance</option>
              <option value="restroom">Restroom / Washroom</option>
              <option value="food_beverage">Food & Beverage / Snack Bar</option>
              <option value="bar">Alcohol / Beer Bar</option>
              <option value="sound_booth">Sound & Light Console (FOH)</option>
              <option value="emergency_exit">Emergency Exit</option>
              <option value="first_aid">Medical / First Aid</option>
              <option value="merch_stand">Merchandise Store</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  // 2. Section Selected
  if (selectedSection) {
    const isGA = selectedSection.sectionType === "general_admission";
    const isTable = selectedSection.sectionType === "table_cluster";
    const isCurved = selectedSection.sectionType === "curved_stand";

    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col p-4 text-white overflow-y-auto select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
              style={{ backgroundColor: selectedSection.color }}
            />
            <h3 className="font-bold text-sm truncate max-w-[170px]">{selectedSection.name}</h3>
          </div>
          <button
            type="button"
            onClick={() => onDeleteSection(selectedSection.id)}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            title="Delete Section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Section Name & Code */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Section Name</label>
            <input
              type="text"
              value={selectedSection.name}
              onChange={(e) => onUpdateSection({ name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Section Code</label>
              <input
                type="text"
                value={selectedSection.code || ""}
                onChange={(e) => onUpdateSection({ code: e.target.value })}
                placeholder="e.g. N-LWR"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Section Color</label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5">
                <input
                  type="color"
                  value={selectedSection.color}
                  onChange={(e) => onUpdateSection({ color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[10px] text-slate-400 uppercase">{selectedSection.color}</span>
              </div>
            </div>
          </div>

          {/* Section Type Selector */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Seating Architecture</label>
            <select
              value={selectedSection.sectionType}
              onChange={(e) => onUpdateSection({ sectionType: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            >
              <option value="seated_grid">Seated Grid (Cinema / Theatre / Hall)</option>
              <option value="curved_stand">Curved Concentric Stand (Stadium / Arena)</option>
              <option value="general_admission">General Admission (Standing Fan Pit)</option>
              <option value="table_cluster">Table Cluster (Banquet / Cabaret)</option>
            </select>
          </div>

          {/* Ticket Type & Pricing */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Ticket Tier Assignment</label>
            <select
              value={selectedSection.ticketTypeId || ""}
              onChange={(e) => {
                const tt = ticketTypes.find((t) => t.id === e.target.value);
                onUpdateSection({
                  ticketTypeId: e.target.value || undefined,
                  price: tt ? tt.price : selectedSection.price,
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            >
              <option value="">-- Unassigned (Default Price) --</option>
              {ticketTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name} ({tt.price != null ? `$${tt.price}` : "Free"})
                </option>
              ))}
            </select>
          </div>

          {/* Gate / Entry Routing */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Assigned Turnstile Gate</label>
            <input
              type="text"
              value={selectedSection.gateEntrance || ""}
              onChange={(e) => onUpdateSection({ gateEntrance: e.target.value })}
              placeholder="e.g. Turnstile Gate 3 - North Concourse"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Conditional Controls based on Architecture */}
          {isGA && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Standing Capacity Pool
              </span>
              <div>
                <label className="block text-slate-400 mb-1">Max Admitted Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={selectedSection.standingCapacity || 500}
                  onChange={(e) => onUpdateSection({ standingCapacity: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>
            </div>
          )}

          {!isGA && !isTable && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Armchair className="w-4 h-4 text-rose-400" /> Row & Grid Parameters
                </span>
                <button
                  type="button"
                  onClick={() => onOpenPainter(selectedSection)}
                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[10px] border border-rose-500/30 transition-colors flex items-center gap-1"
                >
                  <Grid className="w-3 h-3" /> Matrix Painter
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Row Start</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={selectedSection.rowStart || "A"}
                    onChange={(e) => onUpdateSection({ rowStart: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-center font-bold text-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Row End</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={selectedSection.rowEnd || "J"}
                    onChange={(e) => onUpdateSection({ rowEnd: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-center font-bold text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Seats Per Row</label>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={selectedSection.seatsPerRow || 20}
                  onChange={(e) => onUpdateSection({ seatsPerRow: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              {isCurved && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Inner Radius</label>
                      <input
                        type="number"
                        value={selectedSection.innerRadius || 210}
                        onChange={(e) => onUpdateSection({ innerRadius: parseInt(e.target.value) || 100 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Outer Radius</label>
                      <input
                        type="number"
                        value={selectedSection.outerRadius || 310}
                        onChange={(e) => onUpdateSection({ outerRadius: parseInt(e.target.value) || 200 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Start Angle (°)</label>
                      <input
                        type="number"
                        value={selectedSection.startAngle || 0}
                        onChange={(e) => onUpdateSection({ startAngle: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Sweep Angle (°)</label>
                      <input
                        type="number"
                        value={selectedSection.sweepAngle || 90}
                        onChange={(e) => onUpdateSection({ sweepAngle: parseInt(e.target.value) || 90 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isTable && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Banquet Tables ({selectedSection.tables?.length || 0})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const currentTables = selectedSection.tables || [];
                    const nextNum = currentTables.length + 1;
                    const newTable: BMSTableDefV4 = {
                      id: `tbl_${Date.now()}`,
                      tableNumber: `T-${nextNum < 10 ? `0${nextNum}` : nextNum}`,
                      shape: "round",
                      x: selectedSection.x + (Math.random() * 200 - 100),
                      y: selectedSection.y + (Math.random() * 200 - 100),
                      radius: 45,
                      seatCount: 8,
                    };
                    onUpdateSection({ tables: [...currentTables, newTable] });
                  }}
                  className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-[10px] border border-indigo-500/30 transition-colors"
                >
                  + Add Table
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Ground / Stage Inspector (Default when no section or amenity is selected)
  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col p-4 text-white overflow-y-auto select-none">
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-rose-400" />
          <h3 className="font-bold text-sm">Center Focal Configuration</h3>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Configure the main stage, screen, or pitch orientation.
        </p>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Stage / Pitch Label</label>
          <input
            type="text"
            value={groundConfig.label}
            onChange={(e) => onUpdateGround({ label: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Focal Type</label>
          <select
            value={groundConfig.type}
            onChange={(e) => onUpdateGround({ type: e.target.value as any })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-rose-500"
          >
            <option value="pitch">Sports Field / Turf Pitch</option>
            <option value="screen">Cinema Projection Screen</option>
            <option value="stage">Concert / Theatre Stage</option>
            <option value="runway">Fashion / Gala Runway</option>
            <option value="podium">Keynote / Conference Podium</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Width</label>
            <input
              type="number"
              value={groundConfig.width}
              onChange={(e) => onUpdateGround({ width: Math.max(40, parseInt(e.target.value) || 0) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Height</label>
            <input
              type="number"
              value={groundConfig.height}
              onChange={(e) => onUpdateGround({ height: Math.max(20, parseInt(e.target.value) || 0) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Color Fill</label>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1.5">
            <input
              type="color"
              value={groundConfig.color || "#15803d"}
              onChange={(e) => onUpdateGround({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] text-slate-400 uppercase">{groundConfig.color || "#15803d"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

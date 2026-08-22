"use client";

import { Check } from "lucide-react";

export type EventStepperStepId =
  | "type"
  | "details"
  | "media"
  | "venue"
  | "artists"
  | "documents"
  | "review";

export const EVENT_STEPPER_STEPS: Array<{
  id: EventStepperStepId;
  label: string;
  short: string;
}> = [
  { id: "type", label: "Event type", short: "Type" },
  { id: "details", label: "Event details", short: "Details" },
  { id: "media", label: "Media", short: "Media" },
  { id: "venue", label: "Venue & tickets", short: "Venue" },
  { id: "artists", label: "Artists", short: "Artists" },
  { id: "documents", label: "Documents", short: "Docs" },
  { id: "review", label: "Review", short: "Review" },
];

interface EventStepperNavProps {
  currentId: EventStepperStepId;
  completedIds?: EventStepperStepId[];
  onStepClick?: (id: EventStepperStepId) => void;
  allowJump?: boolean;
}

export default function EventStepperNav({
  currentId,
  completedIds = [],
  onStepClick,
  allowJump = false,
}: EventStepperNavProps) {
  const currentIndex = EVENT_STEPPER_STEPS.findIndex((s) => s.id === currentId);

  return (
    <div className="space-y-3">
      <div className="hidden md:flex items-start gap-0 overflow-x-auto pb-1">
        {EVENT_STEPPER_STEPS.map((step, index) => {
          const done = completedIds.includes(step.id) || index < currentIndex;
          const active = step.id === currentId;
          const clickable = allowJump && (done || index <= currentIndex);
          return (
            <div key={step.id} className="flex items-center min-w-0 flex-1">
              <button
                type="button"
                disabled={!clickable || !onStepClick}
                onClick={() => clickable && onStepClick?.(step.id)}
                className={`flex flex-col items-center gap-2 px-1 w-full ${
                  clickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span
                  className={`h-9 w-9 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-colors ${
                    active
                      ? "border-violet-600 bg-violet-600 text-white"
                      : done
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done && !active ? <Check size={16} /> : index + 1}
                </span>
                <span
                  className={`text-xs font-medium text-center leading-tight ${
                    active ? "text-violet-700" : done ? "text-emerald-700" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {index < EVENT_STEPPER_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-full max-w-[48px] mx-1 mt-[-18px] shrink-0 ${
                    index < currentIndex ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="md:hidden flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
            Step {currentIndex + 1} of {EVENT_STEPPER_STEPS.length}
          </p>
          <p className="text-sm font-semibold text-slate-800">
            {EVENT_STEPPER_STEPS[currentIndex]?.label}
          </p>
        </div>
        <div className="flex gap-1">
          {EVENT_STEPPER_STEPS.map((step, index) => (
            <span
              key={step.id}
              className={`h-1.5 w-4 rounded-full ${
                index <= currentIndex ? "bg-violet-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

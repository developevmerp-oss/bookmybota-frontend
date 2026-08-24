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
  { id: "artists", label: "Lineup", short: "Lineup" },
  { id: "documents", label: "Documents", short: "Docs" },
  { id: "review", label: "Review", short: "Review" },
];

interface EventStepperNavProps {
  currentId: EventStepperStepId;
  /** Steps with properly filled information (green check). */
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
  const completedSet = new Set(completedIds);

  return (
    <div className="space-y-3">
      <div className="hidden md:flex items-start gap-0 overflow-x-auto pb-1">
        {EVENT_STEPPER_STEPS.map((step, index) => {
          const done = completedSet.has(step.id);
          const active = step.id === currentId;
          const clickable = Boolean(allowJump && onStepClick);
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
                      ? done
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-violet-600 bg-violet-600 text-white"
                      : done
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {done ? <Check size={16} strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={`text-xs font-medium text-center leading-tight ${
                    active
                      ? done
                        ? "text-emerald-700"
                        : "text-violet-700"
                      : done
                        ? "text-emerald-700"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {index < EVENT_STEPPER_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-full max-w-[48px] mx-1 mt-[-18px] shrink-0 ${
                    done && completedSet.has(EVENT_STEPPER_STEPS[index + 1].id)
                      ? "bg-emerald-400"
                      : "bg-slate-200"
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
          {completedSet.has(currentId) && (
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Step complete</p>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          {EVENT_STEPPER_STEPS.map((step, index) => {
            const done = completedSet.has(step.id);
            const active = step.id === currentId;
            return (
              <span
                key={step.id}
                title={step.label}
                className={`rounded-full flex items-center justify-center transition-all ${
                  done
                    ? "h-5 w-5 bg-emerald-500 text-white"
                    : active
                      ? "h-2 w-5 bg-violet-600"
                      : "h-1.5 w-4 bg-slate-200"
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

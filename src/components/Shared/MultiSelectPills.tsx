"use client";

type MultiSelectPillsProps = {
  options: Array<{ id: number; name: string; disabled?: boolean }>;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  emptyLabel?: string;
  tone?: "light" | "dark";
};

export default function MultiSelectPills({
  options,
  selectedIds,
  onChange,
  emptyLabel = "No options available yet.",
  tone = "light",
}: MultiSelectPillsProps) {
  if (!options.length) {
    return <p className={tone === "light" ? "text-xs text-slate-400" : "text-xs text-zinc-500"}>{emptyLabel}</p>;
  }

  const activeClass =
    tone === "light"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40";
  const idleClass =
    tone === "light"
      ? "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      : "text-zinc-400 border-white/10 hover:bg-white/5 hover:text-white";

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        const disabled = option.disabled;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(
                selected ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id]
              );
            }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selected ? activeClass : idleClass
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export function namesFromMasterIds(
  masters: Array<{ id: number; name: string }>,
  selectedIds: number[]
): string[] {
  const byId = new Map(masters.map((item) => [item.id, item.name]));
  return selectedIds.map((id) => byId.get(id)).filter((name): name is string => Boolean(name));
}

export function idsFromMasterNames(
  masters: Array<{ id: number; name: string }>,
  names: string[] | undefined | null
): number[] {
  if (!names?.length) return [];
  const byName = new Map(masters.map((item) => [item.name.toLowerCase(), item.id]));
  return names
    .map((name) => byName.get(String(name).trim().toLowerCase()))
    .filter((id): id is number => typeof id === "number");
}

export function orphanMasterNames(
  masters: Array<{ id: number; name: string }>,
  names: string[] | undefined | null
): string[] {
  if (!names?.length) return [];
  const known = new Set(masters.map((item) => item.name.toLowerCase()));
  return names.filter((name) => !known.has(String(name).trim().toLowerCase()));
}

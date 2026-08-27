export type EventStepperStepId =
  | "type"
  | "details"
  | "sport"
  | "media"
  | "venue"
  | "artists"
  | "documents"
  | "review";

export type EventCategorySlug = "comedy" | "music" | "concert" | "sports" | string;

export type SportMatchFormat = "league" | "knockout" | "friendly";
export type SportGenderCategory = "open" | "men" | "women" | "mixed";

export type SportMeta = {
  home_team?: string;
  away_team?: string;
  tournament_name?: string;
  match_format?: SportMatchFormat | "";
  gender_category?: SportGenderCategory | "";
  /** Sport-specific extras (overs, quarters, period minutes, notes, …). */
  extras?: Record<string, string>;
};

export type EventCategoryMeta = {
  sport?: SportMeta;
  [key: string]: unknown;
};

export type SportExtraFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number";
};

export type EventStepperStepDef = {
  id: EventStepperStepId;
  label: string;
  short: string;
};

const DEFAULT_STEPS: EventStepperStepDef[] = [
  { id: "type", label: "Event type", short: "Type" },
  { id: "details", label: "Event details", short: "Details" },
  { id: "media", label: "Media", short: "Media" },
  { id: "venue", label: "Venue & tickets", short: "Venue" },
  { id: "artists", label: "Lineup", short: "Lineup" },
  { id: "documents", label: "Documents", short: "Docs" },
  { id: "review", label: "Review", short: "Review" },
];

const SPORT_STEPS: EventStepperStepDef[] = [
  { id: "type", label: "Event type", short: "Type" },
  { id: "details", label: "Event details", short: "Details" },
  { id: "sport", label: "Sport details", short: "Sport" },
  { id: "media", label: "Media", short: "Media" },
  { id: "venue", label: "Venue & tickets", short: "Venue" },
  { id: "artists", label: "Teams / players", short: "Teams" },
  { id: "documents", label: "Documents", short: "Docs" },
  { id: "review", label: "Review", short: "Review" },
];

export function isSportsCategory(slug?: string | null): boolean {
  return String(slug || "").toLowerCase() === "sports";
}

export function getEventStepperSteps(categorySlug?: string | null): EventStepperStepDef[] {
  return isSportsCategory(categorySlug) ? SPORT_STEPS : DEFAULT_STEPS;
}

export function getSportExtraFields(sportGenre?: string | null): SportExtraFieldDef[] {
  const g = String(sportGenre || "").trim().toLowerCase();
  if (g === "football") {
    return [
      { key: "period_minutes", label: "Minutes per half", placeholder: "e.g. 45", type: "number" },
      { key: "halves", label: "Number of halves", placeholder: "e.g. 2", type: "number" },
    ];
  }
  if (g === "cricket") {
    return [
      { key: "overs", label: "Overs", placeholder: "e.g. 20 or 50", type: "number" },
      { key: "format_notes", label: "Format notes", placeholder: "T20 / ODI / Test", type: "text" },
    ];
  }
  if (g === "basketball") {
    return [
      { key: "quarters", label: "Number of quarters", placeholder: "e.g. 4", type: "number" },
      { key: "quarter_minutes", label: "Minutes per quarter", placeholder: "e.g. 12", type: "number" },
    ];
  }
  if (g === "tennis") {
    return [
      { key: "best_of", label: "Best of sets", placeholder: "e.g. 3 or 5", type: "number" },
      { key: "surface", label: "Court surface", placeholder: "Hard / Clay / Grass", type: "text" },
    ];
  }
  if (g === "athletics") {
    return [
      { key: "discipline", label: "Discipline / event", placeholder: "e.g. 100m, Marathon", type: "text" },
      { key: "notes", label: "Additional notes", placeholder: "Optional details", type: "text" },
    ];
  }
  return [{ key: "notes", label: "Additional sport notes", placeholder: "Optional details", type: "text" }];
}

export function defaultSportMeta(): SportMeta {
  return {
    home_team: "",
    away_team: "",
    tournament_name: "",
    match_format: "",
    gender_category: "",
    extras: {},
  };
}

export function getSportMeta(meta?: EventCategoryMeta | null): SportMeta {
  const sport = meta?.sport;
  if (!sport || typeof sport !== "object") return defaultSportMeta();
  return {
    ...defaultSportMeta(),
    ...sport,
    extras: sport.extras && typeof sport.extras === "object" ? { ...sport.extras } : {},
  };
}

export function isSportMetaComplete(meta?: EventCategoryMeta | null): boolean {
  const sport = getSportMeta(meta);
  return Boolean(sport.home_team?.trim() && sport.away_team?.trim());
}

export const SPORT_MATCH_FORMATS: Array<{ id: SportMatchFormat; label: string }> = [
  { id: "league", label: "League" },
  { id: "knockout", label: "Knockout" },
  { id: "friendly", label: "Friendly" },
];

export const SPORT_GENDER_CATEGORIES: Array<{ id: SportGenderCategory; label: string }> = [
  { id: "open", label: "Open" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "mixed", label: "Mixed" },
];

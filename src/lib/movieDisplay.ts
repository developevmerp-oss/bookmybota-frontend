/** True only for real admin-promoted flags (avoids Boolean("false") / loose truthiness). */
export function isMoviePromoted(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "t" || v === "yes";
  }
  return false;
}

/** Display helpers for movie card UI (no API changes). */

export function parseLanguageList(value?: string | string[] | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((l) => String(l).trim()).filter(Boolean);
  }
  return value
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** One language as-is; multiple → "English and 2 more". */
export function formatLanguageSummary(languages: string[]): string {
  if (languages.length === 0) return "";
  if (languages.length === 1) return languages[0];
  return `${languages[0]} and ${languages.length - 1} more`;
}

/** "UA 16+ | Hindi" or "A | English and 1 more" */
export function formatMovieCardMeta(
  certification?: string | null,
  languages?: string | string[] | null
): string {
  const lang = formatLanguageSummary(parseLanguageList(languages));
  return [certification?.trim() || "", lang].filter(Boolean).join(" | ");
}

/** "Mirzapur: The Movie (2026)" — skips a duplicate year if the title already has one. */
export function formatMovieCardTitle(title: string, yearOrDate?: string | null): string {
  const raw = title.trim();
  if (!yearOrDate) return raw;
  const year = /^\d{4}$/.test(yearOrDate)
    ? yearOrDate
    : (() => {
        const d = new Date(yearOrDate);
        return Number.isNaN(d.getTime()) ? "" : String(d.getFullYear());
      })();
  if (!year) return raw;
  if (/\(\d{4}\)\s*$/.test(raw)) return raw;
  return `${raw} (${year})`;
}

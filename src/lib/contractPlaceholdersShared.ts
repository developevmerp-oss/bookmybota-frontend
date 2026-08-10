export const CONTRACT_DYNAMIC_FIELDS = [
  { label: 'Event Name', token: 'eventName' },
  { label: 'Organizer Name', token: 'organizerName' },
  { label: 'Category', token: 'categoryName' },
  { label: 'Contract Number', token: 'contractNumber' },
  { label: 'Convenience Fee %', token: 'convenienceFeePercent' },
  { label: 'Commission %', token: 'commissionPercent' },
  { label: 'Venue Name', token: 'venueName' },
  { label: 'Venue Address', token: 'venueAddress' },
  { label: 'Event Date', token: 'eventDate' },
  { label: 'Language', token: 'language' },
  { label: 'Age Group', token: 'ageGroup' },
  { label: 'Duration (minutes)', token: 'durationMinutes' },
  { label: 'Genres', token: 'genres' },
  { label: 'Ticket Summary', token: 'ticketSummary' },
  { label: 'Platform Name', token: 'platformName' },
] as const;

export type ContractDynamicData = Record<string, string | number>;

const TOKEN_CHIP_CLASS = 'contract-token-chip';

/** Convert stored HTML with {{tokens}} into visual chips for the editor */
export function htmlWithTokenChips(html: string): string {
  if (!html) return '';
  return html.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const field = CONTRACT_DYNAMIC_FIELDS.find((f) => f.token === token);
    const label = field?.label ?? token;
    return `<span class="${TOKEN_CHIP_CLASS}" data-token="${token}" contenteditable="false">${label}</span>`;
  });
}

/** Convert editor HTML back to {{token}} placeholders for storage */
export function htmlFromTokenChips(html: string): string {
  if (!html) return '';
  let out = html.replace(
    new RegExp(`<span[^>]*class="[^"]*${TOKEN_CHIP_CLASS}[^"]*"[^>]*data-token="(\\w+)"[^>]*>[^<]*</span>`, 'gi'),
    (_, token: string) => `{{${token}}}`
  );
  out = out.replace(/\{\{(\w+)\}\}/g, '{{$1}}');
  return out;
}

export function replaceContractPlaceholders(
  html: string,
  data: Record<string, string | number | null | undefined>
): string {
  if (!html) return '';
  const normalized = htmlFromTokenChips(html);
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = data[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

/** Preview: replace tokens with styled value chips (not raw {{tags}}) */
export function htmlWithMergedValues(
  html: string,
  data: Record<string, string | number | null | undefined>
): string {
  if (!html) return '';
  const normalized = htmlFromTokenChips(html);
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = data[key];
    const display = val === undefined || val === null || val === '' ? '—' : String(val);
    const field = CONTRACT_DYNAMIC_FIELDS.find((f) => f.token === key);
    const label = field?.label ?? key;
    return `<span class="contract-value-chip" title="${label}">${display}</span>`;
  });
}

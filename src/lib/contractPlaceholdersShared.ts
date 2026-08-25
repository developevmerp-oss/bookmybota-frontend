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

/** Default written-document body (paragraph style, EVM Care–like). */
export const DEFAULT_CONTRACT_BODY = `<p><strong>This Agreement.</strong> This Event Platform Agreement is entered into between {{platformName}} ("Platform") and {{organizerName}} ("Organizer") for the event titled {{eventName}}.</p>
<p><strong>Event details.</strong> The event is listed under the category {{categoryName}}, will be presented in {{language}}, and is intended for the age group {{ageGroup}}. The approximate duration is {{durationMinutes}} minutes. Genres associated with this event include {{genres}}. The venue is {{venueName}}, located at {{venueAddress}}. The scheduled event date and time is {{eventDate}}.</p>
<p><strong>Commercial terms.</strong> The Platform shall charge a customer convenience fee of {{convenienceFeePercent}}% and an organizer commission of {{commissionPercent}}%. Ticket types and inventory for this event are as follows: {{ticketSummary}}. The contract reference number for this agreement is {{contractNumber}}.</p>
<p><strong>Execution.</strong> Both parties agree to the terms above. The event will be listed publicly only after both signatures are recorded.</p>`;

/** Older contracts used a vertical bullet list of fields. */
export function isLegacyListContractBody(html: string): boolean {
  if (!html) return false;
  const normalized = htmlFromTokenChips(html);
  return (
    /<ul[\s>]/i.test(normalized) &&
    /Category\s*:/i.test(normalized) &&
    /Commercial terms/i.test(normalized)
  );
}

function valueChip(
  data: Record<string, string | number | null | undefined>,
  key: string
): string {
  const val = data[key];
  const display = val === undefined || val === null || val === '' ? '—' : String(val);
  const field = CONTRACT_DYNAMIC_FIELDS.find((f) => f.token === key);
  const label = field?.label ?? key;
  return `<span class="contract-value-chip" title="${label}">${display}</span>`;
}

/** Written-document HTML from dynamic values (paragraph rows, not a field list). */
export function buildProseContractHtml(
  data: Record<string, string | number | null | undefined>
): string {
  const v = (key: string) => valueChip(data, key);
  return `<p><strong>This Agreement.</strong> This Event Platform Agreement is entered into between ${v('platformName')} ("Platform") and ${v('organizerName')} ("Organizer") for the event titled ${v('eventName')}.</p>
<p><strong>Event details.</strong> The event is listed under the category ${v('categoryName')}, will be presented in ${v('language')}, and is intended for the age group ${v('ageGroup')}. The approximate duration is ${v('durationMinutes')} minutes. Genres associated with this event include ${v('genres')}. The venue is ${v('venueName')}, located at ${v('venueAddress')}. The scheduled event date and time is ${v('eventDate')}.</p>
<p><strong>Commercial terms.</strong> The Platform shall charge a customer convenience fee of ${v('convenienceFeePercent')}% and an organizer commission of ${v('commissionPercent')}%. Ticket types and inventory for this event are as follows: ${v('ticketSummary')}. The contract reference number for this agreement is ${v('contractNumber')}.</p>
<p><strong>Execution.</strong> Both parties agree to the terms above. The event will be listed publicly only after both signatures are recorded.</p>`;
}

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

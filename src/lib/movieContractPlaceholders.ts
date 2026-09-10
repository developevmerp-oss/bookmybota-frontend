export const MOVIE_CONTRACT_DYNAMIC_FIELDS = [
  { label: 'Cinema Name', token: 'cinemaName' },
  { label: 'Cinema Admin Name', token: 'cinemaAdminName' },
  { label: 'Cinema Address', token: 'cinemaAddress' },
  { label: 'Cinema Phone', token: 'cinemaPhone' },
  { label: 'Contract Number', token: 'contractNumber' },
  { label: 'Convenience Fee %', token: 'convenienceFeePercent' },
  { label: 'Commission %', token: 'commissionPercent' },
  { label: 'Total Screens', token: 'totalScreens' },
  { label: 'Platform Name', token: 'platformName' },
  { label: 'Contract Date', token: 'contractDate' },
] as const;

export const DEFAULT_MOVIE_CONTRACT_BODY = `<p><strong>This Agreement.</strong> This Cinema Platform Agreement ("Agreement") is entered into between {{platformName}} ("Platform") and {{cinemaName}} ("Cinema Partner") as of {{contractDate}}.</p>
<p><strong>Cinema Details.</strong> Cinema Name: {{cinemaName}}. Authorized Representative: {{cinemaAdminName}}. Address: {{cinemaAddress}}. Contact: {{cinemaPhone}}. Total Screens registered on the Platform: {{totalScreens}}.</p>
<p><strong>Commercial Terms.</strong> The Platform shall charge a customer convenience fee of {{convenienceFeePercent}}% per ticket and deduct an operator commission of {{commissionPercent}}% from box-office proceeds. Payouts will be processed on a weekly basis for all completed showtimes.</p>
<p><strong>Obligations of the Cinema Partner.</strong> The Cinema Partner agrees to (a) maintain accurate and up-to-date showtime schedules, (b) honour all tickets sold through the Platform, (c) not discriminate between Platform-sold and walk-in tickets, and (d) promptly notify the Platform of any showtime cancellations or changes.</p>
<p><strong>Obligations of the Platform.</strong> The Platform agrees to (a) process bookings securely and issue digital M-Tickets, (b) remit net proceeds to the Cinema Partner after deducting the agreed commission, and (c) provide customer support for Platform-related issues.</p>
<p><strong>Term.</strong> This Agreement shall remain in effect for twelve (12) months from the date of activation and shall automatically renew unless terminated by either party with thirty (30) days written notice.</p>
<p><strong>Execution.</strong> Both parties confirm they have read and agree to the terms above. The Cinema Partner's showtimes will be listed publicly only after both signatures are recorded and the contract status is ACTIVE.</p>
<p>Contract Reference: {{contractNumber}}</p>`;

export interface MovieContractRecord {
  id: string;
  business_id: string;
  contract_number: string;
  body_html: string;
  terms_and_conditions?: string | null;
  status: 'PENDING_SIGNATURES' | 'ACTIVE' | 'REJECTED';
  convenience_fee_percent: number | string;
  commission_percent: number | string;
  dynamic_data?: Record<string, string | number> | null;
  admin_signed_at?: string | null;
  cinema_signed_at?: string | null;
  admin_signature_url?: string | null;
  cinema_signature_url?: string | null;
  rejection_reason?: string | null;
  cinema_name?: string;
  cinema_phone?: string;
  created_at?: string;
  updated_at?: string;
}

export function replaceMovieContractPlaceholders(
  html: string,
  data: Record<string, string | number | undefined | null>
): string {
  if (!html) return '';
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => {
    const v = data[token];
    if (v === undefined || v === null || v === '') return `[${token}]`;
    return String(v);
  });
}

export function mergeMovieContractHtml(contract: MovieContractRecord): string {
  const dynamic = contract.dynamic_data || {};
  const data: Record<string, string | number> = {
    ...dynamic,
    commissionPercent: dynamic.commissionPercent ?? contract.commission_percent,
    convenienceFeePercent: dynamic.convenienceFeePercent ?? contract.convenience_fee_percent,
    contractNumber: dynamic.contractNumber ?? contract.contract_number,
    cinemaName: dynamic.cinemaName ?? contract.cinema_name ?? 'Cinema Partner',
    platformName: dynamic.platformName ?? 'BookMyBota',
  };

  const body = contract.body_html || DEFAULT_MOVIE_CONTRACT_BODY;
  return replaceMovieContractPlaceholders(body, data);
}

export function movieContractStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_SIGNATURES':
      return 'Awaiting signatures';
    case 'ACTIVE':
      return 'Active — Cinema is Live';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

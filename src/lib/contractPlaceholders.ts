import {
  CONTRACT_DYNAMIC_FIELDS,
  replaceContractPlaceholders,
  htmlWithMergedValues,
} from './contractPlaceholdersShared';

export { CONTRACT_DYNAMIC_FIELDS, replaceContractPlaceholders, htmlWithMergedValues };
export type { ContractDynamicData } from './contractPlaceholdersShared';

export interface EventContractRecord {
  id: string;
  event_id: string;
  contract_number: string;
  body_html: string;
  terms_and_conditions?: string | null;
  status: 'PENDING_SIGNATURES' | 'ACTIVE' | 'REJECTED';
  convenience_fee_percent: number | string;
  commission_percent: number | string;
  dynamic_data?: Record<string, string | number> | null;
  admin_signed_at?: string | null;
  organizer_signed_at?: string | null;
  rejection_reason?: string | null;
  event_name?: string;
  organizer_name?: string;
}

export function mergeContractHtml(contract: EventContractRecord): string {
  const data = {
    ...(contract.dynamic_data || {}),
    commissionPercent: contract.dynamic_data?.commissionPercent ?? contract.commission_percent,
    convenienceFeePercent: contract.dynamic_data?.convenienceFeePercent ?? contract.convenience_fee_percent,
    contractNumber: contract.dynamic_data?.contractNumber ?? contract.contract_number,
  };
  return htmlWithMergedValues(contract.body_html, data);
}

export function contractStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_SIGNATURES':
      return 'Awaiting signatures';
    case 'ACTIVE':
      return 'Active — event is public';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

export function organizerWorkflowLabel(event: {
  status: string;
  is_visible?: boolean;
  contract?: {
    status: string;
    admin_signed_at?: string | null;
    organizer_signed_at?: string | null;
  } | null;
}): string {
  if (event.contract?.status === 'ACTIVE' && event.is_visible) return 'Public';
  if (event.status === 'DRAFT') return 'Draft';
  if (event.status === 'PENDING_APPROVAL') return 'Awaiting Super Admin review';
  if (event.status === 'CLOSED') return 'Closed';
  if (!event.contract || event.contract.status === 'REJECTED') {
    return event.contract?.status === 'REJECTED'
      ? 'Contract rejected'
      : 'Waiting for contract';
  }
  if (event.contract.status === 'PENDING_SIGNATURES') {
    if (!event.contract.organizer_signed_at) return 'Sign contract';
    if (!event.contract.admin_signed_at) return 'Awaiting Super Admin signature';
    return 'Awaiting signatures';
  }
  return event.status.replace(/_/g, ' ');
}

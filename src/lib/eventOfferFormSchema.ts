import * as yup from 'yup';

export type EventOfferApplyTo = 'THIS_EVENT' | 'SELECTED_EVENTS' | 'ALL_MY_EVENTS';
export type EventOfferStatus = 'DRAFT' | 'ACTIVE';

export type EventOfferFormValues = {
  apply_to: EventOfferApplyTo;
  eventId: string;
  event_ids: string[];
  title: string;
  promo_code: string;
  description: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: string;
  min_booking_amount: string;
  usage_limit: string;
  per_customer_limit: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  status: EventOfferStatus;
  sort_order: string;
};

/** Yup schema for the Event Admin Offers create/edit panel only. */
export function buildEventOfferFormSchema(earliestEventStart: string) {
  return yup.object({
    apply_to: yup
      .mixed<EventOfferApplyTo>()
      .oneOf(['THIS_EVENT', 'SELECTED_EVENTS', 'ALL_MY_EVENTS'])
      .required('Choose where this offer applies.'),
    eventId: yup.string().trim().default(''),
    event_ids: yup
      .array()
      .of(yup.string().required())
      .default([])
      .test('events-required', 'Select at least one event.', function (value) {
        const applyTo = this.parent.apply_to as EventOfferApplyTo;
        if (applyTo === 'ALL_MY_EVENTS') return true;
        if (applyTo === 'THIS_EVENT') {
          return Boolean(this.parent.eventId);
        }
        return Array.isArray(value) && value.length > 0;
      }),
    title: yup
      .string()
      .trim()
      .required('Offer name is required.')
      .min(2, 'Offer name must be at least 2 characters.'),
    promo_code: yup
      .string()
      .trim()
      .required('Offer code is required.')
      .min(2, 'Offer code must be at least 2 characters.'),
    description: yup.string().trim().default(''),
    discount_type: yup
      .mixed<'PERCENT' | 'FLAT'>()
      .oneOf(['PERCENT', 'FLAT'])
      .required('Discount type is required.'),
    discount_value: yup
      .string()
      .required('Discount value is required.')
      .test('positive-number', 'Enter a discount value greater than 0.', (value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0;
      })
      .test('percent-max', 'Percent discount cannot exceed 100.', function (value) {
        const type = this.parent.discount_type as string;
        if (type !== 'PERCENT') return true;
        const n = Number(value);
        return Number.isFinite(n) && n <= 100;
      }),
    min_booking_amount: yup
      .string()
      .default('0')
      .test('min-booking', 'Minimum booking amount must be 0 or greater.', (value) => {
        if (value === '' || value == null) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0;
      }),
    usage_limit: yup
      .string()
      .default('')
      .test('usage-limit', 'Total usage limit must be at least 1 when set.', (value) => {
        if (!value) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 1;
      }),
    per_customer_limit: yup
      .string()
      .default('')
      .test('per-customer', 'Per customer limit must be at least 1 when set.', (value) => {
        if (!value) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 1;
      }),
    start_date: yup
      .string()
      .required('Start date is required.')
      .test('before-event-from', function (value) {
        if (!value || !earliestEventStart) return true;
        if (value >= earliestEventStart) {
          return this.createError({
            message: `Start date must be before the event date (${earliestEventStart}).`,
          });
        }
        return true;
      }),
    start_time: yup.string().default(''),
    end_date: yup
      .string()
      .required('End date is required.')
      .test('after-from', 'End date must be on or after start date.', function (value) {
        const from = String(this.parent.start_date || '');
        if (!value || !from) return true;
        if (value > from) return true;
        if (value < from) return false;
        const startTime = String(this.parent.start_time || '00:00');
        const endTime = String(this.parent.end_time || '23:59');
        return endTime >= startTime;
      })
      .test('before-event-until', function (value) {
        if (!value || !earliestEventStart) return true;
        if (value >= earliestEventStart) {
          return this.createError({
            message: `End date must be before the event date (${earliestEventStart}).`,
          });
        }
        return true;
      }),
    end_time: yup.string().default(''),
    status: yup.mixed<EventOfferStatus>().oneOf(['DRAFT', 'ACTIVE']).required(),
    sort_order: yup
      .string()
      .default('0')
      .test('sort-order', 'Sort order must be 0 or greater.', (value) => {
        if (value === '' || value == null) return true;
        const n = Number(value);
        return Number.isFinite(n) && n >= 0;
      }),
  });
}

export const emptyEventOfferFormValues = (eventId = ''): EventOfferFormValues => ({
  apply_to: 'THIS_EVENT',
  eventId,
  event_ids: eventId ? [eventId] : [],
  title: '',
  promo_code: '',
  description: '',
  discount_type: 'PERCENT',
  discount_value: '',
  min_booking_amount: '0',
  usage_limit: '',
  per_customer_limit: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  status: 'DRAFT',
  sort_order: '0',
});

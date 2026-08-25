import * as yup from 'yup';

export type EventOfferFormValues = {
  eventId: string;
  title: string;
  description: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: string;
  promo_code: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
};

/** Yup schema for the Event Admin Offers create/edit panel only. */
export function buildEventOfferFormSchema(eventStartDate: string) {
  return yup.object({
    eventId: yup.string().trim().required('Select an event.'),
    title: yup
      .string()
      .trim()
      .required('Offer title is required.')
      .min(2, 'Title must be at least 2 characters.'),
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
    promo_code: yup.string().trim().default(''),
    valid_from: yup
      .string()
      .default('')
      .test('before-event-from', function (value) {
        if (!value || !eventStartDate) return true;
        if (value >= eventStartDate) {
          return this.createError({
            message: `Valid from must be before the event date (${eventStartDate}).`,
          });
        }
        return true;
      }),
    valid_until: yup
      .string()
      .required('Valid until date is required.')
      .test('after-from', 'Valid until must be on or after valid from.', function (value) {
        const from = String(this.parent.valid_from || '');
        if (!value || !from) return true;
        return value >= from;
      })
      .test('before-event-until', function (value) {
        if (!value || !eventStartDate) return true;
        if (value >= eventStartDate) {
          return this.createError({
            message: `Valid until must be before the event date (${eventStartDate}).`,
          });
        }
        return true;
      }),
    is_active: yup.boolean().default(true),
  });
}

export const emptyEventOfferFormValues = (eventId = ''): EventOfferFormValues => ({
  eventId,
  title: '',
  description: '',
  discount_type: 'PERCENT',
  discount_value: '',
  promo_code: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
});

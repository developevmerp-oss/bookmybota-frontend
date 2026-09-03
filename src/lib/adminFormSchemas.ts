import * as yup from 'yup';
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  sanitizePhoneInput,
  isValidPassword,
  PASSWORD_RULES,
} from '@/lib/validation';

/** Shared phone field: digits only, 9–12 characters allowed while typing & on submit */
export const adminPhoneSchema = yup
  .string()
  .required('Phone number is required.')
  .transform((value) => sanitizePhoneInput(String(value ?? '')))
  .test(
    'phone-digits',
    `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`,
    (value) => {
      const digits = String(value ?? '');
      return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    }
  );

export const adminProfileSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Full name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  phone: adminPhoneSchema,
});

export const adminChangePasswordSchema = yup.object({
  current_password: yup.string().required('Current password is required.'),
  new_password: yup
    .string()
    .required('New password is required.')
    .test(
      'password-rules',
      () => `Password must include: ${PASSWORD_RULES.map((r) => r.label).join('; ')}`,
      (value) => isValidPassword(String(value ?? ''))
    )
    .test(
      'different-from-current',
      'New password must be different from your current password.',
      function (value) {
        const { current_password } = this.parent as { current_password?: string };
        return !value || !current_password || value !== current_password;
      }
    ),
  confirm_password: yup
    .string()
    .required('Please confirm your new password.')
    .oneOf([yup.ref('new_password')], 'New password and confirmation do not match.'),
});

export const adminCustomerFormSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  phone: adminPhoneSchema,
  email: yup
    .string()
    .trim()
    .required('Email is required.')
    .email('Enter a valid email address.'),
});

export const partnerOnboardSchema = yup.object({
  business_name: yup
    .string()
    .trim()
    .required('Name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  address: yup.string().trim().required('Address is required.'),
  phone: adminPhoneSchema,
  description: yup.string().trim().default(''),
  parent_type_id: yup.string().required('Please select a parent type.'),
  venue_type_id: yup.string().default(''),
  country: yup.string().default(''),
  city_id: yup.string().default(''),
  admin_email: yup
    .string()
    .trim()
    .required('Admin email is required.')
    .email('Enter a valid email address.'),
  accept_terms: yup.boolean().default(false),
});

export const adminCityCreateSchema = yup.object({
  name: yup.string().trim().required('City name is required.'),
  state: yup.string().trim().default(''),
  country: yup.string().required('Please select a country.'),
  icon_url: yup.string().trim().default(''),
  is_popular: yup.boolean().default(false),
});

export const adminNamedItemSchema = yup.object({
  name: yup.string().trim().required('Name is required.'),
  description: yup.string().trim().default(''),
});

export const adminCuisineCreateSchema = yup.object({
  name: yup.string().trim().required('Cuisine name is required.'),
  image_url: yup.string().trim().required('Cuisine image is required.'),
});

export const adminCollectionCreateSchema = yup.object({
  title: yup.string().trim().required('Collection title is required.'),
  subtitle: yup.string().trim().default(''),
  image_url: yup.string().trim().default(''),
});

export const adminMarketingPlanSchema = yup.object({
  name: yup.string().trim().required('Plan name is required.'),
  duration_days: yup
    .number()
    .typeError('Duration must be a number.')
    .required('Duration is required.')
    .min(1, 'Duration must be at least 1 day.'),
  price: yup
    .number()
    .typeError('Price must be a number.')
    .required('Price is required.')
    .min(0, 'Price cannot be negative.'),
});

export const adminMarketingCampaignSchema = yup.object({
  businessId: yup.string().required('Please select a business.'),
  plan_id: yup.string().required('Please select a plan.'),
});

export const adminPayoutSchema = yup.object({
  business_id: yup.string().required('Select an event organizer.'),
  event_id: yup.string().default(''),
  amount: yup
    .number()
    .typeError('Enter a valid amount.')
    .required('Amount is required.')
    .positive('Enter a valid amount.'),
  status: yup.mixed<'PAID' | 'PENDING'>().oneOf(['PAID', 'PENDING']).required(),
  payment_reference: yup.string().trim().default(''),
  notes: yup.string().trim().default(''),
});

export const adminPartnerDocumentCreateSchema = yup.object({
  name: yup.string().trim().required('Document name is required.'),
  description: yup.string().trim().default(''),
  module: yup
    .mixed<'both' | 'dining' | 'event' | 'venue' | 'artist'>()
    .oneOf(['both', 'dining', 'event', 'venue', 'artist'])
    .required(),
  is_required: yup.boolean().default(false),
});

export const adminPartnerTermCreateSchema = yup.object({
  text: yup.string().trim().required('Term text is required.'),
  module: yup
    .mixed<'both' | 'dining' | 'event' | 'venue' | 'artist'>()
    .oneOf(['both', 'dining', 'event', 'venue', 'artist'])
    .required(),
});

export const adminEventGenreCreateSchema = yup.object({
  category_type_id: yup.string().required('Please select a category.'),
  name: yup.string().trim().required('Genre name is required.'),
});
export type AdminEventGenreCreateValues = yup.InferType<typeof adminEventGenreCreateSchema>;

export const adminPlatformOfferSchema = yup.object({
  name: yup.string().trim().required('Offer name is required.'),
  code: yup.string().trim().required('Offer code is required.'),
  description: yup.string().trim().default(''),
  discount_type: yup.mixed<'PERCENT' | 'FLAT'>().oneOf(['PERCENT', 'FLAT']).required(),
  discount_value: yup
    .number()
    .typeError('Value is required.')
    .required('Value is required.')
    .min(0, 'Value cannot be negative.'),
  max_discount: yup.string().default(''),
  min_order_amount: yup.string().default('0'),
  category: yup.mixed<'ALL' | 'EVENTS' | 'DINING' | 'MOVIES'>().oneOf(['ALL', 'EVENTS', 'DINING', 'MOVIES']).required(),
  apply_to: yup
    .mixed<'ENTIRE_CATEGORY' | 'SELECTED_ITEMS'>()
    .oneOf(['ENTIRE_CATEGORY', 'SELECTED_ITEMS'])
    .required(),
  customer_eligibility: yup
    .mixed<'ALL' | 'NEW' | 'EXISTING'>()
    .oneOf(['ALL', 'NEW', 'EXISTING'])
    .required(),
  usage_limit: yup.string().default(''),
  per_user_limit: yup.string().default('1'),
  start_at: yup.string().default(''),
  end_at: yup.string().default(''),
  status: yup.string().required(),
  display_theme: yup.string().default('magenta'),
  sort_order: yup.string().default('0'),
  event_ids: yup.array().of(yup.string().required()).default([]),
  restaurant_ids: yup.array().of(yup.string().required()).default([]),
  movie_ids: yup.array().of(yup.string().required()).default([]),
});
export type AdminPlatformOfferValues = yup.InferType<typeof adminPlatformOfferSchema>;

export const adminEventDocumentCreateSchema = yup.object({
  name: yup.string().trim().required('Document name is required.'),
  description: yup.string().trim().default(''),
  category_type_id: yup.string().default(''),
  applies_to: yup.string().oneOf(['event', 'venue', 'artist']).default('event'),
  is_required: yup.boolean().default(false),
  importance_level: yup.number().default(3),
});
export type AdminEventDocumentCreateValues = yup.InferType<typeof adminEventDocumentCreateSchema>;

export const adminEventTermCreateSchema = yup.object({
  text: yup.string().trim().required('Enter a terms & conditions point'),
});
export type AdminEventTermCreateValues = yup.InferType<typeof adminEventTermCreateSchema>;

export const adminEventContractCreateSchema = yup.object({
  event_id: yup.string().required('Select an event.'),
  body_html: yup.string().trim().required('Enter contract content.'),
  terms: yup.string().trim().default(''),
  convenience_fee: yup.string().trim().required('Convenience fee is required.'),
  commission: yup.string().trim().required('Commission is required.'),
});
export type AdminEventContractCreateValues = yup.InferType<typeof adminEventContractCreateSchema>;

export const adminCustomerEditSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Name is required.')
    .min(2, 'Name must be at least 2 characters.'),
  phone: adminPhoneSchema,
  email: yup
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : v))
    .email('Enter a valid email address.')
    .optional(),
});

export type AdminProfileValues = yup.InferType<typeof adminProfileSchema>;
export type AdminChangePasswordValues = yup.InferType<typeof adminChangePasswordSchema>;
export type AdminCustomerFormValues = yup.InferType<typeof adminCustomerFormSchema>;
export type AdminCustomerEditValues = yup.InferType<typeof adminCustomerEditSchema>;
export type PartnerOnboardValues = yup.InferType<typeof partnerOnboardSchema>;
export type AdminCityCreateValues = yup.InferType<typeof adminCityCreateSchema>;
export type AdminCuisineCreateValues = yup.InferType<typeof adminCuisineCreateSchema>;
export type AdminCollectionCreateValues = yup.InferType<typeof adminCollectionCreateSchema>;
export type AdminMarketingPlanValues = yup.InferType<typeof adminMarketingPlanSchema>;
export type AdminMarketingCampaignValues = yup.InferType<typeof adminMarketingCampaignSchema>;
export type AdminPayoutValues = yup.InferType<typeof adminPayoutSchema>;
export type AdminPartnerDocumentCreateValues = yup.InferType<typeof adminPartnerDocumentCreateSchema>;
export type AdminPartnerTermCreateValues = yup.InferType<typeof adminPartnerTermCreateSchema>;
export const adminMovieMasterCreateSchema = yup.object({
  name: yup.string().trim().required('Name is required.'),
  description: yup.string().trim().optional(),
});

export type AdminMovieMasterCreateValues = yup.InferType<typeof adminMovieMasterCreateSchema>;

export const adminMovieMasterFormSchema = yup.object({
  name: yup.string().trim().required('Name is required.'),
  description: yup.string().trim().optional(),
  sort_order: yup
    .number()
    .typeError('Sort order must be a number.')
    .integer('Sort order must be a whole number.')
    .min(0, 'Sort order cannot be negative.')
    .default(0),
  is_active: yup.boolean().default(true),
});

export type AdminMovieMasterFormValues = yup.InferType<typeof adminMovieMasterFormSchema>;

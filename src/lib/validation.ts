/** Shared phone & password validation — use on frontend and mirror on backend */

export const PHONE_MIN_DIGITS = 9;
export const PHONE_MAX_DIGITS = 12;

/** Strip non-digits and cap length */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

export function isValidPhone(phone: string): boolean {
  const digits = sanitizePhoneInput(phone);
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

export function getPhoneValidationError(phone: string): string | null {
  const digits = sanitizePhoneInput(phone);
  if (!digits) return 'Phone number is required.';
  if (digits.length < PHONE_MIN_DIGITS) {
    return `Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only).`;
  }
  if (digits.length > PHONE_MAX_DIGITS) {
    return `Phone must be at most ${PHONE_MAX_DIGITS} digits.`;
  }
  if (/\D/.test(phone.replace(/\s/g, ''))) {
    return 'Only numbers are allowed — no letters or special characters.';
  }
  return null;
}

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /\d/.test(p) },
  {
    id: 'special',
    label: 'One special character (!@#$%^&* etc.)',
    test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;/'`~]/.test(p),
  },
];

export function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function getPasswordValidationErrors(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
}

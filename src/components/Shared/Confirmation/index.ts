/**
 * Confirmation UI switch kit
 *
 * UI1 — BMS-style ticket (ConfirmationPageUI1 / ConfirmationPageUI1Shell)
 * UI2 — classic confirmation (ConfirmationPageUI2 / existing dining & event layouts)
 *
 * Toggle globally:
 *   confirmationUiVersion.ts → CONFIRMATION_UI_VERSION = 1 | 2
 *
 * Or in MovieBookingConfirmationPage comment/uncomment the UI imports.
 */
export { CONFIRMATION_UI_VERSION } from "./confirmationUiVersion";
export { default as ConfirmationPageUI1 } from "./ConfirmationPageUI1";
export { default as ConfirmationPageUI2 } from "./ConfirmationPageUI2";
export { default as ConfirmationPageUI1Shell } from "./ConfirmationPageUI1Shell";

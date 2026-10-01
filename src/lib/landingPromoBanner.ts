/**
 * Home / listing promo slider frame — keep partner crop + landing CSS in sync.
 * Display: width = min(peek%, height × aspect); partners crop to the same ratio.
 */
export const LANDING_PROMO_BANNER_ASPECT = 3; // 3:1
export const LANDING_PROMO_BANNER_WIDTH = 1920;
export const LANDING_PROMO_BANNER_HEIGHT = 640; // 1920 / 3

export const LANDING_PROMO_BANNER_SIZE_HINT = `${LANDING_PROMO_BANNER_WIDTH}×${LANDING_PROMO_BANNER_HEIGHT}px (3:1)`;

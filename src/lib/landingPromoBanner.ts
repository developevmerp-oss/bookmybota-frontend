/**
 * Home / listing promo slider frames — keep partner crop + landing CSS in sync.
 * Desktop: 3:1 wide cinematic. Mobile/tablet: 2:1 for readable height on phones.
 */
export const LANDING_PROMO_BANNER_ASPECT = 3; // 3:1 desktop
export const LANDING_PROMO_BANNER_WIDTH = 1920;
export const LANDING_PROMO_BANNER_HEIGHT = 640; // 1920 / 3
export const LANDING_PROMO_BANNER_SIZE_HINT = `${LANDING_PROMO_BANNER_WIDTH}×${LANDING_PROMO_BANNER_HEIGHT}px (3:1)`;

/** Phone + tablet promo banner (below lg / 1024px). */
export const LANDING_PROMO_BANNER_MOBILE_ASPECT = 2; // 2:1
export const LANDING_PROMO_BANNER_MOBILE_WIDTH = 1200;
export const LANDING_PROMO_BANNER_MOBILE_HEIGHT = 600; // 1200 / 2
export const LANDING_PROMO_BANNER_MOBILE_SIZE_HINT = `${LANDING_PROMO_BANNER_MOBILE_WIDTH}×${LANDING_PROMO_BANNER_MOBILE_HEIGHT}px (2:1)`;

import type { PixelCrop } from "react-image-crop";

/** Clamp a pixel crop inside the image bounds without breaking size. */
export function clampPixelCrop(crop: PixelCrop, maxW: number, maxH: number): PixelCrop {
  let { x, y, width, height } = crop;
  width = Math.max(1, Math.min(width, maxW));
  height = Math.max(1, Math.min(height, maxH));
  x = Math.max(0, Math.min(x, maxW - width));
  y = Math.max(0, Math.min(y, maxH - height));
  return { unit: "px", x, y, width, height };
}

/**
 * Largest crop with the given aspect that fits inside `selection` (centered).
 * Used when the user free-form selects, then we export at a required ratio.
 */
export function fitAspectInsideSelection(
  selection: PixelCrop,
  aspect: number,
  maxW: number,
  maxH: number
): PixelCrop {
  if (!aspect || aspect <= 0) {
    return clampPixelCrop(selection, maxW, maxH);
  }

  const box = clampPixelCrop(selection, maxW, maxH);
  const selAspect = box.width / box.height;

  let width: number;
  let height: number;
  if (selAspect > aspect) {
    // Selection too wide → height limited
    height = box.height;
    width = height * aspect;
  } else {
    // Selection too tall → width limited
    width = box.width;
    height = width / aspect;
  }

  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  return clampPixelCrop({ unit: "px", x, y, width, height }, maxW, maxH);
}

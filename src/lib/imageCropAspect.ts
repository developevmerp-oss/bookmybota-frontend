import type { PixelCrop } from "react-image-crop";

/** Clamp a pixel crop inside the image bounds. */
export function clampPixelCrop(crop: PixelCrop, maxW: number, maxH: number): PixelCrop {
  let { x, y, width, height } = crop;
  width = Math.max(1, Math.min(width, maxW));
  height = Math.max(1, Math.min(height, maxH));
  x = Math.max(0, Math.min(x, maxW - width));
  y = Math.max(0, Math.min(y, maxH - height));
  return { unit: "px", x, y, width, height };
}

/**
 * Keep aspect ratio after a free-form ReactCrop change.
 * Detects which edges moved so left/right/up/down (and corners) all work.
 */
export function enforceAspectCrop(
  prev: PixelCrop,
  next: PixelCrop,
  aspect: number,
  maxW: number,
  maxH: number,
  minSize = 40
): PixelCrop {
  if (!aspect || aspect <= 0) {
    return clampPixelCrop(next, maxW, maxH);
  }

  const eps = 0.75;
  const leftMoved = Math.abs(next.x - prev.x) > eps;
  const topMoved = Math.abs(next.y - prev.y) > eps;
  const rightMoved = Math.abs(next.x + next.width - (prev.x + prev.width)) > eps;
  const bottomMoved = Math.abs(next.y + next.height - (prev.y + prev.height)) > eps;

  const horizontal = leftMoved || rightMoved;
  const vertical = topMoved || bottomMoved;

  let x = next.x;
  let y = next.y;
  let width = next.width;
  let height = next.height;

  const fitWithin = (w: number, h: number) => {
    let fw = w;
    let fh = h;
    if (fw > maxW) {
      fw = maxW;
      fh = fw / aspect;
    }
    if (fh > maxH) {
      fh = maxH;
      fw = fh * aspect;
    }
    if (fw < minSize) {
      fw = minSize;
      fh = fw / aspect;
    }
    if (fh < minSize) {
      fh = minSize;
      fw = fh * aspect;
    }
    if (fw > maxW) {
      fw = maxW;
      fh = fw / aspect;
    }
    if (fh > maxH) {
      fh = maxH;
      fw = fh * aspect;
    }
    return { fw, fh };
  };

  if (horizontal && !vertical) {
    // Left / right edge: width drives height, keep vertical center.
    const fitted = fitWithin(width, width / aspect);
    width = fitted.fw;
    height = fitted.fh;
    y = prev.y + (prev.height - height) / 2;
    if (leftMoved && !rightMoved) {
      x = prev.x + prev.width - width;
    } else {
      x = prev.x;
    }
  } else if (vertical && !horizontal) {
    // Top / bottom edge: height drives width, keep horizontal center.
    const fitted = fitWithin(height * aspect, height);
    width = fitted.fw;
    height = fitted.fh;
    x = prev.x + (prev.width - width) / 2;
    if (topMoved && !bottomMoved) {
      y = prev.y + prev.height - height;
    } else {
      y = prev.y;
    }
  } else {
    // Corner (or ambiguous): prefer the dominant delta.
    const dw = Math.abs(width - prev.width);
    const dh = Math.abs(height - prev.height);
    if (dh > dw) {
      const fitted = fitWithin(height * aspect, height);
      width = fitted.fw;
      height = fitted.fh;
    } else {
      const fitted = fitWithin(width, width / aspect);
      width = fitted.fw;
      height = fitted.fh;
    }
    if (leftMoved && !rightMoved) {
      x = prev.x + prev.width - width;
    } else if (!leftMoved && rightMoved) {
      x = prev.x;
    } else {
      x = next.x;
    }
    if (topMoved && !bottomMoved) {
      y = prev.y + prev.height - height;
    } else if (!topMoved && bottomMoved) {
      y = prev.y;
    } else {
      y = next.y;
    }
  }

  return clampPixelCrop({ unit: "px", x, y, width, height }, maxW, maxH);
}

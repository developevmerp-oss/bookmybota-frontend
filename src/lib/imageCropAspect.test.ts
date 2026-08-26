/**
 * Quick node test for edge-aware aspect crop math.
 * Run: npx --yes tsx src/lib/imageCropAspect.test.ts
 */
import { enforceAspectCrop } from "./imageCropAspect";
import type { PixelCrop } from "react-image-crop";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function nearly(a: number, b: number, tol = 0.6) {
  return Math.abs(a - b) <= tol;
}

function aspectOf(c: PixelCrop) {
  return c.width / c.height;
}

const maxW = 800;
const maxH = 600;
const aspect = 16 / 9;
const prev: PixelCrop = { unit: "px", x: 100, y: 100, width: 320, height: 180 };

// Right edge: widen only
{
  const next: PixelCrop = { ...prev, width: 400 };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(nearly(aspectOf(out), aspect), `right edge aspect got ${aspectOf(out)}`);
  assert(nearly(out.x, prev.x), "right edge should keep left");
  assert(out.width > prev.width, "right edge should grow width");
  console.log("✓ right edge");
}

// Left edge: shrink from left
{
  const next: PixelCrop = { unit: "px", x: 140, y: prev.y, width: 280, height: prev.height };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(nearly(aspectOf(out), aspect), `left edge aspect got ${aspectOf(out)}`);
  assert(nearly(out.x + out.width, prev.x + prev.width), "left edge should keep right");
  console.log("✓ left edge");
}

// Bottom edge: grow height only
{
  const next: PixelCrop = { ...prev, height: 220 };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(nearly(aspectOf(out), aspect), `bottom edge aspect got ${aspectOf(out)}`);
  assert(nearly(out.y, prev.y), "bottom edge should keep top");
  assert(out.height > prev.height, "bottom edge should grow height");
  console.log("✓ bottom edge");
}

// Top edge: shrink from top
{
  const next: PixelCrop = { unit: "px", x: prev.x, y: 130, width: prev.width, height: 150 };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(nearly(aspectOf(out), aspect), `top edge aspect got ${aspectOf(out)}`);
  assert(nearly(out.y + out.height, prev.y + prev.height), "top edge should keep bottom");
  console.log("✓ top edge");
}

// SE corner
{
  const next: PixelCrop = { ...prev, width: 400, height: 250 };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(nearly(aspectOf(out), aspect), `corner aspect got ${aspectOf(out)}`);
  assert(nearly(out.x, prev.x), "se corner keeps left");
  assert(nearly(out.y, prev.y), "se corner keeps top");
  console.log("✓ se corner");
}

// Bounds: cannot exceed image
{
  const next: PixelCrop = { unit: "px", x: 0, y: 0, width: 900, height: 180 };
  const out = enforceAspectCrop(prev, next, aspect, maxW, maxH);
  assert(out.x >= 0 && out.y >= 0, "in bounds origin");
  assert(out.x + out.width <= maxW + 0.01, "width in bounds");
  assert(out.y + out.height <= maxH + 0.01, "height in bounds");
  assert(nearly(aspectOf(out), aspect, 0.02), `bounded aspect got ${aspectOf(out)}`);
  console.log("✓ bounds");
}

console.log("\nAll imageCropAspect edge tests passed.");

"use client";

import Konva from "konva";
import { UniversalVenueObject } from "../types";

/** Konva font style string for a text element */
export function textFontStyle(obj: Pick<UniversalVenueObject, "textBold" | "textItalic">): string {
  const parts = [obj.textItalic ? "italic" : "", obj.textBold !== false ? "bold" : ""].filter(Boolean);
  return parts.join(" ") || "normal";
}

/** Size a text element takes up, so alignment and the selection frame fit the words exactly */
export function measureText(
  obj: Pick<UniversalVenueObject, "label" | "fontSize" | "textBold" | "textItalic" | "textAlign">
): { width: number; height: number } {
  const probe = new Konva.Text({
    text: obj.label || " ",
    fontSize: obj.fontSize || 16,
    fontFamily: "sans-serif",
    fontStyle: textFontStyle(obj),
    align: obj.textAlign || "center",
  });
  const size = { width: Math.ceil(probe.width()) + 2, height: Math.ceil(probe.height()) };
  probe.destroy();
  return size;
}

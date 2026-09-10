"use client";

import React, { useCallback, useRef, useState, type ReactNode } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
  type PixelCrop,
} from "react-image-crop";
import { Pencil, X } from "lucide-react";
import { fitAspectInsideSelection } from "@/lib/imageCropAspect";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import "react-image-crop/dist/ReactCrop.css";
import "./ImageCropPicker.css";

const MAX_EDGE = 1600;
const MIN_EDGE = 320;

/** Human-readable crop ratio label for the modal. */
export function cropAspectLabel(aspect?: number): string | null {
  if (!aspect || aspect <= 0) return null;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  if (near(aspect, 16 / 9)) return "Horizontal · 16:9";
  if (near(aspect, 2 / 3)) return "Vertical · 2:3";
  if (near(aspect, 3 / 4)) return "Vertical · 3:4";
  if (near(aspect, 4 / 3)) return "Landscape · 4:3";
  if (near(aspect, 1)) return "Square · 1:1";
  if (near(aspect, 16 / 10)) return "Wide · 16:10";
  if (near(aspect, 21 / 9)) return "Banner · 21:9";
  if (aspect > 1) return `Horizontal · ${aspect.toFixed(2)}:1`;
  return `Vertical · 1:${(1 / aspect).toFixed(2)}`;
}

/**
 * Preview box class that matches the crop aspect (avoids object-cover re-cropping).
 */
export function cropPreviewClass(aspect?: number, extra = ""): string {
  const base = "rounded-xl overflow-hidden border border-slate-200 bg-slate-100";
  if (!aspect || aspect <= 0) return `${base} w-28 h-28 ${extra}`.trim();
  if (Math.abs(aspect - 1) < 0.02) return `${base} w-28 h-28 ${extra}`.trim();
  if (aspect > 1) return `${base} w-full aspect-[var(--crop-aspect)] ${extra}`.trim();
  return `${base} w-[160px] sm:w-[180px] aspect-[var(--crop-aspect)] ${extra}`.trim();
}

function createInitialCrop(width: number, height: number, aspect?: number): PercentCrop {
  if (aspect && aspect > 0) {
    // Start inset (~80%) so top/side handles stay visible and grabable.
    const imageAspect = width / height;
    const seed =
      aspect >= imageAspect
        ? makeAspectCrop({ unit: "%", width: 80 }, aspect, width, height)
        : makeAspectCrop({ unit: "%", height: 80 }, aspect, width, height);
    return centerCrop(seed, width, height);
  }
  return centerCrop({ unit: "%", width: 80, height: 80, x: 0, y: 0 }, width, height);
}

async function cropImageToBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputAspect?: number
): Promise<Blob> {
  if (!crop.width || !crop.height) {
    throw new Error("Select a crop area first.");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = Math.max(0, crop.x * scaleX);
  const sy = Math.max(0, crop.y * scaleY);
  const sw = Math.max(1, Math.min(crop.width * scaleX, image.naturalWidth - sx));
  const sh = Math.max(1, Math.min(crop.height * scaleY, image.naturalHeight - sy));

  const ratio = outputAspect && outputAspect > 0 ? outputAspect : sw / sh;
  const longest = Math.max(sw, sh);
  const scale = Math.min(1, MAX_EDGE / longest);

  let outW = Math.round(sw * scale);
  let outH = Math.round(sh * scale);

  if (ratio >= 1) {
    outW = Math.max(MIN_EDGE, outW);
    outH = Math.max(1, Math.round(outW / ratio));
  } else {
    outH = Math.max(MIN_EDGE, outH);
    outW = Math.max(1, Math.round(outH * ratio));
  }

  const longOut = Math.max(outW, outH);
  if (longOut > MAX_EDGE) {
    const down = MAX_EDGE / longOut;
    outW = Math.max(1, Math.round(outW * down));
    outH = Math.max(1, Math.round(outH * down));
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}

export function ImageCropModal({
  src,
  aspect,
  onCancel,
  onConfirm,
  onPickAnother,
}: {
  src: string;
  aspect?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onPickAnother?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedAspect = aspect && aspect > 0 ? aspect : undefined;
  const label = cropAspectLabel(lockedAspect);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const next = createInitialCrop(width, height, lockedAspect);
    const pixel = convertToPixelCrop(next, width, height);
    setCrop(next);
    setCompletedCrop(pixel);
  };

  const confirm = async () => {
    const img = imgRef.current;
    if (!img) return;

    let pixel =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : crop
          ? convertToPixelCrop(crop, img.width, img.height)
          : null;

    if (!pixel) return;

    // Free-form selection in the UI (like Photos app). If a target ratio is
    // required, take the largest matching area inside what the user framed.
    if (lockedAspect) {
      pixel = fitAspectInsideSelection(pixel, lockedAspect, img.width, img.height);
    }

    setBusy(true);
    setError(null);
    try {
      onConfirm(await cropImageToBlob(img, pixel, lockedAspect));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crop failed. Try another photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-crop-modal fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#F5F5F5] rounded-2xl w-full max-w-3xl max-h-[min(92dvh,920px)] shadow-xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <div>
            <p className="font-semibold text-slate-800">Crop image</p>
            {label ? <p className="text-xs text-slate-500 mt-0.5">{label}</p> : null}
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 flex flex-col px-4 pt-3 pb-2 gap-2">
          <div className="image-crop-stage relative mx-auto w-full bg-[#E8E8E8] rounded-lg">
            <ReactCrop
              crop={crop}
              // Free-form like the Photos app video: each side handle moves
              // only that side; corners resize freely. Aspect is applied on export.
              keepSelection
              ruleOfThirds
              minWidth={40}
              minHeight={40}
              onChange={(_pixel, percent) => setCrop(percent)}
              onComplete={(pixel) => setCompletedCrop(pixel)}
              className="image-crop-react"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt="Crop"
                crossOrigin={src.startsWith("blob:") || src.startsWith("data:") ? undefined : "anonymous"}
                onLoad={onImageLoad}
                className="image-crop-media select-none"
                draggable={false}
              />
            </ReactCrop>
          </div>
          <p className="shrink-0 text-xs text-slate-500 text-center px-1">
            Drag to move. Resize from any corner, or from the top, bottom, left, or right edge
            {lockedAspect ? ` — final image will be saved as ${label?.split("·")[0]?.trim() || "the required shape"}.` : "."}
          </p>
          {error ? <p className="shrink-0 text-xs text-rose-600 text-center font-medium">{error}</p> : null}
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-[#E5E5E5] bg-[#EFEFEF]">
          {onPickAnother ? (
            <button type="button" onClick={onPickAnother} className="px-4 py-2 text-sm rounded-xl border bg-[#F5F5F5]">
              Choose another photo
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border bg-[#F5F5F5]">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !completedCrop?.width}
              onClick={() => void confirm()}
              className="px-4 py-2 text-sm rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50"
            >
              {busy ? "Cropping..." : "Use this crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type PickerProps = {
  aspect?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onCroppedFile: (file: File) => void | Promise<void>;
};

export default function ImageCropPicker({
  aspect,
  disabled,
  className,
  children,
  onCroppedFile,
}: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSrc(URL.createObjectURL(file));
  };

  const close = useCallback(() => {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    setSrc(null);
  }, [src]);

  return (
    <>
      <button type="button" disabled={disabled} className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={disabled} onChange={onPick} />
      {src && (
        <ImageCropModal
          src={src}
          aspect={aspect}
          onCancel={close}
          onPickAnother={() => inputRef.current?.click()}
          onConfirm={async (blob) => {
            const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
            close();
            await onCroppedFile(file);
          }}
        />
      )}
    </>
  );
}

type FieldProps = {
  value?: string;
  aspect?: number;
  disabled?: boolean;
  previewClassName?: string;
  emptyClassName?: string;
  emptyLabel?: string;
  emptyContent?: ReactNode;
  onCroppedFile: (file: File) => void | Promise<void>;
  onRemove: () => void;
};

export function CroppedImageField({
  value,
  aspect,
  disabled,
  previewClassName,
  emptyClassName,
  emptyLabel = "Add photo",
  emptyContent,
  onCroppedFile,
  onRemove,
}: FieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  const openFile = () => inputRef.current?.click();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSrc(URL.createObjectURL(file));
  };

  const close = () => {
    if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    setSrc(null);
  };

  const finish = async (blob: Blob) => {
    close();
    await onCroppedFile(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
  };

  const previewStyle =
    aspect && aspect > 0 ? ({ ["--crop-aspect" as string]: String(aspect) } as React.CSSProperties) : undefined;
  const resolvedPreviewClass = previewClassName || cropPreviewClass(aspect);
  const resolvedEmptyClass =
    emptyClassName ||
    `flex flex-col items-center justify-center border border-dashed border-slate-300 hover:border-rose-400 ${cropPreviewClass(aspect, "border-dashed")}`;

  if (!value) {
    return (
      <ImageCropPicker
        aspect={aspect}
        disabled={disabled}
        className={resolvedEmptyClass}
        onCroppedFile={onCroppedFile}
      >
        {emptyContent || <span className="text-xs">{emptyLabel}</span>}
      </ImageCropPicker>
    );
  }

  return (
    <>
      <div className={`relative ${resolvedPreviewClass}`} style={previewStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveMediaUrl(value)} alt="" className="w-full h-full object-cover" />
        {!disabled && (
          <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
            <button
              type="button"
              onClick={() => setSrc(resolveMediaUrl(value))}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white/90 text-slate-800 text-[11px] font-semibold py-1"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold py-1"
            >
              <X size={12} /> Remove
            </button>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={disabled} onChange={onPick} />
      {src && (
        <ImageCropModal
          src={src}
          aspect={aspect}
          onCancel={close}
          onPickAnother={openFile}
          onConfirm={finish}
        />
      )}
    </>
  );
}

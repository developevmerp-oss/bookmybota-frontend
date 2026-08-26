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
import { enforceAspectCrop } from "@/lib/imageCropAspect";
import "react-image-crop/dist/ReactCrop.css";
import "./ImageCropPicker.css";

function createInitialCrop(width: number, height: number, aspect?: number): PercentCrop {
  if (aspect && aspect > 0) {
    return centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
      width,
      height
    );
  }
  return centerCrop({ unit: "%", width: 90, height: 90, x: 0, y: 0 }, width, height);
}

async function cropImageToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  if (!crop.width || !crop.height) {
    throw new Error("Select a crop area first.");
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sw = Math.max(1, crop.width * scaleX);
  const sh = Math.max(1, crop.height * scaleY);

  const outW = Math.min(1600, Math.max(320, Math.round(sw)));
  const outH = Math.max(320, Math.round((outW * sh) / sw));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/jpeg", 0.92);
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
  const prevPixelRef = useRef<PixelCrop | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [busy, setBusy] = useState(false);

  const lockedAspect = aspect && aspect > 0 ? aspect : undefined;

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const next = createInitialCrop(width, height, lockedAspect);
    const pixel = convertToPixelCrop(next, width, height);
    prevPixelRef.current = pixel;
    setCrop(pixel);
    setCompletedCrop(pixel);
  };

  const applyCropChange = (pixel: PixelCrop) => {
    const img = imgRef.current;
    if (!img || !img.width || !img.height) {
      setCrop(pixel);
      return;
    }

    if (!lockedAspect) {
      prevPixelRef.current = pixel;
      setCrop(pixel);
      return;
    }

    const prev = prevPixelRef.current || pixel;
    const next = enforceAspectCrop(prev, pixel, lockedAspect, img.width, img.height);
    prevPixelRef.current = next;
    setCrop(next);
  };

  const confirm = async () => {
    const img = imgRef.current;
    if (!img) return;

    const pixel =
      completedCrop && completedCrop.width > 0 && completedCrop.height > 0
        ? completedCrop
        : crop
          ? convertToPixelCrop(crop, img.width, img.height)
          : null;

    if (!pixel) return;

    setBusy(true);
    try {
      onConfirm(await cropImageToBlob(img, pixel));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-crop-modal fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#F5F5F5] rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <p className="font-semibold text-slate-800">Crop image</p>
          <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative mx-auto bg-[#E8E8E8] flex items-center justify-center overflow-auto rounded-lg py-3 px-2 max-h-[60vh]">
            <ReactCrop
              crop={crop}
              // Do NOT pass `aspect` here — library hides/breaks edge handles when aspect is set.
              // We enforce aspect ourselves in onChange so left/right/up/down all work.
              keepSelection
              minWidth={40}
              minHeight={40}
              onChange={(pixel) => applyCropChange(pixel)}
              onComplete={(pixel) => {
                const img = imgRef.current;
                if (!img || !lockedAspect) {
                  setCompletedCrop(pixel);
                  prevPixelRef.current = pixel;
                  return;
                }
                const prev = prevPixelRef.current || pixel;
                const next = enforceAspectCrop(prev, pixel, lockedAspect, img.width, img.height);
                prevPixelRef.current = next;
                setCrop(next);
                setCompletedCrop(next);
              }}
              className="max-w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt="Crop"
                onLoad={onImageLoad}
                className="select-none block max-w-full max-h-[55vh]"
                draggable={false}
              />
            </ReactCrop>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Drag the box to move it. Resize from corners or from the top, bottom, left, and right edges
            {lockedAspect ? " (aspect ratio stays locked)." : "."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-[#E5E5E5] bg-[#EFEFEF]">
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
  previewClassName = "w-28 h-28 rounded-2xl",
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

  if (!value) {
    return (
      <ImageCropPicker aspect={aspect} disabled={disabled} className={emptyClassName} onCroppedFile={onCroppedFile}>
        {emptyContent || <span className="text-xs">{emptyLabel}</span>}
      </ImageCropPicker>
    );
  }

  return (
    <>
      <div className={`relative overflow-hidden border border-slate-200 ${previewClassName}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="w-full h-full object-cover" />
        {!disabled && (
          <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
            <button
              type="button"
              onClick={() => setSrc(value)}
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

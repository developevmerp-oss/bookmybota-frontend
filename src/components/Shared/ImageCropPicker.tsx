"use client";

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";

type Box = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "draw";

const MIN = 40;

function clampBox(box: Box, maxW: number, maxH: number, aspect?: number): Box {
  let { x, y, w, h } = box;
  if (aspect && aspect > 0) {
    h = w / aspect;
    if (h < MIN / Math.max(aspect, 0.01)) {
      h = MIN;
      w = h * aspect;
    }
    if (w < MIN) {
      w = MIN;
      h = w / aspect;
    }
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
  } else {
    w = Math.max(MIN, Math.min(w, maxW));
    h = Math.max(MIN, Math.min(h, maxH));
  }
  x = Math.max(0, Math.min(x, maxW - w));
  y = Math.max(0, Math.min(y, maxH - h));
  return { x, y, w, h };
}

function initialBox(dw: number, dh: number, aspect?: number): Box {
  if (aspect && aspect > 0) {
    let w = dw;
    let h = w / aspect;
    if (h > dh) {
      h = dh;
      w = h * aspect;
    }
    w *= 0.85;
    h = w / aspect;
    return clampBox({ x: (dw - w) / 2, y: (dh - h) / 2, w, h }, dw, dh, aspect);
  }
  const w = dw * 0.8;
  const h = dh * 0.8;
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h };
}

function cropToBlob(img: HTMLImageElement, disp: { w: number; h: number }, box: Box): Promise<Blob> {
  const sx = (box.x / disp.w) * img.naturalWidth;
  const sy = (box.y / disp.h) * img.naturalHeight;
  const sw = (box.w / disp.w) * img.naturalWidth;
  const sh = (box.h / disp.h) * img.naturalHeight;
  const outW = Math.min(1600, Math.max(320, Math.round(sw)));
  const outH = Math.max(320, Math.round((outW * sh) / sw));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not available"));
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.92);
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    orig: Box;
  } | null>(null);

  const layoutImage = () => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage || !img.naturalWidth) return;
    const maxW = Math.min(stage.clientWidth, 720);
    const maxH = Math.min(window.innerHeight * 0.55, 480);
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const w = Math.max(1, img.naturalWidth * scale);
    const h = Math.max(1, img.naturalHeight * scale);
    setDisp({ w, h });
    setBox((prev) => (prev ? clampBox(prev, w, h, aspect) : initialBox(w, h, aspect)));
  };

  useEffect(() => {
    layoutImage();
    window.addEventListener("resize", layoutImage);
    return () => window.removeEventListener("resize", layoutImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, aspect]);

  const applyHandle = (handle: Handle, dx: number, dy: number, orig: Box): Box => {
    let { x, y, w, h } = orig;
    const maxW = disp.w;
    const maxH = disp.h;
    if (handle === "move") {
      x += dx;
      y += dy;
      return clampBox({ x, y, w, h }, maxW, maxH, aspect);
    }
    if (handle === "draw") {
      w = Math.abs(dx);
      h = aspect ? w / aspect : Math.abs(dy);
      x = dx < 0 ? orig.x + dx : orig.x;
      y = dy < 0 && !aspect ? orig.y + dy : orig.y;
      if (aspect && dy < 0) y = orig.y - h;
      return clampBox({ x, y, w, h }, maxW, maxH, aspect);
    }

    if (handle.includes("e")) w = orig.w + dx;
    if (handle.includes("s")) h = orig.h + dy;
    if (handle.includes("w")) {
      w = orig.w - dx;
      x = orig.x + dx;
    }
    if (handle.includes("n")) {
      h = orig.h - dy;
      y = orig.y + dy;
    }
    if (aspect) {
      if (handle === "e" || handle === "w") h = w / aspect;
      else if (handle === "n" || handle === "s") w = h * aspect;
      else h = w / aspect;
      if (handle.includes("n")) y = orig.y + orig.h - h;
      if (handle.includes("w")) x = orig.x + orig.w - w;
    }
    return clampBox({ x, y, w, h }, maxW, maxH, aspect);
  };

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, orig: box };
  };

  const onStageDown = (e: React.PointerEvent) => {
    if (!disp.w) return;
    if ((e.target as HTMLElement).closest("[data-crop-box]")) return;
    const host = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - host.left;
    const y = e.clientY - host.top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle: "draw", startX: e.clientX, startY: e.clientY, orig: { x, y, w: 0, h: 0 } };
    setBox({ x, y, w: MIN, h: aspect ? MIN / Math.max(aspect, 0.01) : MIN });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    setBox(applyHandle(drag.current.handle, dx, dy, drag.current.orig));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const confirm = async () => {
    const img = imgRef.current;
    if (!img || !box) return;
    setBusy(true);
    try {
      onConfirm(await cropToBlob(img, disp, box));
    } finally {
      setBusy(false);
    }
  };

  const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const handleStyle = (h: Handle): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      nw: { left: -6, top: -6, cursor: "nwse-resize" },
      n: { left: "50%", top: -6, marginLeft: -6, cursor: "ns-resize" },
      ne: { right: -6, top: -6, cursor: "nesw-resize" },
      e: { right: -6, top: "50%", marginTop: -6, cursor: "ew-resize" },
      se: { right: -6, bottom: -6, cursor: "nwse-resize" },
      s: { left: "50%", bottom: -6, marginLeft: -6, cursor: "ns-resize" },
      sw: { left: -6, bottom: -6, cursor: "nesw-resize" },
      w: { left: -6, top: "50%", marginTop: -6, cursor: "ew-resize" },
    };
    return map[h] || {};
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-slate-800">Crop image</p>
          <button type="button" onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div
            ref={stageRef}
            className="relative mx-auto bg-slate-900 flex items-center justify-center overflow-hidden rounded-lg py-2"
            style={{ minHeight: 280 }}
          >
            <div className="relative overflow-hidden" style={{ width: disp.w || undefined, height: disp.h || undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={src}
                alt="Crop"
                draggable={false}
                onLoad={layoutImage}
                className="select-none block max-w-full"
                style={{ width: disp.w || "auto", height: disp.h || "auto" }}
              />
              {box && disp.w > 0 && (
                <div
                  className="absolute inset-0 touch-none"
                  onPointerDown={onStageDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  <div
                    data-crop-box
                    className="absolute border-2 border-white cursor-move"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                    }}
                    onPointerDown={onPointerDown("move")}
                  >
                    {handles.map((h) => (
                      <span
                        key={h}
                        className="absolute w-3 h-3 bg-white border border-slate-700 rounded-sm"
                        style={handleStyle(h)}
                        onPointerDown={onPointerDown(h)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Drag the box to move it. Drag the corners or edges to resize. Click outside the box and drag to draw a new crop area.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t bg-slate-50">
          {onPickAnother ? (
            <button type="button" onClick={onPickAnother} className="px-4 py-2 text-sm rounded-xl border">
              Choose another photo
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-xl border">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !box}
              onClick={confirm}
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

"use client";

import { useState } from "react";
import { Music2, Trash2, Upload, Video } from "lucide-react";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { toast } from "sonner";
import { useUploadPartnerMediaMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import {
  ARTIST_MEDIA_MAX,
  ARTIST_MEDIA_MAX_DURATION_SEC,
  ARTIST_VIDEO_MAX_BYTES,
  getArtistMediaKind,
  readMediaDurationSec,
  type ArtistMediaClip,
  type ArtistMediaKind,
  type ArtistMeta,
} from "@/lib/artistMeta";

type Props = {
  typeSlug?: string | null;
  value: ArtistMeta;
  onChange: (next: ArtistMeta) => void;
  disabled?: boolean;
  refreshingSocial?: boolean;
  compact?: boolean;
  /** Render media samples card (default true) */
  showMedia?: boolean;
  /** Render social links card (default true) */
  showSocial?: boolean;
};

export default function ArtistMediaSocialFields({
  value,
  onChange,
  disabled = false,
  compact = false,
  showMedia = true,
  showSocial = true,
}: Props) {
  const [uploadMedia, { isLoading: uploading }] = useUploadPartnerMediaMutation();
  const [pendingKind, setPendingKind] = useState<ArtistMediaKind | null>(null);
  const social = value.social || {};
  const activeKind = getArtistMediaKind(value);
  const activeIsSpotlight = activeKind === "spotlight";
  const activeClips: ArtistMediaClip[] = activeIsSpotlight
    ? value.spotlight_videos || []
    : value.audio_clips || [];

  const setClips = (next: ArtistMediaClip[]) => {
    if (activeIsSpotlight) {
      onChange({
        ...value,
        media_kind: "spotlight",
        spotlight_videos: next,
        audio_clips: [],
      });
    } else {
      onChange({
        ...value,
        media_kind: "audio",
        audio_clips: next,
        spotlight_videos: [],
      });
    }
  };

  const applyKind = (kind: ArtistMediaKind) => {
    onChange({
      ...value,
      media_kind: kind,
      spotlight_videos: [],
      audio_clips: [],
    });
    setPendingKind(null);
  };

  const chooseKind = (kind: ArtistMediaKind) => {
    if (disabled || kind === activeKind) return;
    if (activeClips.length > 0) {
      setPendingKind(kind);
      return;
    }
    applyKind(kind);
  };

  const setSocial = (patch: Partial<NonNullable<ArtistMeta["social"]>>) => {
    onChange({
      ...value,
      social: { ...social, ...patch },
    });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    if (activeClips.length >= ARTIST_MEDIA_MAX) {
      toast.error(`You can upload at most ${ARTIST_MEDIA_MAX} files.`);
      return;
    }

    if (activeIsSpotlight) {
      if (!file.type.startsWith("video/")) {
        toast.error("Upload a spotlight video file.");
        return;
      }
      if (file.size > ARTIST_VIDEO_MAX_BYTES) {
        toast.error("Spotlight videos must be 5 MB or smaller.");
        return;
      }
    } else if (!file.type.startsWith("audio/")) {
      toast.error("Upload an audio file (max 30 seconds).");
      return;
    }

    try {
      const duration = await readMediaDurationSec(file);
      if (duration > ARTIST_MEDIA_MAX_DURATION_SEC + 0.25) {
        toast.error(`File must be ${ARTIST_MEDIA_MAX_DURATION_SEC} seconds or less.`);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadMedia(fd).unwrap();
      const url = res.url;
      if (!url) throw new Error("Upload failed");
      setClips([
        ...activeClips,
        {
          url,
          duration_sec: Math.min(Math.round(duration * 10) / 10, ARTIST_MEDIA_MAX_DURATION_SEC),
          size_bytes: file.size,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        },
      ]);
      toast.success(activeIsSpotlight ? "Spotlight video uploaded" : "Audio clip uploaded");
    } catch (err) {
      toast.error(extractApiError(err, "Could not upload media"));
    }
  };

  const cardPad = compact ? "p-4 sm:p-5 space-y-3" : "p-5 sm:p-6 space-y-4";
  const titleCls = compact ? "text-base" : "text-lg";
  const both = showMedia && showSocial;

  return (
    <div
      className={
        both
          ? compact
            ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
            : "space-y-4 sm:space-y-6"
          : "w-full"
      }
    >
      {showMedia ? (
        <section className={`org-card ${cardPad} min-w-0 w-full`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`font-display font-bold text-foreground ${titleCls}`}>Media samples</h3>
              {activeIsSpotlight ? (
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="text-destructive font-bold" aria-hidden>
                    *
                  </span>{" "}
                  Spotlight videos must be{" "}
                  <span className="font-semibold text-foreground">max 5 MB</span> each (up to{" "}
                  {ARTIST_MEDIA_MAX} files, {ARTIST_MEDIA_MAX_DURATION_SEC}s).
                </p>
              ) : (
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <span className="text-destructive font-bold" aria-hidden>
                    *
                  </span>{" "}
                  Audio clips: up to {ARTIST_MEDIA_MAX} files, max {ARTIST_MEDIA_MAX_DURATION_SEC}s
                  each.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => chooseKind("spotlight")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                  activeIsSpotlight
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary"
                }`}
              >
                <Video size={14} />
                Spotlight video
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => chooseKind("audio")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                  !activeIsSpotlight
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary"
                }`}
              >
                <Music2 size={14} />
                Audio clip
              </button>
            </div>
          </div>

          <div
            className={
              !both && activeClips.length > 0
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                : "space-y-2"
            }
          >
            {activeClips.length === 0 ? (
              <div className="text-sm text-muted-foreground rounded-xl border border-dashed border-border px-3 py-6 text-center md:col-span-2 xl:col-span-3">
                No {activeIsSpotlight ? "videos" : "audio"} uploaded yet.
              </div>
            ) : (
              activeClips.map((clip, idx) => (
                <div
                  key={`${clip.url}-${idx}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-primary shrink-0">
                      {activeIsSpotlight ? <Video size={14} /> : <Music2 size={14} />}
                      <span className="text-[11px] font-semibold">{clip.duration_sec}s</span>
                    </span>
                    <input
                      className="input-field !py-1.5 text-sm flex-1 min-w-0"
                      value={clip.title || ""}
                      disabled={disabled}
                      placeholder={activeIsSpotlight ? "Spotlight title" : "Track title"}
                      onChange={(e) => {
                        const next = activeClips.map((c, i) =>
                          i === idx ? { ...c, title: e.target.value } : c
                        );
                        setClips(next);
                      }}
                    />
                    {!disabled && (
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border border-border text-destructive hover:bg-muted shrink-0"
                        onClick={() => setClips(activeClips.filter((_, i) => i !== idx))}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {activeIsSpotlight ? (
                    <video
                      src={resolveMediaUrl(clip.url)}
                      controls
                      className="w-full rounded-lg bg-black max-h-44"
                    />
                  ) : (
                    <audio src={resolveMediaUrl(clip.url)} controls className="w-full" />
                  )}
                </div>
              ))
            )}
          </div>

          {!disabled && activeClips.length < ARTIST_MEDIA_MAX ? (
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-border text-sm font-semibold text-foreground hover:border-primary cursor-pointer w-fit">
              <Upload size={15} className="text-primary" />
              {uploading
                ? "Uploading…"
                : activeIsSpotlight
                  ? "Add spotlight video"
                  : "Add audio clip"}
              <input
                type="file"
                className="hidden"
                accept={activeIsSpotlight ? "video/*" : "audio/*"}
                disabled={uploading || disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void onPickFile(f);
                }}
              />
            </label>
          ) : null}
        </section>
      ) : null}

      {showSocial ? (
        <section className={`org-card ${cardPad} min-w-0 h-fit w-full`}>
          <div>
            <h3 className={`font-display font-bold text-foreground ${titleCls}`}>Social links</h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Paste Instagram and YouTube links. Customers see icons on your public page.
            </p>
          </div>

          <div className={`grid gap-3 ${!both ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <label className="portal-label flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-border shrink-0">
                  <FaInstagram size={15} className="text-[#E1306C]" />
                </span>
                Instagram URL
              </label>
              <input
                className="input-field"
                placeholder="https://instagram.com/yourhandle"
                disabled={disabled}
                value={social.instagram_url || ""}
                onChange={(e) => setSocial({ instagram_url: e.target.value })}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <label className="portal-label flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-border shrink-0">
                  <FaYoutube size={15} className="text-[#FF0000]" />
                </span>
                YouTube URL
              </label>
              <input
                className="input-field"
                placeholder="https://youtube.com/@yourchannel"
                disabled={disabled}
                value={social.youtube_url || ""}
                onChange={(e) => setSocial({ youtube_url: e.target.value })}
              />
            </div>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={pendingKind != null}
        theme="light"
        danger
        title="Switch media type?"
        body={
          pendingKind === "audio"
            ? "Switching to audio clips will remove your current spotlight videos. This cannot be undone from here."
            : "Switching to spotlight videos will remove your current audio clips. This cannot be undone from here."
        }
        confirmLabel={pendingKind === "audio" ? "Switch to audio" : "Switch to spotlight"}
        cancelLabel="Keep current"
        onCancel={() => setPendingKind(null)}
        onConfirm={() => {
          if (pendingKind) applyKind(pendingKind);
        }}
      />
    </div>
  );
}

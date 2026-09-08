"use client";

import { Loader2, Music2, RefreshCw, Trash2, Upload, Video } from "lucide-react";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { toast } from "sonner";
import { useUploadPartnerMediaMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  ARTIST_MEDIA_MAX,
  ARTIST_MEDIA_MAX_DURATION_SEC,
  ARTIST_VIDEO_MAX_BYTES,
  formatFollowerCount,
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
  /** True while parent is saving (counts refresh on save) */
  refreshingSocial?: boolean;
};

export default function ArtistMediaSocialFields({
  value,
  onChange,
  disabled = false,
  refreshingSocial = false,
}: Props) {
  const [uploadMedia, { isLoading: uploading }] = useUploadPartnerMediaMutation();
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

  const chooseKind = (kind: ArtistMediaKind) => {
    if (disabled || kind === activeKind) return;
    if (activeClips.length > 0) {
      const ok = window.confirm(
        `You can only use one media type. Switching to ${
          kind === "spotlight" ? "spotlight videos" : "audio clips"
        } will remove your current files. Continue?`
      );
      if (!ok) return;
    }
    onChange({
      ...value,
      media_kind: kind,
      spotlight_videos: [],
      audio_clips: [],
    });
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

  return (
    <div className="space-y-6">
      <section className="org-card p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Media samples</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose either spotlight videos or audio clips — not both. Up to {ARTIST_MEDIA_MAX} files
            (max {ARTIST_MEDIA_MAX_DURATION_SEC}s each
            {activeIsSpotlight ? ", 5 MB for video" : ""}).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => chooseKind("spotlight")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              activeIsSpotlight
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary"
            }`}
          >
            <Video size={16} />
            Spotlight video
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => chooseKind("audio")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              !activeIsSpotlight
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary"
            }`}
          >
            <Music2 size={16} />
            Audio clip
          </button>
        </div>

        <div className="space-y-2">
          {activeClips.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border px-4 py-6 text-center">
              No {activeIsSpotlight ? "videos" : "audio"} uploaded yet.
            </p>
          ) : (
            activeClips.map((clip, idx) => (
              <div
                key={`${clip.url}-${idx}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3"
              >
                <div className="flex items-center gap-2 shrink-0 text-primary">
                  {activeIsSpotlight ? <Video size={16} /> : <Music2 size={16} />}
                  <span className="text-xs font-semibold">{clip.duration_sec}s</span>
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    className="input-field !py-2 text-sm"
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
                  {activeIsSpotlight ? (
                    <video
                      src={resolveMediaUrl(clip.url)}
                      controls
                      className="mt-2 w-full max-w-md rounded-lg bg-black max-h-40"
                    />
                  ) : (
                    <audio src={resolveMediaUrl(clip.url)} controls className="mt-2 w-full" />
                  )}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    className="p-2 rounded-lg border border-border text-destructive hover:bg-muted self-start"
                    onClick={() => setClips(activeClips.filter((_, i) => i !== idx))}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {!disabled && activeClips.length < ARTIST_MEDIA_MAX ? (
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-semibold text-foreground hover:border-primary cursor-pointer w-fit">
            <Upload size={16} className="text-primary" />
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

      <section className="org-card p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Social links</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paste your Instagram and YouTube profile links. Follower / subscriber counts are fetched
            automatically when you save, and refresh on your public page.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="portal-label block text-sm font-semibold mb-1.5 inline-flex items-center gap-1.5">
              <FaInstagram size={14} className="text-[#E1306C]" /> Instagram URL
            </label>
            <input
              className="input-field"
              placeholder="https://instagram.com/yourhandle"
              disabled={disabled}
              value={social.instagram_url || ""}
              onChange={(e) => setSocial({ instagram_url: e.target.value })}
            />
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm">
              <FaInstagram size={14} className="text-[#E1306C] shrink-0" />
              <span className="text-muted-foreground">Followers</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {refreshingSocial ? (
                  <Loader2 size={14} className="animate-spin inline" />
                ) : (
                  formatFollowerCount(social.instagram_followers)
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="portal-label block text-sm font-semibold mb-1.5 inline-flex items-center gap-1.5">
              <FaYoutube size={14} className="text-[#FF0000]" /> YouTube URL
            </label>
            <input
              className="input-field"
              placeholder="https://youtube.com/@yourchannel"
              disabled={disabled}
              value={social.youtube_url || ""}
              onChange={(e) => setSocial({ youtube_url: e.target.value })}
            />
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm">
              <FaYoutube size={14} className="text-[#FF0000] shrink-0" />
              <span className="text-muted-foreground">Subscribers</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {refreshingSocial ? (
                  <Loader2 size={14} className="animate-spin inline" />
                ) : (
                  formatFollowerCount(social.youtube_followers)
                )}
              </span>
            </div>
          </div>
        </div>

        {social.followers_fetched_at ? (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <RefreshCw size={11} />
            Counts last updated{" "}
            {new Date(social.followers_fetched_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Save your profile to fetch live follower counts from these links.
          </p>
        )}
      </section>
    </div>
  );
}

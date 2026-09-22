"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Film, Pause, Play } from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { ArtistMediaClip } from "@/lib/artistMeta";
import SafeCoverImage, {
  ARTIST_IMAGE_FALLBACK_CLASS,
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";
import PartnerMediaLightbox from "@/components/Shared/PartnerMediaLightbox";

type Props = {
  name: string;
  typeName?: string | null;
  coverSrc: string;
  audioClips: ArtistMediaClip[];
  spotlightVideos: ArtistMediaClip[];
  onAboutClick: () => void;
};

const AUDIO_PREVIEW_COUNT = 3;

export default function ArtistStageSection({
  name,
  typeName,
  coverSrc,
  audioClips,
  spotlightVideos,
  onAboutClick,
}: Props) {
  const hasSpotlight = spotlightVideos.length > 0;
  const hasAudio = !hasSpotlight && audioClips.length > 0;
  const [playing, setPlaying] = useState<number | null>(null);
  const [audioExpanded, setAudioExpanded] = useState(false);
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);
  const [videoStartIndex, setVideoStartIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    setAudioExpanded(false);
  }, [audioClips]);

  if (!hasSpotlight && !hasAudio) return null;

  const stopAudio = () => {
    audioRef.current?.pause();
  };

  const openVideoAt = (idx: number) => {
    stopAudio();
    setPlaying(null);
    setVideoStartIndex(idx);
    setVideoLightboxOpen(true);
  };

  const toggleAudio = (idx: number, url: string) => {
    if (playing === idx) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    stopAudio();
    const el = audioRef.current;
    if (!el) return;
    el.src = resolveMediaUrl(url);
    void el.play().catch(() => undefined);
    setPlaying(idx);
  };

  const artistThumb = (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F7E9FF] sm:h-[4.5rem] sm:w-[4.5rem]">
      <SafeCoverImage
        src={coverSrc}
        alt={name}
        className="h-full w-full object-cover object-top"
        fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
        fallback={<ArtistImageFallback size={28} />}
      />
    </div>
  );

  if (hasSpotlight) {
    const videoUrls = spotlightVideos.map((clip) => clip.url).filter(Boolean);
    return (
      <section className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
          Who&apos;s taking the stage
        </h2>
        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#E8E8E8] bg-white sm:rounded-[1.75rem]">
          <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
            {artistThumb}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-[#111111] sm:text-lg">
                {name}
              </p>
              {typeName ? (
                <p className="mt-0.5 text-sm text-[#8A8A8A]">{typeName}</p>
              ) : null}
              <button
                type="button"
                onClick={onAboutClick}
                className="mt-1 inline-flex items-center gap-0.5 text-sm font-bold text-[#111111] cursor-pointer hover:opacity-80"
              >
                About artist
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="border-t border-[#EFEFEF] px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {(spotlightVideos.length > 3
                ? spotlightVideos.slice(0, 3)
                : spotlightVideos
              ).map((clip, idx) => {
                const showMoreOverlay = spotlightVideos.length > 3 && idx === 2;
                return (
                  <button
                    key={`${clip.url}-${idx}`}
                    type="button"
                    onClick={() => openVideoAt(showMoreOverlay ? 0 : idx)}
                    className="overflow-hidden rounded-2xl border border-[#EFEFEF] bg-[#FAFAFA] text-left cursor-pointer group"
                    aria-label={
                      showMoreOverlay
                        ? `View all ${spotlightVideos.length} videos`
                        : `Play spotlight video ${idx + 1}`
                    }
                  >
                    <div className="relative aspect-[3/4] bg-black sm:aspect-[4/5]">
                      <video
                        src={resolveMediaUrl(clip.url)}
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      />
                      {showMoreOverlay ? (
                        <span className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-colors group-hover:bg-black/70">
                          <Film size={22} className="mb-1" strokeWidth={1.75} />
                          <span className="font-bold text-sm tracking-wide">
                            View all videos
                          </span>
                          <span className="text-[0.625rem] text-white/70 mt-0.5">
                            {spotlightVideos.length} Videos
                          </span>
                        </span>
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#111111] shadow-md">
                            <Play size={18} fill="currentColor" className="ml-0.5" />
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <PartnerMediaLightbox
          open={videoLightboxOpen}
          items={videoUrls}
          startIndex={videoStartIndex}
          kind="video"
          label={`${name} spotlight`}
          onClose={() => setVideoLightboxOpen(false)}
        />
      </section>
    );
  }

  const visibleAudio =
    audioExpanded || audioClips.length <= AUDIO_PREVIEW_COUNT
      ? audioClips
      : audioClips.slice(0, AUDIO_PREVIEW_COUNT);
  const canToggleAudio = audioClips.length > AUDIO_PREVIEW_COUNT;

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
        Who&apos;s taking the stage
      </h2>
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#E8E8E8] bg-white sm:rounded-[1.75rem]">
        <div className="flex flex-col md:flex-row">
          <div className="flex shrink-0 flex-col items-start px-5 py-5 sm:px-6 sm:py-6 md:w-[13.5rem] lg:w-[15rem] md:border-r md:border-[#EFEFEF]">
            <div className="h-[7.5rem] w-[7.5rem] overflow-hidden rounded-2xl bg-[#F7E9FF] sm:h-32 sm:w-32">
              <SafeCoverImage
                src={coverSrc}
                alt={name}
                className="h-full w-full object-cover object-top"
                fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
                fallback={<ArtistImageFallback size={36} />}
              />
            </div>
            <p className="mt-3 max-w-full truncate text-base font-bold text-[#111111] sm:text-[17px]">
              {name}
            </p>
            {typeName ? (
              <p className="mt-0.5 text-sm text-[#8A8A8A]">{typeName}</p>
            ) : null}
            <button
              type="button"
              onClick={onAboutClick}
              className="mt-2 inline-flex items-center gap-0.5 text-sm font-bold text-[#111111] cursor-pointer hover:opacity-80"
            >
              About artist
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="min-w-0 flex-1 border-t border-[#EFEFEF] px-2 py-2 sm:px-3 sm:py-3 md:border-t-0">
            {visibleAudio.map((clip, idx) => {
              const active = playing === idx;
              return (
                <div
                  key={`${clip.url}-${idx}`}
                  className={idx > 0 ? "border-t border-[#F3F4F6]" : ""}
                >
                  <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
                    <p className="min-w-0 flex-1 truncate text-[13px] text-[#333333] sm:text-sm">
                      {idx + 1}. {clip.title || `Track ${idx + 1}`}
                    </p>
                    <button
                      type="button"
                      aria-label={active ? "Pause" : "Play"}
                      onClick={() => toggleAudio(idx, clip.url)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F7F7F7] text-[#111111] hover:bg-[#EEE] cursor-pointer"
                    >
                      {active ? (
                        <Pause size={12} fill="currentColor" />
                      ) : (
                        <Play size={12} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
            {canToggleAudio ? (
              <div className="border-t border-[#F3F4F6] px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={() => setAudioExpanded((v) => !v)}
                  className="text-sm font-bold text-[#6900AA] cursor-pointer hover:underline"
                >
                  {audioExpanded ? "See less" : "See more"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
    </section>
  );
}

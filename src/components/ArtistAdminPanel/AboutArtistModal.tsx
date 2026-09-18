"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  formatFollowerCount,
  type ArtistMediaClip,
} from "@/lib/artistMeta";
import SafeCoverImage, {
  ARTIST_IMAGE_FALLBACK_CLASS,
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  typeName?: string | null;
  coverSrc: string;
  description?: string | null;
  instagramUrl?: string;
  youtubeUrl?: string;
  instagramFollowers?: number | null;
  youtubeFollowers?: number | null;
  audioClips: ArtistMediaClip[];
  spotlightVideos: ArtistMediaClip[];
};

function hasCount(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n >= 0;
}

function SocialStat({
  href,
  icon,
  value,
  label,
}: {
  href?: string;
  icon: ReactNode;
  value: string;
  label: string;
}) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-bold leading-tight text-[#111111] sm:text-[15px]">
          {value}
        </span>
        <span className="block text-[11px] text-[#8A8A8A] sm:text-xs">{label}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2.5 hover:opacity-80"
      >
        {inner}
      </a>
    );
  }

  return <div className="flex items-start gap-2.5">{inner}</div>;
}

function MediaRow({
  index,
  title,
  active,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  active: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={index > 0 ? "border-t border-[#F3F4F6]" : ""}>
      <div className="flex items-center gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <p className="min-w-0 flex-1 truncate text-[13px] text-[#333333] sm:text-sm">
          {index + 1}. {title}
        </p>
        <button
          type="button"
          aria-label={active ? "Pause" : "Play"}
          onClick={onToggle}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] text-[#111111] hover:bg-[#F9FAFB] cursor-pointer"
        >
          {active ? (
            <Pause size={12} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" className="ml-0.5" />
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AboutArtistModal({
  open,
  onClose,
  name,
  typeName,
  coverSrc,
  description,
  instagramUrl,
  youtubeUrl,
  instagramFollowers,
  youtubeFollowers,
  audioClips,
  spotlightVideos,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioTruncated, setBioTruncated] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bioRef = useRef<HTMLParagraphElement | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      Object.values(videoRefs.current).forEach((el) => el?.pause());
      setPlayingAudio(null);
      setPlayingVideo(null);
      setBioExpanded(false);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || bioExpanded) return;
    const el = bioRef.current;
    if (!el) {
      setBioTruncated(false);
      return;
    }
    const update = () => setBioTruncated(el.scrollHeight > el.clientHeight + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, bioExpanded, description]);

  useEffect(() => {
    if (playingVideo == null) return;
    const el = videoRefs.current[playingVideo];
    void el?.play().catch(() => undefined);
  }, [playingVideo]);

  if (!mounted || !open) return null;

  const showYoutube = hasCount(youtubeFollowers);
  const showInstagram = hasCount(instagramFollowers);
  const hasStats = showYoutube || showInstagram;
  const bio = description?.trim() || "";

  const stopAudio = () => {
    audioRef.current?.pause();
    setPlayingAudio(null);
  };

  const stopVideos = (except?: number) => {
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (except != null && Number(key) === except) return;
      el?.pause();
    });
  };

  const toggleAudio = (idx: number, url: string) => {
    stopVideos();
    setPlayingVideo(null);
    const el = audioRef.current;
    if (!el) return;
    if (playingAudio === idx) {
      el.pause();
      setPlayingAudio(null);
      return;
    }
    el.src = resolveMediaUrl(url);
    void el.play().catch(() => undefined);
    setPlayingAudio(idx);
  };

  const toggleVideo = (idx: number) => {
    stopAudio();
    if (playingVideo === idx) {
      videoRefs.current[idx]?.pause();
      setPlayingVideo(null);
      return;
    }
    stopVideos(idx);
    setPlayingVideo(idx);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6"
      role="presentation"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close about artist"
        className="absolute inset-0 cursor-pointer bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-artist-title"
        className="relative z-10 flex w-full max-h-[92vh] sm:max-h-[90vh] sm:max-w-[520px] md:max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[#F3F4F6] bg-white px-4 py-3.5 sm:px-5 sm:py-4">
          <h2
            id="about-artist-title"
            className="text-lg font-bold text-[#111111] sm:text-xl"
          >
            About artist
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#555] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-5 sm:pb-7 sm:pt-5">
          <div className="rounded-2xl border border-[#EFEFEF] bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:px-5 sm:py-5">
            <div
              className={`flex flex-col items-center gap-4 ${
                hasStats ? "sm:flex-row sm:items-start sm:gap-6" : ""
              }`}
            >
              <div
                className={`flex shrink-0 flex-col items-center ${
                  hasStats ? "sm:w-28" : ""
                }`}
              >
                <div className="h-24 w-24 overflow-hidden rounded-full bg-[#F7E9FF] sm:h-28 sm:w-28">
                  <SafeCoverImage
                    src={coverSrc}
                    alt={name}
                    className="h-full w-full object-cover object-top"
                    fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
                    fallback={<ArtistImageFallback size={32} />}
                  />
                </div>
                <p className="mt-2.5 max-w-[11rem] truncate text-center text-sm font-bold text-[#111111] sm:max-w-none sm:w-full sm:text-[15px]">
                  {name}
                </p>
                {typeName ? (
                  <p className="mt-0.5 text-center text-xs text-[#8A8A8A] sm:text-[13px]">
                    {typeName}
                  </p>
                ) : null}
              </div>

              {hasStats ? (
                <div className="flex flex-row flex-wrap items-start justify-center gap-x-6 gap-y-3 sm:flex-1 sm:flex-col sm:justify-center sm:gap-3.5 sm:pt-2">
                  {showYoutube ? (
                    <SocialStat
                      href={youtubeUrl || undefined}
                      icon={<FaYoutube size={16} className="text-[#111111]" />}
                      value={formatFollowerCount(youtubeFollowers)}
                      label="Subscribers"
                    />
                  ) : null}
                  {showInstagram ? (
                    <SocialStat
                      href={instagramUrl || undefined}
                      icon={<FaInstagram size={16} className="text-[#111111]" />}
                      value={formatFollowerCount(instagramFollowers)}
                      label="Followers"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {bio ? (
            <div className="mt-4 sm:mt-5">
              <p
                ref={bioRef}
                className={`text-[13px] leading-relaxed text-[#4A4A4A] whitespace-pre-wrap sm:text-sm sm:leading-6 ${
                  bioExpanded ? "" : "line-clamp-4"
                }`}
              >
                {bio}
              </p>
              {bioTruncated || bioExpanded ? (
                <button
                  type="button"
                  onClick={() => setBioExpanded((v) => !v)}
                  className="mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-bold text-[#111111] cursor-pointer hover:opacity-80 sm:text-sm"
                >
                  {bioExpanded ? "Read less" : "Read more"}
                  {bioExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              ) : null}
            </div>
          ) : null}

          {audioClips.length > 0 ? (
            <section className="mt-5 sm:mt-6">
              <h3 className="text-base font-bold text-[#111111] sm:text-lg">Playlist</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#EFEFEF]">
                {audioClips.map((clip, idx) => (
                  <MediaRow
                    key={`${clip.url}-${idx}`}
                    index={idx}
                    title={clip.title || `Track ${idx + 1}`}
                    active={playingAudio === idx}
                    onToggle={() => toggleAudio(idx, clip.url)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {spotlightVideos.length > 0 ? (
            <section className="mt-5 sm:mt-6">
              <h3 className="text-base font-bold text-[#111111] sm:text-lg">Spotlight</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#EFEFEF]">
                {spotlightVideos.map((clip, idx) => {
                  const active = playingVideo === idx;
                  return (
                    <MediaRow
                      key={`${clip.url}-${idx}`}
                      index={idx}
                      title={clip.title || `Spotlight ${idx + 1}`}
                      active={active}
                      onToggle={() => toggleVideo(idx)}
                    >
                      <video
                        ref={(node) => {
                          videoRefs.current[idx] = node;
                        }}
                        src={resolveMediaUrl(clip.url)}
                        playsInline
                        controls={active}
                        onEnded={() => setPlayingVideo(null)}
                        className={
                          active
                            ? "mx-3.5 mb-3 w-[calc(100%-1.75rem)] max-h-52 rounded-lg bg-black sm:mx-4 sm:w-[calc(100%-2rem)]"
                            : "hidden"
                        }
                      />
                    </MediaRow>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <audio
          ref={audioRef}
          onEnded={() => setPlayingAudio(null)}
          className="hidden"
        />
      </div>
    </div>,
    document.body
  );
}

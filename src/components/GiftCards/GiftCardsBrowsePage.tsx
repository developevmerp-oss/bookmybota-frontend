"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Ticket, X } from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { DEFAULT_DESIGN_GRADIENT } from "@/lib/giftCardDesigns";
import {
  useGetPublicGiftCardDesignCategoriesQuery,
  useGetPublicGiftCardDesignsQuery,
  useGetPublicGiftCardSettingsQuery,
} from "@/services/api";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import { CustomerGiftCardsShimmer, SearchResultsListShimmer } from "@/components/Shared/Shimmer";
import {
  DEFAULT_GIFT_CARD_VALIDITY_DAYS,
  formatGiftCardValidityLabel,
} from "@/lib/giftCardValidity";

export default function GiftCardsBrowsePage() {
  const router = useRouter();
  const [category, setCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPopupOpen, setSearchPopupOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [debouncedDraft, setDebouncedDraft] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedDraft(searchDraft.trim()), 180);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bmb_gift_card_recent_searches");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((s): s is string => typeof s === "string").slice(0, 8));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.history.state?.bmbGiftCards !== true) {
      window.history.pushState({ bmbGiftCards: true }, "");
    }
    const onPopState = () => {
      if (searchPopupOpen) {
        setSearchPopupOpen(false);
        return;
      }
      router.replace("/customer/profile");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router, searchPopupOpen]);

  useEffect(() => {
    if (!searchPopupOpen) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [searchPopupOpen]);

  const openSearchPopup = () => {
    setSearchDraft(searchQuery);
    setSearchPopupOpen(true);
  };

  const commitGiftCardSearch = (term: string) => {
    const trimmed = term.trim();
    if (trimmed) {
      setRecentSearches((prev) => {
        const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
        try {
          localStorage.setItem("bmb_gift_card_recent_searches", JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
    setSearchQuery(trimmed);
    setSearchPopupOpen(false);
  };

  const { data: categories = [] } = useGetPublicGiftCardDesignCategoriesQuery();
  const queryArg = useMemo(() => {
    const cat = category === "all" ? undefined : category;
    const q = searchQuery.trim() || undefined;
    if (!cat && !q) return undefined;
    return { ...(cat ? { category: cat } : {}), ...(q ? { q } : {}) };
  }, [category, searchQuery]);
  const { data: designs = [], isLoading, isFetching, isError } = useGetPublicGiftCardDesignsQuery(queryArg);
  const { data: popupMatchedDesigns = [], isFetching: popupSearching } =
    useGetPublicGiftCardDesignsQuery(
      { q: debouncedDraft },
      { skip: !searchPopupOpen || !debouncedDraft }
    );
  const filteredDesigns = designs;
  const { data: settings } = useGetPublicGiftCardSettingsQuery();
  const validityLabel = formatGiftCardValidityLabel(
    settings?.validity_days || DEFAULT_GIFT_CARD_VALIDITY_DAYS
  );

  const tabs = useMemo(
    () => [
      { key: "all", label: "All" },
      ...categories.map((c) => ({ key: c.code, label: c.name })),
    ],
    [categories]
  );

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* ── Mobile / tablet: BMS frosted chrome ── */}
      <div
        className="bmb-movies-frost-chrome lg:hidden fixed top-0 inset-x-0 z-40"
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}
      >
        <div
          className="bmb-movies-frost-chrome__glass"
          aria-hidden
          style={{
            background: "rgba(255,255,255,0.55)",
            WebkitBackdropFilter: "blur(18px) saturate(180%)",
            backdropFilter: "blur(18px) saturate(180%)",
          }}
        />
        <div className="bmb-movies-frost-chrome__fade" aria-hidden />
        <div className="bmb-movies-frost-chrome__content">
          <div className="flex items-center gap-1 px-2 sm:px-3 pt-2 pb-2 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/customer/profile")}
              aria-label="Back"
              className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
            >
              <ArrowLeft size={22} strokeWidth={2.25} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] sm:text-[17px] font-bold text-[#111111] leading-tight truncate drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]">
                Gift Cards
              </h1>
              <p className="mt-0.5 text-[12px] sm:text-[13px] font-medium text-[#6B7280] truncate">
                {isLoading ? "…" : `${filteredDesigns.length} Design${filteredDesigns.length === 1 ? "" : "s"}`} · Valid {validityLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={openSearchPopup}
              aria-label="Search gift cards"
              className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
            >
              <Search size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <div className="lg:hidden h-14 shrink-0 pointer-events-none" aria-hidden />

      <div className="bmb-section-container pt-3 pb-12 sm:py-8 lg:py-10 sm:pb-16">
        <div className="hidden lg:block text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#1a1a1a] tracking-tight">
            BookMyBota Gift Cards
          </h1>
          <p className="mt-2 text-[15px] text-slate-500 max-w-xl mx-auto">
            Pick a design, choose an amount, and email an e-gift to someone special.
            Cards are valid for {validityLabel} from delivery.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 mb-7 sm:mb-10">
          {tabs.map((tab) => {
            const active = category === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategory(tab.key)}
                className={`h-9 sm:h-10 px-4 sm:px-5 rounded-full text-[13px] sm:text-sm font-semibold border transition-colors cursor-pointer ${active
                  ? "bg-[#6900AA] border-[#6900AA] text-white shadow-[0_4px_14px_rgba(105,0,170,0.28)]"
                  : "bg-white border-slate-300 text-slate-700 hover:border-[#6900AA]/50 hover:text-[#6900AA]"
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {searchQuery ? (
          <div className="mb-5 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8D5FF] bg-[#F9F5FF] px-3.5 py-1.5 text-xs font-semibold text-[#6900AA]">
              Search: &ldquo;{searchQuery}&rdquo;
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear gift card search"
                className="rounded-full p-0.5 hover:bg-[#6900AA]/10 cursor-pointer"
              >
                <X size={13} />
              </button>
            </span>
          </div>
        ) : null}

        {isLoading || isFetching ? (
          <CustomerGiftCardsShimmer embedded variant="browse" />
        ) : isError ? (
          <p className="text-center text-rose-600 py-16">Could not load designs. Try again later.</p>
        ) : filteredDesigns.length === 0 ? (
          <p className="text-center text-slate-500 py-16">
            {searchQuery
              ? `No gift card designs matching “${searchQuery}”.`
              : "No gift card designs are available right now."}
          </p>
        ) : (
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredDesigns.map((design) => (
              <Link
                key={design.id}
                href={`/gift-cards/buy/${design.id}`}
                className="group block rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(17,17,17,0.08)] hover:shadow-[0_12px_28px_rgba(17,17,17,0.14)] hover:-translate-y-0.5 transition-[transform,shadow] duration-300 ring-1 ring-black/5"
              >
                <GiftCardDesignFace
                  design={design}
                  className="aspect-[16/10] w-full group-hover:brightness-[1.03] transition-[filter]"
                />
              </Link>
            ))}
          </div>
        )}

        {/* Redeem / claim — customer wallet */}
        <div className="mt-10 sm:mt-14 mx-auto max-w-3xl rounded-2xl border border-[#E8D5FF] bg-[#F9F5FF] px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-[#E8D5FF] text-[#6900AA]">
              <Ticket size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[#1a1a1a]">Already have a gift card?</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Claim it to your BookMyBota wallet and redeem at checkout.
              </p>
            </div>
          </div>
          <Link
            href="/customer/gift-cards"
            className="shrink-0 inline-flex items-center justify-center h-10 px-5 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#56008a] transition-colors"
          >
            My Gift Cards
          </Link>
        </div>
      </div>

      {searchPopupOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="dining-search-popup fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[min(18vh,140px)]">
            <button
              type="button"
              aria-label="Close search"
              className="dining-search-popup__backdrop absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
              onClick={() => setSearchPopupOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search gift cards"
              className="dining-search-popup__panel relative w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-[1.15rem]">
                <Search size={20} strokeWidth={1.75} className="text-slate-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitGiftCardSearch(searchDraft);
                    }
                  }}
                  placeholder="What are you looking for?"
                  className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-base text-slate-800 placeholder:text-slate-400 outline-none"
                  aria-label="Search gift cards"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchDraft("");
                      searchInputRef.current?.focus();
                    }}
                    className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="dining-search-popup__results border-t border-slate-100 max-h-[min(52vh,420px)] overflow-y-auto">
                <div className="px-5 sm:px-6 pt-4 pb-5">
                  {searchDraft.trim() ? (
                    (() => {
                      const trimmedDraft = searchDraft.trim();
                      const isPopupBusy = debouncedDraft !== trimmedDraft || popupSearching;
                      const matched = debouncedDraft === trimmedDraft ? popupMatchedDesigns : [];
                      return (
                        <>
                          <p className="text-[15px] font-bold text-slate-900 mb-2">Gift Cards</p>
                          {isPopupBusy ? (
                            <div className="mb-3">
                              <SearchResultsListShimmer rows={4} />
                            </div>
                          ) : matched.length > 0 ? (
                            <ul className="divide-y divide-slate-100 mb-3">
                              {matched.slice(0, 6).map((d) => {
                                const img = resolveMediaUrl(d.image_url);
                                const gradient = d.color_gradient || DEFAULT_DESIGN_GRADIENT;
                                return (
                                  <li key={d.id}>
                                    <Link
                                      href={`/gift-cards/buy/${d.id}`}
                                      onClick={() => setSearchPopupOpen(false)}
                                      className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                                    >
                                      <span className={`h-10 w-14 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br ${gradient}`}>
                                        {img ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={img}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-slate-900 truncate">
                                          {d.title}
                                        </span>
                                        <span className="block text-xs text-slate-500 truncate capitalize">
                                          {d.category || "Gift Card"}
                                        </span>
                                      </span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => commitGiftCardSearch(searchDraft)}
                            className="w-full text-left rounded-xl bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-[#6900AA] cursor-pointer"
                          >
                            Search gift cards for &ldquo;{searchDraft.trim()}&rdquo;
                          </button>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <p className="text-[15px] font-bold text-slate-900 mb-2">Recent Searches</p>
                      {recentSearches.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => commitGiftCardSearch(term)}
                              className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 py-1">No recent searches yet</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

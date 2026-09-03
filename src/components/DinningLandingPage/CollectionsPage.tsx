"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useGetCollectionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";

function CollectionsContent() {
  const searchParams = useSearchParams();
  const [city, setCity] = useState("");

  // Load the active city from params or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cityParam = searchParams.get("city") || localStorage.getItem("selected_city") || "";
      setCity(cityParam);
    }
  }, [searchParams]);

  const { data: collections = [], isLoading } = useGetCollectionsQuery();

  return (
    <div className="min-h-screen bg-slate-50 pt-6 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
        <div className="text-xs text-slate-400 mb-6 flex items-center gap-1.5 font-semibold tracking-wider uppercase">
          <Link href="/" className="hover:text-rose-600 transition-colors">Home</Link>
          <ChevronRight size={10} />
          <span className="text-slate-500">Collections</span>
        </div>

        {/* ── Hero Header Section ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-10 border border-slate-750">
          {/* Subtle design element */}
          <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80)" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(244,63,94,0.15),transparent_60%)]" />

          <div className="relative z-10 max-w-3xl">
            <span className="text-rose-400 text-xs font-black uppercase tracking-[0.25em] block mb-2">
              Curated Guides
            </span>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-none tracking-tight mb-4">
              Handpicked Collections{city && city !== "All Cities" ? ` in ${city}` : ""}
            </h1>
            <p className="text-white/70 text-sm md:text-base font-medium leading-relaxed max-w-xl">
              Explore custom lists of premium establishments, trendy cafes, hidden gems, and romantic setups. Verified by experts to make your next dining plan flawless.
            </p>
          </div>
        </div>

        {/* ── Collections Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
            <Loader2 size={36} className="animate-spin text-rose-600" />
            <p className="text-sm font-semibold">Gathering collections guides...</p>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 max-w-md mx-auto">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-bold text-slate-700">No collections found</h3>
            <p className="text-slate-400 text-xs mt-1">Please seed collections in database or try again later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collections.map((collection) => {
              const placesCount = collection.places_count !== undefined 
                ? `${collection.places_count} Place${collection.places_count !== 1 ? 's' : ''}`
                : collection.subtitle || "0 Places";

              return (
                <Link
                  key={collection.id}
                  href={`/search?collection=${collection.slug}${city && city !== "All Cities" ? `&city=${encodeURIComponent(city)}` : ""}`}
                  className="relative group h-80 rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 block border border-slate-100/50 bg-slate-100"
                >
                  <img
                    src={resolveMediaUrl(collection.image_url) || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"}
                    alt={collection.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                    }}
                  />
                  {/* Backdrop Gradient Overlay matching collection color scheme */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${collection.color_gradient || 'from-rose-950/85'} via-black/10 to-transparent`} />
                  
                  {/* Content container */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5 select-none">
                    <span className="inline-block self-start text-[9px] font-black uppercase bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-md mb-2 tracking-wider">
                      {placesCount}
                    </span>
                    <h3 className="text-white font-extrabold text-lg leading-tight tracking-tight">
                      {collection.title}
                    </h3>
                    <p className="text-white/80 text-xs font-semibold mt-1 truncate">
                      {collection.subtitle || "Curated local favorites"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
          <Loader2 size={36} className="animate-spin text-rose-600" />
          <p className="text-sm font-semibold">Loading guides space...</p>
        </div>
      }
    >
      <CollectionsContent />
    </Suspense>
  );
}

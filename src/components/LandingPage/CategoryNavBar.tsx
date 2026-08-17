"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useGetPublicEventFiltersQuery } from "@/services/api";

const LEFT = [
  { label: "Music", key: "music" },
  { label: "Concert", key: "concert" },
  { label: "Comedy", key: "comedy" },
  { label: "Sports", key: "sports" },
  { label: "Dining", href: "/dining" },
] as const;

const RIGHT = [
  { label: "Offers", href: "#offers" },
  { label: "Gifts", href: "#gifts" },
];

function eventHref(
  key: string,
  categories: Array<{ slug: string; name: string }>
) {
  const match = categories.find((c) => {
    const slug = c.slug.toLowerCase();
    const name = c.name.toLowerCase();
    return slug === key || name === key || slug.includes(key) || name.includes(key);
  });
  if (match) return `/events?category=${encodeURIComponent(match.slug)}`;
  return `/events?q=${encodeURIComponent(key)}`;
}

function linkClass(active: boolean) {
  return `relative shrink-0 text-[13px] pb-0.5 ${
    active ? "text-white font-medium" : "text-[#C8C8C8] hover:text-white"
  }`;
}

export default function CategoryNavBar() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const { data: filters } = useGetPublicEventFiltersQuery();
  const categories = filters?.categories || [];
  const q = (searchParams.get("q") || "").toLowerCase();
  const activeSlug = (searchParams.get("category") || "").toLowerCase();
  const onEvents = pathname === "/events" || pathname.startsWith("/events/");
  const onDining = pathname === "/dining" || pathname.startsWith("/dining/");

  return (
    <nav className="sticky top-16 z-40 bg-[#1F1F1F]">
      <div className="max-w-7xl mx-auto h-11 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 sm:gap-7 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LEFT.map((item) => {
            const href = "href" in item ? item.href : eventHref(item.key, categories);
            const active =
              "href" in item
                ? onDining
                : onEvents &&
                  (activeSlug === item.key ||
                    activeSlug.includes(item.key) ||
                    q === item.key);
            return (
              <Link key={item.label} href={href} className={linkClass(active)}>
                {item.label}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-1.5 h-[2px] bg-[#7C5CFF]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-5 sm:gap-7 shrink-0">
          <span className="hidden sm:block w-px h-4 bg-white/20" />
          {RIGHT.map((item) => (
            <Link key={item.label} href={item.href} className={linkClass(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

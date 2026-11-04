import { redirect } from "next/navigation";

/** Showtimes and Seat Manager are now one module: Shows & Seats. */
export default async function LegacyShowtimesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/movie/shows?${qs}` : "/movie/shows");
}

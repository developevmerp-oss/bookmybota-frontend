"use client";

import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import MovieLandingPage from "@/components/MovieAdminPanel/MovieLandingPage";

export default function MovieHomePage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const isMovieAdmin = user?.role === "movie_admin";

  useEffect(() => {
    if (isMovieAdmin) router.replace("/movie/dashboard");
  }, [isMovieAdmin, router]);

  if (isMovieAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  return <MovieLandingPage />;
}

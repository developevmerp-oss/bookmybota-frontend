"use client";

import { useParams } from "next/navigation";
import AdminMovieFormPage from "@/components/SuperAdmin/AdminMovieFormPage";

export default function AdminMovieEditPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  return <AdminMovieFormPage mode="edit" movieId={id} />;
}

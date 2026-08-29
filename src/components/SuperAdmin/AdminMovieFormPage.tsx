"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateAdminMovieMutation,
  useGetAdminMovieQuery,
  useUpdateAdminMovieMutation,
  useUploadImageMutation,
  type Movie,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";

const STATUS_OPTIONS: Movie["status"][] = ["draft", "coming_soon", "now_showing", "archived"];

const STATUS_LABEL: Record<Movie["status"], string> = {
  draft: "Draft",
  coming_soon: "Coming soon",
  now_showing: "Now showing",
  archived: "Archived",
};

type FormState = {
  title: string;
  description: string;
  poster_url: string;
  banner_url: string;
  trailer_url: string;
  duration_minutes: string;
  certificate: string;
  release_date: string;
  languages: string;
  genres: string;
  formats: string;
  cast_text: string;
  director: string;
  status: Movie["status"];
};

const emptyForm: FormState = {
  title: "",
  description: "",
  poster_url: "",
  banner_url: "",
  trailer_url: "",
  duration_minutes: "",
  certificate: "",
  release_date: "",
  languages: "",
  genres: "",
  formats: "",
  cast_text: "",
  director: "",
  status: "draft",
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinCsv(value?: string[] | null): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

interface AdminMovieFormPageProps {
  mode: "create" | "edit";
  movieId?: string;
}

export default function AdminMovieFormPage({ mode, movieId }: AdminMovieFormPageProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const { data: movie, isLoading } = useGetAdminMovieQuery(movieId || "", {
    skip: !isEdit || !movieId,
  });
  const [createMovie, { isLoading: creating }] = useCreateAdminMovieMutation();
  const [updateMovie, { isLoading: updating }] = useUpdateAdminMovieMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [hydrated, setHydrated] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || !movie) return;
    setForm({
      title: movie.title || "",
      description: movie.description || "",
      poster_url: movie.poster_url || "",
      banner_url: movie.banner_url || "",
      trailer_url: movie.trailer_url || "",
      duration_minutes: movie.duration_minutes != null ? String(movie.duration_minutes) : "",
      certificate: movie.certificate || "",
      release_date: movie.release_date ? String(movie.release_date).slice(0, 10) : "",
      languages: joinCsv(movie.languages),
      genres: joinCsv(movie.genres),
      formats: joinCsv(movie.formats),
      cast_text: movie.cast_text || "",
      director: movie.director || "",
      status: movie.status || "draft",
    });
    setHydrated(true);
  }, [isEdit, movie]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const uploadField = async (file: File, key: "poster_url" | "banner_url") => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await uploadImage(fd).unwrap();
      if (!res.url) return;
      setField(key, res.url);
    } catch (err) {
      toast.error(extractApiError(err, key === "poster_url" ? "Poster upload failed" : "Banner upload failed"));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      poster_url: form.poster_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      certificate: form.certificate.trim() || null,
      release_date: form.release_date || null,
      languages: splitCsv(form.languages),
      genres: splitCsv(form.genres),
      formats: splitCsv(form.formats),
      cast_text: form.cast_text.trim() || null,
      director: form.director.trim() || null,
      status: form.status,
    };
    try {
      if (isEdit && movieId) {
        await updateMovie({ id: movieId, body: payload }).unwrap();
        toast.success("Movie updated");
      } else {
        await createMovie(payload).unwrap();
        toast.success("Movie created");
      }
      router.push("/admin/movies");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save movie"));
    }
  };

  const saving = creating || updating;

  if (isEdit && isLoading) {
    return <div className="text-slate-500 p-10 text-center">Loading movie…</div>;
  }

  if (isEdit && !movie && !isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">Movie not found.</p>
        <Link href="/admin/movies" className="text-rose-600 hover:text-rose-500 font-semibold">
          Back to movies
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="text-slate-500 p-10 text-center">Loading…</div>;
  }

  return (
    <div className="w-full">
      <Link
        href="/admin/movies"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft size={16} /> Back to movies
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {isEdit ? "Edit movie" : "Add movie"}
      </h1>
      <p className="text-slate-500 mb-8 text-sm">
        {isEdit
          ? "Update catalog details. Cinema partners see coming soon / now showing titles when scheduling shows."
          : "Add a title to the platform catalog. Cinema partners will pick from this list when scheduling shows."}
      </p>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8"
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <FieldLabel required>Title</FieldLabel>
            <input
              className="input-field w-full"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Movie title"
            />
          </div>

          <div>
            <FieldLabel>Status</FieldLabel>
            <select
              className="input-field w-full"
              value={form.status}
              onChange={(e) => setField("status", e.target.value as Movie["status"])}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Certificate</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="UA / U / A"
              value={form.certificate}
              onChange={(e) => setField("certificate", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Duration (minutes)</FieldLabel>
            <input
              className="input-field w-full"
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={(e) => setField("duration_minutes", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Release date</FieldLabel>
            <input
              className="input-field w-full"
              type="date"
              value={form.release_date}
              onChange={(e) => setField("release_date", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Director</FieldLabel>
            <input
              className="input-field w-full"
              value={form.director}
              onChange={(e) => setField("director", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Languages</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="English, Hindi"
              value={form.languages}
              onChange={(e) => setField("languages", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated</p>
          </div>

          <div>
            <FieldLabel>Genres</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="Action, Sci-Fi"
              value={form.genres}
              onChange={(e) => setField("genres", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated</p>
          </div>

          <div>
            <FieldLabel>Formats</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="2D, 3D, IMAX 2D"
              value={form.formats}
              onChange={(e) => setField("formats", e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated screen formats</p>
          </div>

          <div>
            <FieldLabel>Trailer URL</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="https://"
              value={form.trailer_url}
              onChange={(e) => setField("trailer_url", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Cast</FieldLabel>
            <textarea
              className="input-field w-full min-h-[96px]"
              value={form.cast_text}
              onChange={(e) => setField("cast_text", e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              className="input-field w-full min-h-[110px]"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Poster</FieldLabel>
            <CroppedImageField
              value={form.poster_url}
              aspect={2 / 3}
              previewClassName="w-full h-56 rounded-xl border border-slate-200"
              emptyClassName="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-500"
              emptyLabel="Add poster"
              onRemove={() => setField("poster_url", "")}
              onCroppedFile={(file) => uploadField(file, "poster_url")}
            />
          </div>

          <div>
            <FieldLabel>Banner</FieldLabel>
            <CroppedImageField
              value={form.banner_url}
              aspect={16 / 9}
              previewClassName="w-full h-56 rounded-xl border border-slate-200"
              emptyClassName="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-500"
              emptyLabel="Add banner"
              onRemove={() => setField("banner_url", "")}
              onCroppedFile={(file) => uploadField(file, "banner_url")}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <Link
            href="/admin/movies"
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 text-center"
          >
            Cancel
          </Link>
          <button type="submit" disabled={saving || uploading} className="btn-primary inline-flex items-center justify-center gap-2">
            {saving || uploading ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create movie"}
          </button>
        </div>
      </form>
    </div>
  );
}

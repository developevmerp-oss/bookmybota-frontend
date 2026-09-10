import { redirect } from "next/navigation";

/** Content Management placeholder removed — redirect old bookmarks. */
export default function ContentPage() {
  redirect("/admin");
}

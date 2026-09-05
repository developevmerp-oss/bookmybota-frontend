import { redirect } from "next/navigation";

/** Designs are managed under Gift Cards → Designs tab */
export default function Page() {
  redirect("/admin/gift-cards");
}

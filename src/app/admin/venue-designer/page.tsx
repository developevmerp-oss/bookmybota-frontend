import { redirect } from "next/navigation";

// One layout flow: venue and cinema layouts are built in the Universal Designer from Venue & Cinema Layouts.
export default function VenueDesignerRedirect() {
  redirect("/admin/venue-layouts");
}

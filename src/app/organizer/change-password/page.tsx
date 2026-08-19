"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrganizerChangePasswordRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/organizer/profile#password");
  }, [router]);
  return <div className="text-zinc-400 py-10 text-center">Opening profile...</div>;
}

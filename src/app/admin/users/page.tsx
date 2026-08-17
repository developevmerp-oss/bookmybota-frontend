"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UsersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/customers");
  }, [router]);
  return <div className="text-zinc-400 p-10 text-center">Redirecting to customers...</div>;
}

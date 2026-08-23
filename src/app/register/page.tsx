"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Registration uses the same unified phone + OTP flow as login. */
export default function RegisterRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return null;
}

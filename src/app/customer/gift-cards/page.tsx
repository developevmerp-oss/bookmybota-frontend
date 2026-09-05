import { Suspense } from "react";
import CustomerGiftCardsPage from "@/components/GiftCards/CustomerGiftCardsPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          Loading gift cards…
        </div>
      }
    >
      <CustomerGiftCardsPage />
    </Suspense>
  );
}

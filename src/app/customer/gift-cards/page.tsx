import { Suspense } from "react";
import CustomerGiftCardsPage from "@/components/GiftCards/CustomerGiftCardsPage";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { CustomerGiftCardsShimmer } from "@/components/Shared/Shimmer";

export default function Page() {
  return (
    <Suspense
      fallback={
        <CustomerAccountLayout>
          <CustomerGiftCardsShimmer />
        </CustomerAccountLayout>
      }
    >
      <CustomerGiftCardsPage />
    </Suspense>
  );
}

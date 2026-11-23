import { useGetCinemaContractQuery } from "@/services/api";

/**
 * A cinema unlocks the rest of the panel once it has signed its platform contract
 * (or the contract is already ACTIVE). Until then only Dashboard, Contract and Screens & Layouts are usable.
 */
export function useContractGate() {
  const { data: contract, isLoading } = useGetCinemaContractQuery();
  const unlocked = !!contract && (contract.status === "ACTIVE" || !!contract.cinema_signed_at);
  return { contract, isLoading, unlocked };
}

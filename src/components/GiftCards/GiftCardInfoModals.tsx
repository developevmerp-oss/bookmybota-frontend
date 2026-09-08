"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "sonner";
import { useCheckGiftCardBalanceMutation, useGetPublicGiftCardFaqsQuery, useGetPublicGiftCardTermsQuery } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import { formatGiftCardExpiryDate } from "@/lib/giftCardValidity";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

export type GiftCardInfoModalKind = "terms" | "help" | "balance" | null;

type ShellProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
};

function GiftCardModalShell({ open, title, onClose, children, wide }: ShellProps) {
  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-card-info-modal-title"
        className={`relative z-[1] w-full ${
          wide ? "max-w-xl" : "max-w-lg"
        } max-h-[min(92vh,720px)] flex flex-col rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.28)] overflow-hidden`}
      >
        <div className="relative shrink-0 px-5 sm:px-6 py-4 border-b border-slate-200">
          <h2
            id="gift-card-info-modal-title"
            className="text-center text-lg sm:text-xl font-bold text-[#333333] pr-8"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-500 hover:text-[#111] hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div
          data-scroll-lock-container
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 [scrollbar-width:thin] [scrollbar-color:#C4C4C4_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#C4C4C4] hover:[&::-webkit-scrollbar-thumb]:bg-[#A3A3A3]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  const { data: terms = [], isLoading, isError } = useGetPublicGiftCardTermsQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-slate-500 gap-2 items-center text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading terms…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-rose-600 text-center py-8">Could not load terms. Try again later.</p>;
  }
  if (terms.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">No terms are available right now.</p>;
  }

  return (
    <ol className="list-decimal pl-5 space-y-3 text-[13px] sm:text-sm text-[#555555] leading-relaxed">
      {terms.map((item) => (
        <li key={item.id} className="pl-1">
          {item.body}
        </li>
      ))}
    </ol>
  );
}

function FaqsContent() {
  const { data: faqs = [], isLoading, isError } = useGetPublicGiftCardFaqsQuery();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-slate-500 gap-2 items-center text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading FAQs…
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-rose-600 text-center py-8">Could not load FAQs. Try again later.</p>;
  }
  if (faqs.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">No FAQs are available right now.</p>;
  }

  return (
    <div className="space-y-2.5">
      {faqs.map((item, idx) => {
        const open = openIdx === idx;
        return (
          <div key={item.id} className="border border-slate-200 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : idx)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-[13px] sm:text-sm font-medium text-[#333333]">
                {item.question}
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open ? (
              <div className="px-3.5 pb-3.5 text-[13px] text-[#666666] leading-relaxed border-t border-slate-100 pt-2.5">
                {item.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const balanceSchema = yup.object({
  code: yup
    .string()
    .trim()
    .required("Gift card voucher code is required.")
    .min(8, "Enter a valid gift card voucher code."),
});

type BalanceValues = yup.InferType<typeof balanceSchema>;

function BalanceContent() {
  const [checkBalance, { isLoading }] = useCheckGiftCardBalanceMutation();
  const [result, setResult] = useState<{
    code_masked: string;
    current_balance: number;
    initial_balance: number;
    status: string;
    expires_at?: string | null;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BalanceValues>({
    resolver: yupResolver(balanceSchema),
    defaultValues: { code: "" },
    mode: "onSubmit",
  });

  const onValid = async (values: BalanceValues) => {
    setResult(null);
    try {
      const res = await checkBalance({ code: values.code.trim() }).unwrap();
      const data = res?.data;
      if (!data) {
        toast.error("Could not read gift card balance.");
        return;
      }
      setResult(data);
      toast.success("Balance found");
    } catch (err) {
      toast.error(extractApiError(err, "Could not check balance"));
    }
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-[#333] mb-2">
          <span className="text-rose-500">*</span> Gift Card Voucher Code
        </label>
        <input
          {...register("code")}
          className="w-full h-11 px-3 rounded-md border border-slate-300 text-[14px] text-[#111] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA]"
          placeholder="Enter your gift card voucher code"
          autoComplete="off"
          spellCheck={false}
        />
        {errors.code && (
          <p className="mt-1.5 text-xs font-semibold text-rose-500">{errors.code.message}</p>
        )}
      </div>

      {result ? (
        <div className="rounded-lg border border-[#E8D5FF] bg-[#F9F5FF] px-4 py-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6900AA]">
            Voucher {result.code_masked}
          </p>
          <p className="text-2xl font-extrabold text-[#6900AA]">
            {formatMoney(result.current_balance, { compact: true })}
          </p>
          <p className="text-xs text-slate-600">
            Status: <span className="font-semibold capitalize">{String(result.status).toLowerCase()}</span>
            {" · "}Initial {formatMoney(result.initial_balance, { compact: true })}
          </p>
          {result.expires_at ? (
            <p className="text-xs text-slate-500">
              Expires {formatGiftCardExpiryDate(result.expires_at)}
              <span className="text-slate-400"> (end of day)</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 rounded-md bg-[#6900AA] hover:bg-[#5A008F] text-white font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Checking…
          </>
        ) : (
          "Check Balance"
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          reset({ code: "" });
          setResult(null);
        }}
        className="w-full text-xs text-slate-500 hover:text-[#6900AA]"
      >
        Clear
      </button>
    </form>
  );
}

type Props = {
  kind: GiftCardInfoModalKind;
  onClose: () => void;
};

export default function GiftCardInfoModals({ kind, onClose }: Props) {
  const title =
    kind === "terms"
      ? "Terms & Conditions"
      : kind === "help"
        ? "FAQs"
        : kind === "balance"
          ? "Check Gift Card Voucher Balance"
          : "";

  return (
    <GiftCardModalShell
      open={Boolean(kind)}
      title={title}
      onClose={onClose}
      wide={kind === "terms" || kind === "help"}
    >
      {kind === "terms" ? <TermsContent /> : null}
      {kind === "help" ? <FaqsContent /> : null}
      {kind === "balance" ? <BalanceContent /> : null}
    </GiftCardModalShell>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { FileText, HelpCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateGiftCardFaqMutation,
  useCreateGiftCardTermMutation,
  useDeleteGiftCardFaqMutation,
  useDeleteGiftCardTermMutation,
  useGetGiftCardFaqsQuery,
  useGetGiftCardTermsQuery,
  usePatchGiftCardFaqStatusMutation,
  usePatchGiftCardTermStatusMutation,
  useUpdateGiftCardFaqMutation,
  useUpdateGiftCardTermMutation,
  type GiftCardFaq,
  type GiftCardTerm,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase mb-2";
const inputClass = "input-field";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function ActiveToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
        active
          ? "bg-green-500/30 border-green-500/50"
          : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={active ? "Enabled" : "Disabled"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const termSchema = yup.object({
  body: yup
    .string()
    .trim()
    .required("Term text is required.")
    .min(5, "Term must be at least 5 characters."),
});

const faqSchema = yup.object({
  question: yup
    .string()
    .trim()
    .required("Question is required.")
    .min(5, "Question must be at least 5 characters."),
  answer: yup
    .string()
    .trim()
    .required("Answer is required.")
    .min(5, "Answer must be at least 5 characters."),
});

type TermValues = yup.InferType<typeof termSchema>;
type FaqValues = yup.InferType<typeof faqSchema>;

export default function AdminGiftCardContentPanel() {
  const [tab, setTab] = useState<"terms" | "faqs">("terms");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editingTerm, setEditingTerm] = useState<GiftCardTerm | null>(null);
  const [editingFaq, setEditingFaq] = useState<GiftCardFaq | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "terms" | "faqs";
    id: string;
  } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{
    kind: "terms" | "faqs";
    id: string;
    name: string;
    next: boolean;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const termForm = useForm<TermValues>({
    resolver: yupResolver(termSchema),
    defaultValues: { body: "" },
    mode: "onSubmit",
  });
  const faqForm = useForm<FaqValues>({
    resolver: yupResolver(faqSchema),
    defaultValues: { question: "", answer: "" },
    mode: "onSubmit",
  });

  const listArg = {
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  };

  const { data: termsData, isLoading: termsLoading } = useGetGiftCardTermsQuery(listArg, {
    skip: tab !== "terms",
  });
  const { data: faqsData, isLoading: faqsLoading } = useGetGiftCardFaqsQuery(listArg, {
    skip: tab !== "faqs",
  });

  const [createTerm, { isLoading: creatingTerm }] = useCreateGiftCardTermMutation();
  const [updateTerm, { isLoading: updatingTerm }] = useUpdateGiftCardTermMutation();
  const [patchTermStatus] = usePatchGiftCardTermStatusMutation();
  const [deleteTerm] = useDeleteGiftCardTermMutation();

  const [createFaq, { isLoading: creatingFaq }] = useCreateGiftCardFaqMutation();
  const [updateFaq, { isLoading: updatingFaq }] = useUpdateGiftCardFaqMutation();
  const [patchFaqStatus] = usePatchGiftCardFaqStatusMutation();
  const [deleteFaq] = useDeleteGiftCardFaqMutation();

  const terms = termsData?.items ?? [];
  const faqs = faqsData?.items ?? [];
  const meta = tab === "terms" ? termsData?.meta : faqsData?.meta;
  const listLoading = tab === "terms" ? termsLoading : faqsLoading;

  const resetTermForm = () => {
    setEditingTerm(null);
    termForm.reset({ body: "" });
  };
  const resetFaqForm = () => {
    setEditingFaq(null);
    faqForm.reset({ question: "", answer: "" });
  };

  const onSaveTerm = async (values: TermValues) => {
    try {
      if (editingTerm) {
        const res = await updateTerm({
          id: editingTerm.id,
          body: values.body.trim(),
          is_active: editingTerm.is_active !== false,
        }).unwrap();
        toast.success(res.message || "Term updated");
      } else {
        const res = await createTerm({
          body: values.body.trim(),
          is_active: true,
        }).unwrap();
        toast.success(res.message || "Term created");
      }
      resetTermForm();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save term"));
    }
  };

  const onSaveFaq = async (values: FaqValues) => {
    try {
      if (editingFaq) {
        const res = await updateFaq({
          id: editingFaq.id,
          question: values.question.trim(),
          answer: values.answer.trim(),
          is_active: editingFaq.is_active !== false,
        }).unwrap();
        toast.success(res.message || "FAQ updated");
      } else {
        const res = await createFaq({
          question: values.question.trim(),
          answer: values.answer.trim(),
          is_active: true,
        }).unwrap();
        toast.success(res.message || "FAQ created");
      }
      resetFaqForm();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save FAQ"));
    }
  };

  const confirmStatus = async () => {
    if (!pendingStatus) return;
    setConfirmBusy(true);
    try {
      if (pendingStatus.kind === "terms") {
        const res = await patchTermStatus({
          id: pendingStatus.id,
          is_active: pendingStatus.next,
        }).unwrap();
        toast.success(res.message || "Status updated");
      } else {
        const res = await patchFaqStatus({
          id: pendingStatus.id,
          is_active: pendingStatus.next,
        }).unwrap();
        toast.success(res.message || "Status updated");
      }
      setPendingStatus(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update status"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "terms") {
        const res = await deleteTerm(pendingDelete.id).unwrap();
        toast.success(res.message || "Term deleted");
        if (editingTerm?.id === pendingDelete.id) resetTermForm();
      } else {
        const res = await deleteFaq(pendingDelete.id).unwrap();
        toast.success(res.message || "FAQ deleted");
        if (editingFaq?.id === pendingDelete.id) resetFaqForm();
      }
      setPendingDelete(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete"));
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Terms & FAQs</h2>
          <p className="mt-1 text-xs text-slate-500 max-w-xl">
            Content shown in the customer gift card buy page modals. Only enabled items appear to
            customers.
          </p>
        </div>
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder={tab === "terms" ? "Search terms" : "Search FAQs"}
          className="sm:w-56"
        />
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {(
          [
            { key: "terms" as const, label: "Terms & Conditions", icon: FileText },
            { key: "faqs" as const, label: "FAQs (Need Help)", icon: HelpCircle },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
              setQ("");
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "terms" ? (
        <form
          onSubmit={termForm.handleSubmit(onSaveTerm)}
          noValidate
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <div>
            <label className={labelClass}>
              Term text <RequiredMark />
            </label>
            <textarea
              {...termForm.register("body")}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="Enter a terms & conditions point…"
            />
            {termForm.formState.errors.body && (
              <p className={fieldErrorClass}>{termForm.formState.errors.body.message}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {editingTerm && (
              <button
                type="button"
                onClick={resetTermForm}
                className="h-11 px-4 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={creatingTerm || updatingTerm}
              className="h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {(creatingTerm || updatingTerm) && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {editingTerm ? <Pencil size={16} /> : <Plus size={16} />}
              {editingTerm ? "Update term" : "Add term"}
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={faqForm.handleSubmit(onSaveFaq)}
          noValidate
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <div>
            <label className={labelClass}>
              Question <RequiredMark />
            </label>
            <input
              {...faqForm.register("question")}
              className={inputClass}
              placeholder="e.g. How do I redeem the Gift Card?"
            />
            {faqForm.formState.errors.question && (
              <p className={fieldErrorClass}>{faqForm.formState.errors.question.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>
              Answer <RequiredMark />
            </label>
            <textarea
              {...faqForm.register("answer")}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="Write the answer customers will see…"
            />
            {faqForm.formState.errors.answer && (
              <p className={fieldErrorClass}>{faqForm.formState.errors.answer.message}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            {editingFaq && (
              <button
                type="button"
                onClick={resetFaqForm}
                className="h-11 px-4 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={creatingFaq || updatingFaq}
              className="h-11 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {(creatingFaq || updatingFaq) && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {editingFaq ? <Pencil size={16} /> : <Plus size={16} />}
              {editingFaq ? "Update FAQ" : "Add FAQ"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-white/10 bg-white/[0.03]">
              {tab === "terms" ? (
                <>
                  <th className="px-3 py-2.5 font-semibold">Term</th>
                  <th className="px-3 py-2.5 font-semibold w-24">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right w-28">Actions</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2.5 font-semibold">Question</th>
                  <th className="px-3 py-2.5 font-semibold w-24">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right w-28">Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {listLoading ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading…
                  </span>
                </td>
              </tr>
            ) : tab === "terms" ? (
              terms.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">
                    No terms yet.
                  </td>
                </tr>
              ) : (
                terms.map((row) => {
                  const active = row.is_active !== false;
                  return (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2.5 text-slate-800 max-w-xl">{row.body}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs font-bold uppercase ${
                            active ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          {active ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end items-center gap-1">
                          <ActiveToggle
                            active={active}
                            onToggle={() =>
                              setPendingStatus({
                                kind: "terms",
                                id: row.id,
                                name: row.body.slice(0, 60),
                                next: !active,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTerm(row);
                              termForm.reset({ body: row.body });
                            }}
                            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ kind: "terms", id: row.id })}
                            className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )
            ) : faqs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">
                  No FAQs yet.
                </td>
              </tr>
            ) : (
              faqs.map((row) => {
                const active = row.is_active !== false;
                return (
                  <tr key={row.id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="text-slate-900 font-medium">{row.question}</p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{row.answer}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-xs font-bold uppercase ${
                          active ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {active ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end items-center gap-1">
                        <ActiveToggle
                          active={active}
                          onToggle={() =>
                            setPendingStatus({
                              kind: "faqs",
                              id: row.id,
                              name: row.question,
                              next: !active,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFaq(row);
                            faqForm.reset({
                              question: row.question,
                              answer: row.answer,
                            });
                          }}
                          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ kind: "faqs", id: row.id })}
                          className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus?.next ? "Enable item?" : "Disable item?"}
        body={
          pendingStatus
            ? pendingStatus.next
              ? `Enable "${pendingStatus.name}"? Customers will see it.`
              : `Disable "${pendingStatus.name}"? It will be hidden from customers.`
            : ""
        }
        confirmLabel={pendingStatus?.next ? "Enable" : "Disable"}
        danger={!pendingStatus?.next}
        variant={pendingStatus?.next ? "success" : "warning"}
        busy={confirmBusy}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void confirmStatus()}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete item?"
        body="This permanently removes the item from Terms / FAQs."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

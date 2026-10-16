"use client";

import { Icon } from "@iconify/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useState } from "react";
import type { Job } from "./types";
import { useClientAccount } from "@/app/provider";
import { clientApiFetch, isNetworkError } from "@/app/utils/api";
import { proposalMetadataQueryKey } from "@/app/hooks/use-proposal-metadata";

const CONNECTS_PER_PROPOSAL = 8; // must match PROPOSAL_CONNECTS on the backend
const MIN_COVER_LETTER = 80;

const DELIVERY_OPTIONS = [
  "Less than 1 month",
  "1–2 months",
  "3–6 months",
  "More than 6 months",
];

type ProposalModalProps = {
  job: Job;
  onClose: () => void;
};

type ProposalPayload = {
  jobId: string;
  bidAmount: number;
  duration: string;
  coverLetter: string;
  screeningAnswers: string[];
};

type ApiResult = { success: boolean; message?: string };

const normalizeQuestions = (raw: unknown): string[] => {
  let list: unknown = raw;

  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];

    try {
      list = JSON.parse(text);
    } catch {
      return [text];
    }
  }

  if (!Array.isArray(list)) return [];

  return list
    .map((item: unknown) =>
      typeof item === "string"
        ? item.trim()
        : String((item as { question?: string } | null)?.question ?? "").trim(),
    )
    .filter(Boolean);
};

export function ProposalModal({ job, onClose }: ProposalModalProps) {
  const account = useClientAccount();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const screeningQuestions = normalizeQuestions(job.screeningQuestions);

  const { data: connectMetadata } = useQuery({
    queryKey: ["connects", "freelancer"],
    enabled: Boolean(account),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await clientApiFetch("connects?role=freelancer");
      if (!response.ok) {
        throw new Error(`Failed to load connects (${response.status})`);
      }
      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: { connects: number };
      };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Could not load connects.");
      }
      return result.data;
    },
  });

  const availableConnects = connectMetadata?.connects;
  const notEnoughConnects =
    availableConnects !== undefined && availableConnects < CONNECTS_PER_PROPOSAL;

  const submitMutation = useMutation({
    mutationFn: async (payload: ProposalPayload) => {
      const response = await clientApiFetch("proposals?role=freelancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as ApiResult | null;

      if (response.status === 401) {
        throw new Error("Your session expired. Please refresh the page and sign in again.");
      }
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message || `Could not submit proposal (${response.status}).`,
        );
      }
      return result;
    },
    onSuccess: async () => {
      setSubmitted(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: proposalMetadataQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["connects"] }),
        queryClient.invalidateQueries({ queryKey: ["freelancer-jobs"] }),
      ]);
    },
  });

  const pending = submitMutation.isPending;

  const errorMessage = submitMutation.error
    ? isNetworkError(submitMutation.error)
      ? "Check your connection and try again."
      : submitMutation.error.message
    : "";

  const submitProposal = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || notEnoughConnects) return;

    const form = new FormData(event.currentTarget);

    submitMutation.mutate({
      jobId: String(job.id),
      bidAmount: Number(form.get("bidAmount")),
      duration: String(form.get("duration") ?? ""),
      coverLetter: String(form.get("coverLetter") ?? "").trim(),
      screeningAnswers: screeningQuestions.map((_, index) =>
        String(form.get(`screening-${index}`) ?? "").trim(),
      ),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#182019]/55 p-4 backdrop-blur-[2px]"
    >
      <div className="max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {submitted ? (
          <div className="px-7 py-12 text-center sm:px-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f3e5] text-[#4f7b4c]">
              <Icon icon="solar:check-circle-bold" width="34" />
            </span>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.035em]">
              Proposal submitted
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#686e66]">
              Your proposal for “{job.title}” is ready for {job.company} to review.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 cursor-pointer rounded-xl bg-[#252724] px-6 py-3 text-sm font-semibold text-white"
            >
              Back to jobs
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-black/8 px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-[#5c8159] uppercase">
                  Submit proposal
                </p>
                <h2
                  id="proposal-title"
                  className="mt-2 max-w-md text-xl font-semibold tracking-tight"
                >
                  {job.title}
                </h2>
                <p className="mt-1 text-sm text-[#777c74]">{job.company}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                aria-label="Close proposal"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50"
              >
                <Icon icon="solar:close-circle-linear" width="23" />
              </button>
            </div>

            <form onSubmit={submitProposal} className="grid gap-5 px-6 py-6 sm:px-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  Your bid
                  <span className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-[#777c74]">
                      $
                    </span>
                    <input
                      required
                      name="bidAmount"
                      type="number"
                      min="1"
                      max="1000000"
                      step="any"
                      defaultValue={
                        job.type === "Hourly"
                          ? "85"
                          : job.budget.replace(/[$,]/g, "")
                      }
                      className="h-12 w-full rounded-xl border border-black/11 bg-white pr-14 pl-8 font-normal outline-none focus:border-[#70966d]"
                    />
                    <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-[#858a82]">
                      {job.type === "Hourly" ? "/ hour" : "USD"}
                    </span>
                  </span>
                </label>

                <label className="grid gap-2 text-sm font-semibold">
                  Delivery
                  <select
                    required
                    name="duration"
                    defaultValue={DELIVERY_OPTIONS[0]}
                    className="h-12 rounded-xl border border-black/11 bg-white px-3.5 font-normal outline-none focus:border-[#70966d]"
                  >
                    {DELIVERY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold">
                <span>
                  Cover letter
                  <span className="pl-1 text-red-500" aria-hidden="true">
                    *
                  </span>
                </span>
                <textarea
                  required
                  name="coverLetter"
                  minLength={MIN_COVER_LETTER}
                  rows={6}
                  placeholder="Introduce yourself, explain your relevant experience, and describe how you would approach this project..."
                  className="resize-none rounded-xl border border-black/11 bg-white p-3.5 font-normal leading-6 outline-none placeholder:text-[#a1a59e] focus:border-[#70966d]"
                />
                <span className="text-right text-[11px] font-normal text-[#8a8e87]">
                  Minimum {MIN_COVER_LETTER} characters
                </span>
              </label>

              {screeningQuestions.length > 0 && (
                <div className="grid gap-4 border-t border-black/7 pt-5">
                  <h3 className="font-semibold">Additional questions</h3>

                  {screeningQuestions.map((question, index) => (
                    <label key={index} className="grid gap-2 text-sm font-semibold">
                      <span>
                        {question}
                        <span className="pl-1 text-red-500" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <textarea
                        required
                        name={`screening-${index}`}
                        rows={3}
                        className="resize-none rounded-xl border border-black/11 bg-white p-3.5 font-normal leading-6 outline-none focus:border-[#70966d]"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-[#eff4ed] p-4 text-xs leading-5 text-[#626960]">
                <strong className="text-[#333832]">
                  You’ll use {CONNECTS_PER_PROPOSAL} Connects.
                </strong>{" "}
                {availableConnects === undefined
                  ? "Checking your Connects…"
                  : `You have ${availableConnects} Connects available.`}
                {notEnoughConnects && (
                  <span className="mt-1 block font-semibold text-[#9a3b2f]">
                    You don’t have enough Connects to send this proposal.
                  </span>
                )}
              </div>

              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-xl bg-[#fbeceb] px-4 py-3 text-xs font-medium text-[#9a3b2f]"
                >
                  {errorMessage}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-black/7 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="cursor-pointer rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || notEnoughConnects}
                  className="cursor-pointer rounded-xl bg-[#252724] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Send proposal"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
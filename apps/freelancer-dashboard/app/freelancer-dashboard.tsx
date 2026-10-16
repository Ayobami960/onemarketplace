"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "timeago.js";
import { DashboardHeader } from "./_components/dashboard/dashboard-header";
import { WorkspaceSidebar } from "./_components/dashboard/workspace-sidebar";
import { JobCard } from "./_components/jobs/job-card";
import {
  emptyJobFilters,
  JobFilterPopover,
  type JobFilters,
} from "./_components/jobs/job-filter-popover";
import { ProposalModal } from "./_components/jobs/proposal-modal";
import type { Job } from "./_components/jobs/types";
import { useClientAccount } from "./provider";
import { clientApiFetch } from "./utils/api";
import { useSidebarProfile } from "./hooks/use-sidebar-profile";
import { useProposalMetadata } from "./hooks/use-proposal-metadata";
import { useSavedJobs } from "./hooks/use-saved-jobs";

export const proposalRange = (range: string) => {
  if (range === "Less than 5") return { maxProposals: "4" };
  if (range === "5 to 10") return { minProposals: "5", maxProposals: "10" };
  if (range === "10 to 15") return { minProposals: "10", maxProposals: "15" };
  return {};
};

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good night";
}

// Maps an API row into the UI's Job shape (used for both normal and saved jobs).
const mapJob = (job: any): Job => ({
  id: String(job.id),
  title: job.title,
  company: job.companyName,
  verified: job.paymentVerified,
  posted: format(job.published_at ?? job.created_at ?? new Date()),
  type: "Fixed price" as const,
  budget: `$${Number(job.total_budget).toLocaleString()}`,
  level: job.expertise_level,
  duration: job.expected_duration,
  description: job.description,
  skills: job.skills ?? [],
  proposals: String(job.proposalCounts ?? 0),
  featured: (job.matchScore ?? 0) >= 4,
  screeningQuestions: job.screeningQuestions ?? job.screening_questions ?? [],
});

const JobCardsSkeleton = () => (
  <div className="grid gap-4" role="status" aria-label="Loading job posts">
    {[0, 1, 2].map((item) => (
      <div
        key={item}
        className="animate-pulse rounded-2xl border border-black/8 bg-white p-7"
      >
        <div className="h-3 w-12 rounded-full bg-[#e5e8e2]" />
        <div className="mt-4 h-5 w-3/4 rounded-full bg-[#dfe4dc]" />
        <div className="mt-3 h-4 w-2/5 rounded-full bg-[#e9ece6]" />
        <div className="mt-4 h-3 w-full rounded-full bg-[#e5e8e2]" />
        <div className="mt-2 h-3 w-4/5 rounded-full bg-[#e9ece6]" />

        <div className="mt-6 flex gap-2">
          {[20, 24, 16].map((width) => (
            <div
              key={width}
              className="h-7 rounded-lg bg-[#e5e8e2]"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export function FreelancerDashboard() {
  const account = useClientAccount();
  const router = useRouter();
  const sidebar = useSidebarProfile();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Best matches");
  const [proposalJob, setProposalJob] = useState<Job | null>(null);
  const [filters, setFilters] = useState<JobFilters>(emptyJobFilters);

  const {
    savedRows,
    savedIds,
    isLoading: savedLoading,
    isError: savedError,
    toggleSaved: toggleSavedRow,
  } = useSavedJobs();

  const isSavedTab = activeTab === "Saved jobs";

  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const activeFilterCount =
    filters.experienceLevels.length +
    filters.durations.length +
    Number(Boolean(filters.minBudget || filters.maxBudget)) +
    Number(filters.proposalRange !== "Any number") +
    Number(filters.verifiedOnly);

  const { data: connectMetadata, isLoading: connectsLoading } = useQuery({
    queryKey: ["connects", "freelancer"],
    enabled: Boolean(account),
    retry: 1,
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

  const query = useMemo(() => {
    const params = new URLSearchParams({
      role: "freelancer",
      filter: activeTab === "Most recent" ? "recent" : "best-match",
    });

    if (filters.experienceLevels.length)
      params.set("levels", filters.experienceLevels.join(","));
    if (filters.durations.length)
      params.set("durations", filters.durations.join(","));
    if (filters.minBudget) params.set("minBudget", filters.minBudget);
    if (filters.maxBudget) params.set("maxBudget", filters.maxBudget);
    if (filters.verifiedOnly) params.set("paymentVerified", "true");

    Object.entries(proposalRange(filters.proposalRange)).forEach(
      ([key, value]) => params.set(key, value),
    );

    return params.toString();
  }, [activeTab, filters]);

  const {
    data: jobs = [],
    isLoading: jobsLoading,
    isError: jobsError,
  } = useQuery({
    queryKey: ["freelancer-jobs", query],
    // The Saved tab has its own data source, so skip this request there.
    enabled: Boolean(account) && !isSavedTab,
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await clientApiFetch(`freelancer/jobs?${query}`);

      if (!response.ok) {
        throw new Error(`Failed to load jobs (${response.status})`);
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: unknown[];
      };

      if (!result.success || !result.data) {
        throw new Error(result.message || "Could not load jobs.");
      }

      return result.data;
    },
  });

  const { data: proposalMetadata, isLoading: proposalMetaLoading } =
    useProposalMetadata();

  const appliedJobIds = useMemo(
    () =>
      new Set(
        proposalMetadata?.proposals?.map((proposal) => proposal.jobId) ?? [],
      ),
    [proposalMetadata],
  );

  // Saved tab reads from the saved-jobs endpoint; other tabs use the job feed.
  const mappedJobs = useMemo<Job[]>(
    () => (isSavedTab ? savedRows : (jobs as any[])).map(mapJob),
    [isSavedTab, savedRows, jobs],
  );

  // The server already applies level, duration, budget, proposals and
  // payment filters, so only the search text is handled here.
  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return mappedJobs;

    return mappedJobs.filter((job) =>
      [job.title, job.company, job.description, ...job.skills]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [mappedJobs, search]);

  const toggleSaved = (id: string) => {
    const row =
      savedRows.find((item) => String(item.id) === id) ??
      (jobs as any[]).find((item) => String(item.id) === id);

    if (row) toggleSavedRow(row);
  };

  const listLoading = isSavedTab ? savedLoading : jobsLoading;
  const listError = isSavedTab ? savedError : jobsError;

  return (
    <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
      <DashboardHeader />

      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 lg:py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#62805f]">{today}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {greeting}, {sidebar.fullName}.
            </h1>
            <p className="mt-2 text-sm text-[#72776f]">
              Here are fresh opportunities matched to your profile.
            </p>
          </div>
          <label className="flex h-12 w-full items-center gap-3 rounded-xl border border-black/9 bg-white px-4 focus-within:border-[#72956f] lg:max-w-md">
            <Icon
              icon="solar:magnifer-linear"
              width="20"
              className="text-[#7c8179]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search jobs by title or skill"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a0a49e]"
            />
            <kbd className="hidden rounded-md border border-black/8 bg-[#f4f5f2] px-2 py-1 text-[10px] text-[#8b8f88] sm:block">
              ⌘ K
            </kbd>
          </label>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          <WorkspaceSidebar {...sidebar} />

          <section className="min-w-0">
            <div className="rounded-2xl border border-black/8 bg-white px-3 pt-3">
              <div className="flex gap-1 overflow-x-auto border-b border-black/7 px-2">
                {["Best matches", "Most recent", "Saved jobs"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`relative shrink-0 cursor-pointer px-4 py-3 text-sm font-semibold ${
                      activeTab === tab ? "text-[#4d764a]" : "text-[#777c74]"
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#5e875b]" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between px-3 py-4">
                <div>
                  <h2 className="font-semibold">{activeTab}</h2>
                  <p className="mt-0.5 text-xs text-[#858a82]">
                    {isSavedTab
                      ? `${visibleJobs.length} saved ${
                          visibleJobs.length === 1 ? "job" : "jobs"
                        }`
                      : `${visibleJobs.length} opportunities based on your skills`}
                  </p>
                </div>
                <JobFilterPopover
                  filters={filters}
                  activeCount={activeFilterCount}
                  onApply={setFilters}
                  onClear={() => setFilters(emptyJobFilters)}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {listLoading && <JobCardsSkeleton />}

              {listError && !listLoading && (
                <div className="rounded-2xl border border-dashed border-black/12 bg-white px-6 py-16 text-center">
                  <h2 className="text-lg font-semibold">
                    {isSavedTab ? "Could not load saved jobs" : "Could not load jobs"}
                  </h2>
                  <p className="mt-2 text-sm text-[#777c74]">
                    Please refresh the page and try again.
                  </p>
                </div>
              )}

              {!listLoading &&
                !listError &&
                visibleJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    saved={savedIds.has(job.id)}
                    onSave={() => toggleSaved(job.id)}
                    onPropose={() => setProposalJob(job)}
                    hasApplied={appliedJobIds.has(job.id)}
                    proposalMetadataLoading={proposalMetaLoading}
                  />
                ))}

              {!listLoading && !listError && !visibleJobs.length && (
                <div className="rounded-2xl border border-dashed border-black/12 bg-white px-6 py-16 text-center">
                  <Icon
                    icon="solar:case-minimalistic-linear"
                    width="34"
                    className="mx-auto text-[#7c8179]"
                  />
                  <h2 className="mt-4 text-lg font-semibold">No jobs here yet</h2>
                  <p className="mt-2 text-sm text-[#777c74]">
                    {isSavedTab
                      ? search.trim()
                        ? "No saved jobs match your search."
                        : "Save a job and it will appear here."
                      : activeFilterCount
                        ? "Try adjusting or clearing your job filters."
                        : "Try a broader search term."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="grid gap-5 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-black/8 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Proposal activity</h2>
                <Link
                  href="/my-proposals"
                  className="text-xs font-semibold text-[#52784f]"
                >
                  View all
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  [String(proposalMetadata?.counts?.active ?? "..."), "Active"],
                  [String(proposalMetadata?.counts?.viewed ?? "..."), "Viewed"],
                  [
                    String(proposalMetadata?.counts?.interviewed ?? "..."),
                    "Interviews",
                  ],
                ].map(([value, label], index) => (
                  <div
                    key={label}
                    className={`rounded-xl px-2 py-3 ${
                      index === 2 ? "bg-[#eaf3e7]" : "bg-[#f2f4f0]"
                    }`}
                  >
                    <strong
                      className={
                        index === 2 ? "text-lg text-[#4f784c]" : "text-lg"
                      }
                    >
                      {value}
                    </strong>
                    <p className="mt-1 text-[10px] text-[#81867e]">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-black/7 pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#777c74]">Available Connects</span>
                  <strong>
                    {connectsLoading ? "…" : (connectMetadata?.connects ?? "—")}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/settings?section=connects")}
                  className="mt-3 w-full cursor-pointer rounded-xl border border-black/10 py-2.5 text-xs font-semibold hover:bg-black/3"
                >
                  Buy Connects
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-[#252a26] p-5 text-white">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#b9c1b8]">
                  Earnings this month
                </p>
                <Icon
                  icon="solar:chart-2-linear"
                  width="20"
                  className="text-[#9fbb9c]"
                />
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                $4,850
              </p>
              <p className="mt-1 text-xs text-[#aeb6ad]">
                +$1,240 from last month
              </p>
              <div className="mt-5 flex h-14 items-end gap-2" aria-hidden="true">
                {[35, 52, 44, 70, 59, 86, 100].map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t bg-[#71866f]"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#d5dfd2] bg-[#edf4ea] p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#52784f]">
                <Icon icon="solar:lightbulb-bolt-linear" width="21" />
              </span>
              <h2 className="mt-4 font-semibold">Stand out to clients</h2>
              <p className="mt-2 text-xs leading-5 text-[#667064]">
                {sidebar.loading
                  ? "Checking your profile…"
                  : (sidebar.strengthSuggestions[0] ??
                    "Your profile is complete. Great work!")}
              </p>
              <Link
                href="/my-profile"
                className="mt-4 inline-block text-xs font-semibold text-[#4c7549] hover:underline"
              >
                Update profile
              </Link>
            </section>
          </aside>
        </div>
      </main>

      {proposalJob && (
        <ProposalModal job={proposalJob} onClose={() => setProposalJob(null)} />
      )}
    </div>
  );
}
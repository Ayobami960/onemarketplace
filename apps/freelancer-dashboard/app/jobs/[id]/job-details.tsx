"use client";
 
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "timeago.js";
import { DashboardHeader } from "@/app/_components/dashboard/dashboard-header";
import { useClientAccount } from "@/app/provider";
import { clientApiFetch } from "@/app/utils/api";
import { countries } from "@/app/utils/countries";
import { useProposalMetadata } from "@/app/hooks/use-proposal-metadata";
import { useMemo } from "react";

type JobDetailsData = {
  id: string;
  title: string;
  description: string;
  expertise_level: string;
  expected_duration: string;
  skills: string[];
  total_budget: string;
  milestones: Array<{
    id: string;
    title: string;
    budget: number;
    dueDate: string;
  }>;
  screening_questions: string[] | null;
  attachments: Array<{
    fileId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }> | null;
  published_at: string | null;
  created_at: string | null;
  companyName: string;
  companyDescription: string;
  clientCountry: string | null;
  paymentVerified: boolean;
  clientJoinedAt: string | null;
  proposalCount: number;
};


const money = (value: number | string) =>
  `$${Number(value).toLocaleString()}`;

const formatDate = (value: string | null, options: Intl.DateTimeFormatOptions) =>
  value ? new Date(value).toLocaleDateString("en-US", options) : "—";


const proposalLabel = (count: number) => {
  if (count < 5) return "Less than 5 proposals";
  if (count < 10) return "5 to 10 proposals";
  if (count < 15) return "10 to 15 proposals";
  if (count < 20) return "15 to 20 proposals";
  return "20+ proposals";
}

const JobDetailsSkeleton = () => (
  <div
    className="mx-auto grid max-w-7xl items-start gap-7 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:py-12"
    role="status"
    aria-label="Loading job details"
  >
    <div className="animate-pulse rounded-3xl border border-black/8 bg-white p-9">
      <div className="h-3 w-40 rounded-full bg-[#e5e8e2]" />
      <div className="mt-5 h-8 w-3/4 rounded-full bg-[#dfe4dc]" />
      <div className="mt-6 flex gap-2">
        <div className="h-8 w-32 rounded-lg bg-[#e9ece6]" />
        <div className="h-8 w-24 rounded-lg bg-[#e9ece6]" />
      </div>
      <div className="mt-10 h-4 w-full rounded-full bg-[#e5e8e2]" />
      <div className="mt-3 h-4 w-full rounded-full bg-[#e9ece6]" />
      <div className="mt-3 h-4 w-2/3 rounded-full bg-[#e5e8e2]" />
    </div>
    <div className="animate-pulse rounded-3xl border border-black/8 bg-white p-6">
      <div className="h-3 w-24 rounded-full bg-[#e5e8e2]" />
      <div className="mt-3 h-8 w-32 rounded-full bg-[#dfe4dc]" />
      <div className="mt-6 h-11 rounded-xl bg-[#e9ece6]" />
    </div>
  </div>
);



const JobDetails = () => {
  const { id } = useParams<{ id: string }>();
  const account = useClientAccount();

  const {
    data: job,
    isLoading,
    isError,
  } = useQuery<JobDetailsData>({
    queryKey: ["freelancer-job", id],
    enabled: Boolean(account) && Boolean(id),
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      // Change this path to wherever your job-details route is mounted.
      const response = await clientApiFetch(`freelancer/jobs/${id}?role=freelancer`);

      if (!response.ok) {
        throw new Error(`Failed to load job (${response.status})`);
      }

      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: JobDetailsData;
      };

      if (!result.success || !result.data) {
        throw new Error(result.message || "Could not load job.");
      }

      return result.data;
    },
  });



  const { data: proposalMetadata, isLoading: proposalMetadataLoading } =
      useProposalMetadata();
  
    const hasApplied =
      proposalMetadata?.proposals?.some((proposal) => proposal.jobId === id) ??
      false;
  
    const appliedJobIds = useMemo(
      () =>
        new Set(
          proposalMetadata?.proposals?.map((proposal) => proposal.jobId) ?? [],
        ),
      [proposalMetadata],
    );



  return (
    <div className="min-h-svh bg-[#f4f6f2] font-(family-name:--font-dm-sans) text-[#242724]">
      <DashboardHeader />




      {isLoading ? (
        <JobDetailsSkeleton />
      ) : isError || !job ? (
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-2xl font-semibold">Job post unavailable</h1>
          <p className="mt-2 text-sm text-[#777c74]">
            This job may have been removed or is no longer accepting proposal
          </p>
          <Link
            href="/"
            className='m-6 inline-flex rounded-xl bg-[#252724] text-white px-5 py-3 text-sm font-semibold'
          >
            Back to jobs
          </Link>
        </main>
      ) : (

        <main className="mx-auto grid max-w-7xl items-start gap-7 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:py-12">
          <article className="overflow-hidden rounded-3xl border border-black/8 bg-white">
            <div className="border-b border-black/7 p-6 sm:p-9">
              <p className="text-xs text-[#7a8078]">Posted {format(job.published_at ?? job.created_at ?? new Date())} · Worldwide</p>
              <h1 className="mt-4 max-w-3xl text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl">{job.title}</h1>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-lg bg-[#edf4ea] px-3 py-2 text-xs font-semibold text-[#4e774b]">Fixed-price project</span>
                <span className="rounded-lg bg-[#f2f3f0] px-3 py-2 text-xs font-medium">{job.expertise_level}</span>
                <span className="rounded-lg bg-[#f2f3f0] px-3 py-2 text-xs font-medium">{job.expected_duration}</span>
              </div>
            </div>



            <div className="p-6 sm:p-9">
           
                <section>
                  <h2 className="text-xl font-semibold tracking-tight">About the project</h2>
                  <p className='mt-4 whitespace-pre-line text-sm leading-7 '>
                    {job.description}
                  </p>
                </section>
                <section className="mt-9 border-t border-black/7 pt-8">
                 <h2 className="text-xl font-semibold tracking-tight">
                     skills and expertise
                  </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className='rounded-lg bg-[##eef2ec] px-3 py-2 text-xs font-medium bg-[#edf2eb]  text-[#596057]'
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                </section>
              

              <section className="mt-9 border-t border-black/7 pt-8">
                <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">
                        Proposed milestones
                      </h2>
                      <p className="mt-1 text-sm text-[#7a8078]">
                        Payments release as each milestone is approved.
                      </p>
                    </div>
                    <strong className="text-xl">${Number(job.total_budget).toLocaleString()}</strong>
                  </div>


                <div className="mt-5 overflow-hidden rounded-2xl border border-black/8">
                    {job.milestones.map((milestone, index) => (
                      <div
                        key={milestone.id}
                        className={`flex gap-4 p-5 ${index ? "border-t border-black/7" : ""}`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f2e6] text-xs font-semibold text-[#4d764a]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-4">
                            <h3 className="font-semibold">{milestone.title}</h3>
                             <p className="mt-1.5 text-sm leading-6 text-[#71766f]">
                            Due {new Date(milestone.dueDate).toLocaleDateString()}
                          </p>
                          </div>
                        
                           <strong className="shrink-0 text-sm">
                             ${Number(milestone.budget).toLocaleString()}
                            </strong>
                        </div>
                      </div>
                    ))}
                  </div>
              </section>

             {!! job.screening_questions?.length && (
               <section className="mt-9 border-t border-black/7 pt-8">
                <h2 className="text-xl font-semibold tracking-tight">Screening questions</h2>
                <ul className="mt-4 grid gap-3 text-sm text-[#626860] sm:grid-cols-2">
                  {job.screening_questions.map((question) => (
                    <li key={question} className="flex gap-3 rounded-xl bg-[#f6f7f4] p-4">
                      <Icon icon="solar:question-circle-linear" width="19" className="mt-0.5 shrink-0 text-[#5b8458]" />
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              </section>
             )}

             {!! job.attachments?.length && (
               <section className="mt-9 border-t border-black/7 pt-8">
                <h2 className='text-xl font-semibold tracking-tight'>
                  Project attachments
                </h2>

                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  {job.attachments.map((attachment) => (
                    <a 
                    key={attachment.fileId}
                    href={attachment.fileUrl}
                    target='_blank'
                    rel="noreferrer"
                    className='flex items-center gap-3 rounded-xl border border-black/8 p-4 text-sm font-medium hover:bg-[#f6f7f4]'
                    >
                      <Icon 
                        icon="solar:paperclip-linear" 
                        width="19" 
                        className="text-[#568153]" />

                      <span className='truncate'>{attachment.fileName}</span>
                    </a>
                  ))}
                </div>
              </section>
             )}
            </div>
          </article>

          <aside className="grid gap-5 lg:sticky lg:top-6">
            <section className="rounded-3xl border border-black/8 bg-white p-6 shadow-lg shadow-black/3">
              <p className="text-xs font-medium text-[#7c8179]">Total fixed budget</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                 ${Number(job.total_budget).toLocaleString()}
              </p>
              <p className="mt-2 text-xs leading-5 text-[#777d75]">Protected through milestone-based payments.</p>
             {proposalMetadataLoading || hasApplied ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#dfe3dc] px-5 py-3 text-sm font-semibold text-[#747a72]"
                >
                  {hasApplied ? "Proposal submitted" : "Checking proposal..."}
                </button>
              ) : (
                <>
                  <Link
                    href={`/?proposal=${id}`}
                    className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#252724] px-5 py-3 text-sm font-semibold text-white! hover:bg-[#3b3e39]"
                  >
                    Submit a proposal
                  </Link>

                  <button
                    type="button"
                    disabled={appliedJobIds.has(job.id)}
                    className="mt-3 disabled:opacity-50 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-sm font-semibold hover:bg-black/3"
                  >
                    <Icon icon="solar:bookmark-linear" width="18" /> Save job
                  </button>
                </>
              )}
              <p className="mt-5 text-center text-xs text-[#81867e]">
                {proposalLabel(job.proposalCount)} proposals
                </p>
            </section>

            <section className="rounded-3xl border border-black/8 bg-white p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{job.companyName}</h2>
                {job?.paymentVerified && (
                <Icon icon="solar:verified-check-bold" width="17" className="text-[#568153]" />
                )}
              </div>
              <p className={`mt-1 text-xs font-medium ${job.paymentVerified ? "text-[#548050]" : "text-[#a6534d]"}`}>
                Payment {job.paymentVerified ? "verified" : "not verified"}  
              </p>
              <p className='mt-5 text-sm leading-6 text-[#6f756d]'>
                {job.companyDescription}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-y-5 text-sm">
                {job?.clientCountry && (
                 <div>
                  <p className='font-semibold'>
                  {countries.find((country) => country.code === job.clientCountry)?.name}
                </p>
                <p className="mt-1 text-xs text-[#838880]">
                  Client location
                </p>
                 </div>
                )}
                <div><p className="font-semibold">120k$</p><p className="mt-1 text-xs text-[#838880]">Total spent</p></div>
                <div><p className="font-semibold text-[#d0a136]">★ <span className="text-[#2f332e]">4.3</span></p><p className="mt-1 text-xs text-[#838880]">Client Ratings</p></div>

                
                <div>
                  <p className="font-semibold">
                    Client since {" "} {job?.clientJoinedAt ? new Date(job.clientJoinedAt).getFullYear() : "recently"}
                  </p>
                  <p className="mt-1 text-xs text-[#838880]">OneMarketplace.io client</p></div>
              </div>
            </section>
          </aside>
        </main>
      )}


    </div>
  )
}

export default JobDetails
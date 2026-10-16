import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import {
    client_metadata,
    connects,
    connects_history,
    freelancer_metadata,
    job_posts,
    proposals,
} from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import {
    CONNECTS_CACHE_TTL_SECONDS,
    getConnectsCacheKey,
    PROPOSAL_CONNECTS,
} from "../../config/constants.js";
import { redis } from "../../config/redis.js";

type SubmitProposalInput = {
    jobId: string;
    coverLetter: string;
    bidAmount: number;
    duration: string;
    screeningAnswers: string[];
};

const ACTIVE_PROPOSAL_STATUSES = new Set([
    "SUBMITTED",
    "VIEWED",
    "INTERVIEWED",
    "HIRED"
]);

export const submitProposal = async (
    freelancerId: string,
    input: SubmitProposalInput,
) => {
    const result = await db.transaction(async (transaction) => {
        // 1. The job must exist and be published.
        const [job] = await transaction
            .select({
                id: job_posts.id,
                title: job_posts.title,
                screeningQuestions: job_posts.screening_questions,
            })
            .from(job_posts)
            .where(
                and(
                    eq(job_posts.id, input.jobId),
                    eq(job_posts.status, "PUBLISHED"),
                ),
            )
            .limit(1);

        if (!job) throw new ApiError(404, "Job post not found.");

        // 2. Every screening question needs an answer.
        const questions: string[] = job.screeningQuestions ?? [];

        if (
            input.screeningAnswers.length !== questions.length ||
            input.screeningAnswers.some((answer) => !answer)
        ) {
            throw new ApiError(400, "Answer every screening question.");
        }

        // 3. Save the proposal first. A duplicate stops here, before any Connects move.
        const [proposal] = await transaction
            .insert(proposals)
            .values({
                job_id: job.id,
                sender_id: freelancerId,
                sender_type: "FREELANCER",
                cover_letter: input.coverLetter,
                bid_amount: input.bidAmount.toFixed(2),
                duration: input.duration,
                screening_answers: questions.map((question, index) => ({
                    question,
                    answer: input.screeningAnswers[index]!,
                })),
            })
            .onConflictDoNothing()
            .returning();

        if (!proposal) {
            throw new ApiError(409, "You already submitted a proposal for this job.");
        }

        // 4. Deduct Connects. If this fails, the transaction also undoes the proposal.
        const [balance] = await transaction
            .update(connects)
            .set({
                connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
                updated_at: new Date(),
            })
            .where(
                and(
                    eq(connects.freelancer_id, freelancerId),
                    gte(connects.connects, PROPOSAL_CONNECTS),
                ),
            )
            .returning();

        if (!balance) throw new ApiError(400, "Not enough Connects.");

        // 5. Record the spend.
        await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Proposal submitted",
            description: job.title,
            amount: -PROPOSAL_CONNECTS,
        });

        return { proposal, connects: balance.connects };
    });

    // The database is the source of truth, so a cache failure must not fail the request.
    try {
        await redis.setEx(
            getConnectsCacheKey(freelancerId),
            CONNECTS_CACHE_TTL_SECONDS,
            String(result.connects),
        );
    } catch (error) {
        console.error("Failed to update connects cache:", error);
    }

    return result;
};


export const getFreelancerProposalMetadata = async (freelancerId: string) => {
    const freelancerProposals = await db.select({
        jobId: proposals.job_id,
        status: proposals.status,
        submittedAt: proposals.created_at,
    }).from(proposals).where(
        and(
            eq(proposals.sender_id, freelancerId),
            eq(proposals.sender_type, "FREELANCER"),
        ),
    ).orderBy(desc(proposals.created_at));

    const normalizedProposals = freelancerProposals.map((proposal) => ({
        ...proposal,
        status: proposal.status.toUpperCase(),
    }));


    return {
        proposals: normalizedProposals,
        counts: {
            total: normalizedProposals.length,
            active: normalizedProposals.filter((proposal) => 
                ACTIVE_PROPOSAL_STATUSES.has(proposal.status),
            ).length,
            viewed: normalizedProposals.filter(
                (proposal) => proposal.status === "VIEWED",
            ).length,
            interviewed: normalizedProposals.filter(
                (proposal) =>
                    proposal.status === "INTERVIEWED",
            ).length,
        },
    };
};





export const getFreelancerProposals = async (freelancerId: string) =>
  db
    .select({
      id: proposals.id,
      jobId: proposals.job_id,
      title: job_posts.title,
      company: client_metadata.company_name,
      status: proposals.status,
      submittedAt: proposals.created_at,
      budget: job_posts.total_budget,
      bidAmount: proposals.bid_amount,
      duration: proposals.duration,
      coverLetter: proposals.cover_letter,
      skills: job_posts.skills,
    })
    .from(proposals)
    .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
    .leftJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
    .where(
      and(
        eq(proposals.sender_id, freelancerId),
        eq(proposals.sender_type, "FREELANCER"),
      ),
    )
    .orderBy(desc(proposals.created_at));


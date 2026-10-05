import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../../database/clients.js";
import { accounts, freelancer_proposals, job_posts } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { chargeConnectsInTransaction, refreshConnectsCache, returnConnectsInTransaction } from "../connects/connects.service.js";

export interface SubmitProposalInput {
    jobId: string;
    bidAmount: number;
    deliveryTime: string;
    coverLetter: string;
}

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === "23505";

export const getFreelancerProposals = async (freelancerId: string) =>
    db.select({
        id: freelancer_proposals.id,
        jobId: freelancer_proposals.job_id,
        bidAmount: freelancer_proposals.bid_amount,
        deliveryTime: freelancer_proposals.delivery_time,
        coverLetter: freelancer_proposals.cover_letter,
        status: freelancer_proposals.status,
        connectsCharged: freelancer_proposals.connects_charged,
        createdAt: freelancer_proposals.created_at,
        updatedAt: freelancer_proposals.updated_at,
        jobTitle: job_posts.title,
        jobStatus: job_posts.status,
        jobBudget: job_posts.total_budget,
    }).from(freelancer_proposals)
        .innerJoin(job_posts, eq(job_posts.id, freelancer_proposals.job_id))
        .where(eq(freelancer_proposals.freelancer_id, freelancerId))
        .orderBy(desc(freelancer_proposals.created_at));

export const submitFreelancerProposal = async (
    freelancerId: string,
    input: SubmitProposalInput,
) => {
    try {
        const result = await db.transaction(async (transaction) => {
            const [job] = await transaction.select({ id: job_posts.id, status: job_posts.status })
                .from(job_posts)
                .where(eq(job_posts.id, input.jobId))
                .limit(1)
                .for("update");
            if (!job || job.status !== "PUBLISHED") throw new ApiError(404, "Published job not found.");

            const [existingProposal] = await transaction.select({ id: freelancer_proposals.id })
                .from(freelancer_proposals)
                .where(and(
                    eq(freelancer_proposals.job_id, input.jobId),
                    eq(freelancer_proposals.freelancer_id, freelancerId),
                ))
                .limit(1);
            if (existingProposal) throw new ApiError(409, "You have already submitted a proposal for this job.");

            const proposalId = randomUUID();
            const balance = await chargeConnectsInTransaction(
                transaction,
                freelancerId,
                `Proposal ${proposalId} for job ${job.id}`,
            );
            const [proposal] = await transaction.insert(freelancer_proposals).values({
                id: proposalId,
                job_id: job.id,
                freelancer_id: freelancerId,
                bid_amount: input.bidAmount.toFixed(2),
                delivery_time: input.deliveryTime,
                cover_letter: input.coverLetter,
                connects_charged: 6,
            }).returning();
            if (!proposal) throw new Error("Proposal insert returned no row.");
            return { proposal, balance };
        });

        await refreshConnectsCache(freelancerId, result.balance.connects);
        return result;
    } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, "You have already submitted a proposal for this job.");
        throw error;
    }
};

export const withdrawFreelancerProposal = async (freelancerId: string, proposalId: string) => {
    const result = await db.transaction(async (transaction) => {
        const [existing] = await transaction.select().from(freelancer_proposals)
            .where(and(
                eq(freelancer_proposals.id, proposalId),
                eq(freelancer_proposals.freelancer_id, freelancerId),
            ))
            .limit(1)
            .for("update");
        if (!existing) throw new ApiError(404, "Proposal not found.");
        if (existing.status !== "SUBMITTED") throw new ApiError(409, "Only an active proposal can be withdrawn.");

        const [proposal] = await transaction.update(freelancer_proposals).set({
            status: "WITHDRAWN",
            updated_at: new Date(),
        }).where(and(
            eq(freelancer_proposals.id, proposalId),
            eq(freelancer_proposals.freelancer_id, freelancerId),
            eq(freelancer_proposals.status, "SUBMITTED"),
        )).returning();
        if (!proposal) throw new ApiError(409, "Only an active proposal can be withdrawn.");

        const balance = await returnConnectsInTransaction(
            transaction,
            freelancerId,
            `Refund for proposal ${proposal.id}`,
            proposal.connects_charged,
        );
        return { proposal, balance };
    });

    await refreshConnectsCache(freelancerId, result.balance.connects);
    return result;
};

export const getProposalOwner = async (proposalId: string) => {
    const [proposal] = await db.select({ freelancerId: freelancer_proposals.freelancer_id })
        .from(freelancer_proposals)
        .where(eq(freelancer_proposals.id, proposalId))
        .limit(1);
    return proposal?.freelancerId;
};
import { connect } from 'nats';
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { connects, connects_history, job_posts, proposals } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { CONNECTS_CACHE_TTL_SECONDS, getConnectsCacheKey, PROPOSAL_CONNECTS } from "../../config/constants.js";
import { redis } from '../../config/redis.js';


export const submitProposal  = async (
    freelancerId: string,
    input: {
        jobId: string;
        coverLetter: string;
        bidAmount: number;
        duration: string;
        screeningAnswers: string[];
    },
) => {
    const result = await db.transaction(async (transaction) => {
        const [job] = await transaction
        .select({
            id: job_posts.id,
            title: job_posts.title,
            screeningQuestions: job_posts.screening_questions,
        })
        .from(job_posts)
        .where(and(eq(job_posts.id, input.jobId), eq(job_posts.status, "PUBLISHED")),
    ).limit(1);

    if(!job) throw new ApiError(404, "Job post not found.");

    const questions = job.screeningQuestions ?? [];
    if (
        input.screeningAnswers.length !== questions.length ||
        input.screeningAnswers.some((answer) => !answer)
    ) {
        throw new ApiError(400, "Answer every screening question.");
    }

    const [balance] = await transaction.update(connects).set({
        connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
        updated_at: new Date(),
    }).where(
        and(
            eq(connects.freelancer_id, freelancerId),
            gte(connects.connects, PROPOSAL_CONNECTS)
        ),
    ).returning();

    if(!balance) throw new ApiError(400, "Not enough Connects.");

    const [proposal] = await transaction.insert(proposals).values({
        job_id: input.jobId,
        sender_id: freelancerId,
        sender_type: "FREELANCER",
        cover_letter: input.coverLetter,
        bid_amount: input.bidAmount.toString(),
        duration: input.duration,
        screening_answers: questions.map((question, index) => ({
            question,
            answer: input.screeningAnswers[index]!,
        })),
    }).onConflictDoNothing().returning();
    if (!proposal) throw new ApiError(409, "You already submitted a proposal for this job.");

    await transaction.insert(connects_history).values({
        connects_id: balance.id,
        type: "Proposal submitted",
        description: job.title,
        amount: -PROPOSAL_CONNECTS,
    });

    return { proposal, connects: balance.connects };
    });

    await redis.setEx(
        getConnectsCacheKey(freelancerId),
        CONNECTS_CACHE_TTL_SECONDS,
        String(result.connects),
    );
    return result;
};
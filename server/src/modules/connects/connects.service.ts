import { and, eq, gte, sql } from "drizzle-orm";
import { CONNECTS_CACHE_TTL_SECONDS, getConnectsCacheKey, INITIAL_CONNECTS, PROPOSAL_CONNECTS } from "../../config/constants.js"
import { db } from "../../database/clients.js"
import { connects, connects_history } from "../../database/schema.js"
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";

// cashBalance function
const cashBalance = (freelancerId: string, balance: number) => 
    redis.setEx(getConnectsCacheKey(freelancerId), CONNECTS_CACHE_TTL_SECONDS, String(balance))



export const addConnects = async (freelancerId: string) => {
    const balance = await db.transaction(async(transaction) => {
        const [balance] = await transaction.insert(connects).values({
            freelancer_id: freelancerId,
            connects: INITIAL_CONNECTS,
        }).onConflictDoNothing({target: connects.freelancer_id}).returning();

        if(!balance) return;

        await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Onboarding Bonus",
            description: "New account welcome Connects",
            amount:  INITIAL_CONNECTS,
        });

        return balance;
    });

    if (balance) await cashBalance(freelancerId, balance.connects);
    return  balance;
};

export const chargeConnects = async(
    freelancerId: string,
    description: string,
) => {
    const balance = await db.transaction(async(transaction) => {
        const [balance] = await transaction.update(connects).set({
            connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        }).where(
            and(eq(connects.freelancer_id, freelancerId),
            gte(connects.connects, PROPOSAL_CONNECTS),
        ),
    ).returning();

    if(!balance) throw new ApiError(400, "Not enough Connects.");

    await transaction.insert(connects_history).values({
        connects_id: balance.id,
        type: "Proposal submitted",
        description,
        amount: -PROPOSAL_CONNECTS,
    });

    return balance;
    });

    await cashBalance(freelancerId, balance.connects);

    return balance;
};


export const returnConnects = async (
    freelancerId: string,
    description: string,
) => {
    const balance = await db.transaction(async(transaction) => {
        const [balance] = await transaction.update(connects).set({
            connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        }).where(eq(connects.freelancer_id, freelancerId),).returning();

         if(!balance) throw new ApiError(400, "Connect balance not  found.");

         await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Proposal withdrawn refound",
             description,
             amount: -PROPOSAL_CONNECTS,
         });

         return balance;
    
    });

    await cashBalance(freelancerId, balance.connects);
    return balance
}


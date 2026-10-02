import { and, eq, gte, sql } from "drizzle-orm";
import { INITIAL_CONNECTS, PROPOSAL_CONNECTS } from "../../config/constants.js"
import { db } from "../../database/clients.js"
import { connects, connects_history } from "../../database/schema.js"
import { ApiError } from "../../utils/api-error.js";


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

    // if there is not balance
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

    // cashBalance
    return balance


}
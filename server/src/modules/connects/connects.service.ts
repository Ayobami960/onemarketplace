
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { CONNECTS_CACHE_TTL_SECONDS, CONNECTS_PLANS, getConnectsCacheKey, INITIAL_CONNECTS, PROPOSAL_CONNECTS, type ConnectsPlan } from "../../config/constants.js"
import { db } from "../../database/clients.js"
import { connects, connects_history, connects_purchase_history } from "../../database/schema.js"
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";

// cashBalance function

export const cacheBalance = async (freelancerId: string, balance: number): Promise<void> => {
    if (!redis.isReady) return;
    try {
        await redis.setEx(getConnectsCacheKey(freelancerId), CONNECTS_CACHE_TTL_SECONDS, String(balance));
    } catch (error) {
        console.warn("Connects cache could not be refreshed.", error);
    }
};

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

    const currentBalance = balance ?? (await db
        .select()
        .from(connects)
        .where(eq(connects.freelancer_id, freelancerId))
        .limit(1))[0];

    if (currentBalance) await cacheBalance(freelancerId, currentBalance.connects);
    return currentBalance;
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

    await cacheBalance(freelancerId, balance.connects);

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

    await cacheBalance(freelancerId, balance.connects);
    return balance
}



export const getConnectsHistory = async (freelancerId: string) => 
    await db
        .select({
            id: connects_history.id,
            type: connects_history.type,
            description: connects_history.description,
            amount: connects_history.amount,
            created_at: connects_history.created_at,
        })
        .from(connects_history)
        .innerJoin(connects, eq(connects_history.connects_id, connects.id))
        .where(eq(connects.freelancer_id, freelancerId))
        .orderBy(desc(connects_history.created_at))
        .limit(10);


export const createConnectsCheckout = async (freelancerId: string, purchasedConnects: ConnectsPlan) => {
    if (!env.stripeSecretKey || !env.freelancerDashboard){
        throw new ApiError(503, "Connects payments are not configured.");
    }

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: "usd",
                    unit_amount: CONNECTS_PLANS[purchasedConnects],
                    product_data: {name: `${purchasedConnects} Connects`}
                },
            },
        ],
        metadata: {
            freelancerId,
            purchasedConnects: String(purchasedConnects),
        },
        success_url: `${env.freelancerDashboard}/settings?section=payment=success`,
        cancel_url: new URL("/settings?section=connects", env.freelancerDashboard).toString(),
    });

    if(!session.url) throw new ApiError(502, "Stripe Checkout could not start");
    return session.url;
};

export const completeConnectPurchase = async (
    freelancerId: string, 
    purchasedConnects: ConnectsPlan,
    paymentId: string,
) => {
    const balance = await db.transaction(async(transaction) => {
        const [purchase] = await transaction.insert(connects_purchase_history).values({
            connects_id: sql`(select ${connects.id} from ${connects} where ${connects.freelancer_id} = ${freelancerId})`,
            purchased_connects: purchasedConnects,
            amount_paid: String(CONNECTS_PLANS[purchasedConnects] / 100),
            payment_id: paymentId,
            status: "COMPLETED",
        }).onConflictDoNothing({ target: connects_purchase_history.payment_id }).returning();

        if(!purchase) return;

        const [updatedBalance] = await transaction.update(connects).set({
            connects: sql`${connects.connects} + ${purchasedConnects}`,
            updated_at: new Date(),
        })
        .where(eq(connects.freelancer_id, freelancerId)).returning();


        if(!updatedBalance) throw new ApiError(404, "Connects balance not found.");

        await transaction.insert(connects_history).values({
            connects_id: updatedBalance.id,
            type: "Connects purchased",
            description: `Purchased ${purchasedConnects} Connects`,
            amount: purchasedConnects,
        });

        return updatedBalance;
    });

    if (balance) await cacheBalance(freelancerId, balance.connects);
};

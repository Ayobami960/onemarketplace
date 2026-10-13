
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { CONNECTS_CACHE_TTL_SECONDS, CONNECTS_PLANS, CONNECTS_RECONCILE_LOOKBACK_HOURS, getConnectsCacheKey, INITIAL_CONNECTS, PROPOSAL_CONNECTS, type ConnectsPlan } from "../../config/constants.js"
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


/*
 * Refunds the Connects that were charged for a proposal. The balance and the
 * history entry both move in the positive direction: this used to subtract
 * again, which charged a second time for a withdrawn proposal.
 */
export const returnConnects = async (
    freelancerId: string,
    description: string,
) => {
    const balance = await db.transaction(async(transaction) => {
        const [balance] = await transaction.update(connects).set({
            connects: sql`${connects.connects} + ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        }).where(eq(connects.freelancer_id, freelancerId),).returning();

         if(!balance) throw new ApiError(400, "Connect balance not found.");

         await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Proposal withdrawn refund",
             description,
             amount: PROPOSAL_CONNECTS,
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
        success_url: `${new URL("/settings?section=connects&payment=success", env.freelancerDashboard).toString()}&session_id={CHECKOUT_SESSION_ID}`,
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
    return balance?.connects;
};

export const getConnectsBalance = async (freelancerId: string): Promise<number> => {
    const [balance] = await db
        .select({ connects: connects.connects })
        .from(connects)
        .where(eq(connects.freelancer_id, freelancerId))
        .limit(1);

    return balance?.connects ?? 0;
};

export type ConnectsReconcileResult = {
    scanned: number;
    credited: Array<{ sessionId: string; freelancerId: string; connects: number }>;
    skipped: number;
};

/**
 * Credits paid Checkout Sessions that have no purchase record yet.
 *
 * A webhook can be missed entirely (bad endpoint, downtime, a lost delivery),
 * which would leave a customer charged without Connects. This walks the Stripe
 * sessions created inside the lookback window and credits the missing ones.
 * `completeConnectPurchase` is keyed on the session id, so re-running this is
 * always safe.
 */
export const reconcileUncreditedPurchases = async (
    lookbackHours: number = CONNECTS_RECONCILE_LOOKBACK_HOURS,
): Promise<ConnectsReconcileResult> => {
    const result: ConnectsReconcileResult = { scanned: 0, credited: [], skipped: 0 };

    if (!env.stripeSecretKey) return result;

    const createdAfter = Math.floor(Date.now() / 1000) - lookbackHours * 60 * 60;
    let startingAfter: string | undefined;

    // Stripe lists newest first and caps a page at 100 sessions.
    for (let page = 0; page < 20; page += 1) {
        const sessions = await stripe.checkout.sessions.list({
            limit: 100,
            created: { gte: createdAfter },
            ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        if (sessions.data.length === 0) break;

        for (const session of sessions.data) {
            result.scanned += 1;

            const freelancerId = session.metadata?.freelancerId;
            const purchasedConnects = Number(session.metadata?.purchasedConnects) as ConnectsPlan;

            if (
                session.payment_status !== "paid" ||
                !freelancerId ||
                !(purchasedConnects in CONNECTS_PLANS)
            ) {
                result.skipped += 1;
                continue;
            }

            const creditedBalance = await completeConnectPurchase(
                freelancerId,
                purchasedConnects,
                session.id,
            );

            // `undefined` means the purchase row already existed, so this
            // session was credited earlier by the webhook or the buyer.
            if (creditedBalance === undefined) {
                result.skipped += 1;
                continue;
            }

            result.credited.push({
                sessionId: session.id,
                freelancerId,
                connects: purchasedConnects,
            });
        }

        const lastSession = sessions.data[sessions.data.length - 1];
        if (!sessions.has_more || !lastSession) break;
        startingAfter = lastSession.id;
    }

    return result;
};

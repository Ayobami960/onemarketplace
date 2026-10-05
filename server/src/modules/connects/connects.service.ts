import { and, desc, eq, gte, sql } from "drizzle-orm";
import { CONNECTS_CACHE_TTL_SECONDS, getConnectsCacheKey, INITIAL_CONNECTS, PROPOSAL_CONNECTS } from "../../config/constants.js"
import { db } from "../../database/clients.js"
import { connects, connects_history, connects_purchase_history } from "../../database/schema.js"
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";

export type ConnectsTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const refreshConnectsCache = async (freelancerId: string, balance: number): Promise<void> => {
    if (!redis.isReady) return;
    try {
        await redis.setEx(getConnectsCacheKey(freelancerId), CONNECTS_CACHE_TTL_SECONDS, String(balance));
    } catch (error) {
        console.warn("Connects cache could not be refreshed.", error);
    }
};

export const getConnectsBalance = async (freelancerId: string): Promise<number> => {
    const [balance] = await db.select({ amount: connects.connects })
        .from(connects)
        .where(eq(connects.freelancer_id, freelancerId))
        .limit(1);
    return balance?.amount ?? 0;
};

export const getConnectsHistory = async (freelancerId: string) => {
    const [balance] = await db.select({ id: connects.id })
        .from(connects)
        .where(eq(connects.freelancer_id, freelancerId))
        .limit(1);
    if (!balance) return [];

    const [ledger, purchases] = await Promise.all([
        db.select().from(connects_history)
            .where(eq(connects_history.connects_id, balance.id))
            .orderBy(desc(connects_history.created_at)),
        db.select().from(connects_purchase_history)
            .where(eq(connects_purchase_history.connects_id, balance.id))
            .orderBy(desc(connects_purchase_history.created_at)),
    ]);

    return [
        ...ledger.map((entry) => ({
            id: entry.id,
            type: entry.type,
            description: entry.description,
            amount: entry.amount,
            createdAt: entry.created_at,
        })),
        ...purchases.map((purchase) => ({
            id: purchase.id,
            type: "Connects purchase",
            description: `${purchase.purchased_connects} Connects purchase (${purchase.status.toLowerCase()})`,
            amount: purchase.purchased_connects,
            amountPaid: purchase.amount_paid,
            createdAt: purchase.created_at,
        })),
    ].sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
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

    if (currentBalance) await refreshConnectsCache(freelancerId, currentBalance.connects);
    return currentBalance;
};

export const chargeConnectsInTransaction = async (
    transaction: ConnectsTransaction,
    freelancerId: string,
    description: string,
): Promise<typeof connects.$inferSelect> => {
    const [balance] = await transaction.update(connects).set({
        connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
        updated_at: new Date(),
    }).where(and(
        eq(connects.freelancer_id, freelancerId),
        gte(connects.connects, PROPOSAL_CONNECTS),
    )).returning();

    if(!balance) throw new ApiError(400, "Not enough Connects.");

    await transaction.insert(connects_history).values({
        connects_id: balance.id,
        type: "Proposal submitted",
        description,
        amount: -PROPOSAL_CONNECTS,
    });

    return balance;
};

export const chargeConnects = async (freelancerId: string, description: string) => {
    const balance = await db.transaction((transaction) =>
        chargeConnectsInTransaction(transaction, freelancerId, description),
    );
    await refreshConnectsCache(freelancerId, balance.connects);
    return balance;
};

export const returnConnectsInTransaction = async (
    transaction: ConnectsTransaction,
    freelancerId: string,
    description: string,
    amount = PROPOSAL_CONNECTS,
): Promise<typeof connects.$inferSelect> => {
    const [balance] = await transaction.update(connects).set({
        connects: sql`${connects.connects} + ${amount}`,
        updated_at: new Date(),
    }).where(eq(connects.freelancer_id, freelancerId)).returning();

    if (!balance) throw new ApiError(409, "Connect balance could not be refunded.");

    await transaction.insert(connects_history).values({
        connects_id: balance.id,
        type: "Proposal withdrawn refund",
        description,
        amount,
    });

    return balance;
};

export const returnConnects = async (freelancerId: string, description: string) => {
    const balance = await db.transaction((transaction) =>
        returnConnectsInTransaction(transaction, freelancerId, description),
    );
    await refreshConnectsCache(freelancerId, balance.connects);
    return balance
}


import { CONNECTS_RECONCILE_INTERVAL_MS } from "../../config/constants.js";
import { reconcileUncreditedPurchases } from "./connects.service.js";

let isReconciling = false;

/**
 * Credits purchases whose Stripe webhook never arrived.
 *
 * Overlapping runs are skipped so a slow Stripe call cannot stack up, and the
 * work itself is idempotent, so a missed or repeated run is harmless.
 */
export const runConnectsReconciliation = async (): Promise<void> => {
    if (isReconciling) return;
    isReconciling = true;

    try {
        const result = await reconcileUncreditedPurchases();

        if (result.credited.length > 0) {
            console.log("Connects reconciliation credited missed purchases.", {
                scanned: result.scanned,
                credited: result.credited,
            });
        }
    } catch (error) {
        console.error("Connects reconciliation failed.", error);
    } finally {
        isReconciling = false;
    }
};

/**
 * Starts the schedule and returns its timer so shutdown can stop it. The first
 * pass runs immediately, which is what recovers a purchase made while the
 * server was restarting.
 */
export const startConnectsReconciliation = (): NodeJS.Timeout => {
    const timer = setInterval(
        () => void runConnectsReconciliation(),
        CONNECTS_RECONCILE_INTERVAL_MS,
    );

    // Never hold the process open just for this background job.
    timer.unref();

    void runConnectsReconciliation();

    return timer;
};

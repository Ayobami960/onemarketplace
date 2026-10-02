import { Router } from "express";
import type { ApiResponse } from "../types/common.types.js";
import { SERVICE_NAME } from "../config/constants.js";
// import { authRouter } from "../modules/auth/auth.route.js";
// import { clerkWebhookRouter } from "../modules/auth/auth.webhook.js";
import { connectDatabase } from "../database/clients.js";
// import { clientRouter } from "../modules/clients/client.route.js";
// import { freelancerRouter } from "../modules/freelancer/freelancer.route.js";
// import { jobRouter } from "../modules/jobs/jobs.route.js";


export const apiRouter = Router();

// apiRouter.use("/auth", authRouter);
// apiRouter.use("/client"  , clientRouter);
// apiRouter.use("/freelancer", freelancerRouter);
// apiRouter.use("/jobs", jobRouter);
// apiRouter.use("/auth/webhooks/clerk", clerkWebhookRouter);

apiRouter.get("/", async (_request, response) => {
    let database: "connected" | "unavailable" = "connected";

    try {
        await connectDatabase();
    } catch (error) {
        database = "unavailable";
        console.error("Database health check failed.", error);
    }

    const body: ApiResponse<{
        service: string;
        status: "healthy" | "degraded",
        database: typeof database,
        timestamp: string
    }> = {
        success: true,
        message: "service is healthy.",
        data: {
            service: SERVICE_NAME,
            status: database === "connected" ? "healthy" : "degraded",
            database,
            timestamp: new Date().toDateString(),
        },
    };

    response.status(database === "connected" ? 200 : 503).json(body);
})


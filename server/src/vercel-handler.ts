import type { Request, Response } from "express";

type ExpressApp = typeof import("./app.js").app;

let initialization: Promise<ExpressApp> | undefined;

const initializeServices = (): Promise<ExpressApp> => {
    if (initialization) {
        return initialization;
    }

    initialization = (async (): Promise<ExpressApp> => {
        const [{ app }, { connectDatabase }] = await Promise.all([
            import("./app.js"),
            import("./database/clients.js"),
        ]);

        await connectDatabase();

        if (process.env.REDIS_HOST) {
            try {
                const { connectRedis } = await import("./config/redis.js");
                await connectRedis();
            } catch (error) {
                console.warn("Redis is unavailable; continuing without auth cache.", error);
            }
        } else {
            console.info("REDIS_HOST is not configured; continuing without auth cache.");
        }

        return app;
    })().catch((error: unknown) => {
        initialization = undefined;
        throw error;
    });

    return initialization;
};

export default async function handler(request: Request, response: Response): Promise<void> {
    try {
        const app = await initializeServices();
        await new Promise<void>((resolve, reject) => {
            response.once("finish", resolve);
            response.once("close", resolve);
            response.once("error", reject);
            app(request, response);
        });
    } catch (error) {
        console.error("Failed to handle request.", error);
        if (!response.headersSent) {
            response.statusCode = 503;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({
                success: false,
                message: "Service temporarily unavailable.",
            }));
        }
    }
}
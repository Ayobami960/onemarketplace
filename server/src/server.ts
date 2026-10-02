import { createServer, type Server } from "node:http";
import { SERVICE_NAME } from "./config/constants.js";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { connectDatabase, disconnectDatabase } from "./database/clients.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let isShuttingDown = false;

/**
 * Starts the HTTP server and resolves once it is actually listening.
 * Rejects on listen errors such as EADDRINUSE instead of failing silently.
 */
const startHttpServer = (): Promise<Server> =>
    new Promise((resolve, reject) => {
        const instance = createServer(app);

        instance.once("error", reject);
        instance.listen(env.port, () => {
            instance.off("error", reject);
            console.log(
                `${SERVICE_NAME} listening on http://localhost:${env.port} in ${env.nodeEnv} mode`
            );
            resolve(instance);
        });
    });

/**
 * Stops accepting new connections and lets in-flight requests finish.
 */
const closeHttpServer = (): Promise<void> =>
    new Promise((resolve, reject) => {
        if (!server) {
            resolve();
            return;
        }

        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });

        // Drop idle keep-alive sockets so close() doesn't wait on them.
        server.closeIdleConnections();
    });

const start = async (): Promise<void> => {
    // The database is required: fail fast if it cannot be reached.
    await connectDatabase();
    if (isShuttingDown) {
        return;
    }

    // Redis is optional: the service degrades gracefully without the auth cache.
    if (process.env.REDIS_HOST) {
        try {
            await connectRedis();
        } catch (error) {
            console.warn("Redis is unavailable; continuing without auth cache.", error);
        }
    } else {
        console.info("REDIS_HOST is not configured; continuing without auth cache.");
    }

    if (isShuttingDown) {
        return;
    }

    server = await startHttpServer();
};

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;

    console.log(`${reason}. Closing services.`);

    // Safety net: never hang forever on a stuck connection.
    const forceExitTimer = setTimeout(() => {
        console.error("Shutdown timed out; forcing exit.");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    let failed = false;

    try {
        await closeHttpServer();
    } catch (error) {
        failed = true;
        console.error("Failed to close HTTP server.", error);
    }

    // Independent resources: close together so one failure doesn't block the other.
    const results = await Promise.allSettled([
        disconnectDatabase(),
        disconnectRedis(),
    ]);

    for (const result of results) {
        if (result.status === "rejected") {
            failed = true;
            console.error("Failed to disconnect a service.", result.reason);
        }
    }

    process.exit(failed ? 1 : exitCode);
};

process.on("SIGINT", () => void shutdown("SIGINT received"));
process.on("SIGTERM", () => void shutdown("SIGTERM received"));

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection.", reason);
    void shutdown("Unhandled rejection", 1);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception.", error);
    void shutdown("Uncaught exception", 1);
});

start().catch((error) => {
    console.error(`Failed to start ${SERVICE_NAME}.`, error);
    void shutdown("Startup failure", 1);
});
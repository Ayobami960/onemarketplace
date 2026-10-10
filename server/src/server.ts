/// <reference path="./types/express.d.ts" />
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer, type Server } from "node:http";
import { API_PREFIX, SERVICE_NAME } from "./config/constants.js";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found-middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { connectDatabase, disconnectDatabase } from "./database/clients.js";
import { verifyMailer } from "./modules/auth/mailer.js";

const isVercel = process.env.VERCEL === "1";

/* -------------------------------------------------------------------------- */
/*                                Express app                                 */
/* -------------------------------------------------------------------------- */

const app = express();

app.disable("x-powered-by");
app.use(`${API_PREFIX}/connects/webhook`, express.raw({type: "application/json"}),);



app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || env.allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error("Origin is not allowed by CORS."));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(helmet());


app.use(
    express.json({ limit: "2mb" })
);
app.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/*                              Services lifecycle                            */
/* -------------------------------------------------------------------------- */

let server: Server | undefined;
let isShuttingDown = false;
let servicesReady: Promise<void> | undefined;

/**
 * Connects the database (required) and Redis (optional).
 * Memoized so it only runs once, whether called at startup or lazily on Vercel.
 */
const initServices = (): Promise<void> => {
    servicesReady ??= (async () => {
        await verifyMailer();

        // The database is required: fail fast if it cannot be reached.
        await connectDatabase();

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
    })().catch((error) => {
        servicesReady = undefined; // allow a retry on the next request
        throw error;
    });

    return servicesReady;
};

// On Vercel there is no start() call, so connect lazily on the first request.
if (isVercel) {
    app.use(async (_request, _response, next) => {
        try {
            await initServices();
            next();
        } catch (error) {
            next(error);
        }
    });
}

/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */

app.get("/", (_request, response) => {
    response.status(200).json({
        status: "ok",
        service: SERVICE_NAME,
    });
});

app.use(API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/*                         HTTP server (non-Vercel only)                      */
/* -------------------------------------------------------------------------- */

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
    await initServices();
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

const SHUTDOWN_TIMEOUT_MS = 10_000;

if (!isVercel) {
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
}

// Vercel detects the Express app through this default export.
export default app;
export { app };
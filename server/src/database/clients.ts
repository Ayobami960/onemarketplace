import "dotenv/config";
import net from "node:net";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema.js";

// Node >= 20 allows only 250ms per address by default, which fails on slower networks.
net.setDefaultAutoSelectFamilyAttemptTimeout(5_000);

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
}

export const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15_000,
});

// Prevents an idle-connection error from crashing the process.
pool.on("error", (error: any) => {
    console.error("Unexpected database pool error.", error);
});

export const db = drizzle(pool, { schema });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDatabase = async (maxAttempts = 5): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
        try {
            await pool.query("select 1");
            console.log("Database connected.");
            return;
        } catch (error) {
            if (attempt >= maxAttempts) {
                throw error;
            }
            const delay = Math.min(500 * 2 ** (attempt - 1), 5_000);
            console.warn(
                `Database connection attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms.`
            );
            await sleep(delay);
        }
    }
};

export const disconnectDatabase = async (): Promise<void> => {
    await pool.end();
};
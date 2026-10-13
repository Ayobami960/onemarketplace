import { connect, type NatsConnection } from "nats";
import { env } from "./env.js";

let connectionPromise: Promise<NatsConnection> | undefined;

// Memoize the *promise* so concurrent callers share one connection.
export const getNats = (): Promise<NatsConnection> => {
    connectionPromise ??= connect({ servers: env.natsUrl }).catch((error) => {
        connectionPromise = undefined; // allow retry
        throw error;
    });
    return connectionPromise;
};

export const disconnectNats = async (): Promise<void> => {
    const pending = connectionPromise;
    connectionPromise = undefined;
    if (!pending) return;

    const connection = await pending.catch(() => undefined);
    if (!connection || connection.isClosed()) return;

    await connection.drain(); 
};

// import {connect, type NatsConnection} from "nats";
// import {env} from "./env.js";

// let connection: NatsConnection | undefined;


// export const getNats = async () =>
// (connection ??= await connect({servers: env.natsUrl}));

// export const disconnectNats = async () => {
//     await connection?.drain();
//     connection = undefined;
// }
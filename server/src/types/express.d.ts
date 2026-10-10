import { Logger } from 'pino'; 

declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: string;
                sessionId?: string;
                role: "client" | "freelancer";
                accountExists: boolean;
                isOnboarded: boolean;
                emailVerified: boolean;
            };
            availableConnects?: number;
             logger: Logger;
        }
    }
}

export {};
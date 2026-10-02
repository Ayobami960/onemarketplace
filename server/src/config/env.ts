import "dotenv/config";

const parseRedisDatabase = (value: string | undefined): number => {
    const database = Number(value ?? 0);

    if (!Number.isInteger(database) || database < 0) {
        throw new Error("REDIS_DB must be a non-negative integer.");
    }

    return database;
}

const parsePort = (value: string | undefined): number => {
    const port = Number(value ?? 8080);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("PORT must be an integer between 1 and 65535.");
    }

    return port;
}

const parsePositiveInt = (value: string | undefined): number => {
    const parsed = Number(value);

    if (!value || !Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Value must be a positive integer.");
    }

    return parsed;
}

export const env = {
    port: parsePort(process.env.PORT),
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    clerkWebhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET || undefined,
    nodeEnv: process.env.NODE_ENV || 'development',
    redis: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: parsePort(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseRedisDatabase(process.env.REDIS_DB),
    },
    imageKitPrivateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    imageKitPublicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    imageKitUrlEndpoint: process.env.IMAGEKIT_END_POINT,
    freelancerProfile: {
        maxPortfolioProjects: parsePositiveInt(process.env.FREELANCER_MAX_PORTFOLIO_PROJECTS),
        maxSkills: parsePositiveInt(process.env.FREELANCER_MAX_SKILLS),
        minSkills: parsePositiveInt(process.env.FREELANCER_MIN_SKILLS),
        maxLanguages: parsePositiveInt(process.env.FREELANCER_MAX_LANGUAGES),
        maxSkillLength: parsePositiveInt(process.env.FREELANCER_MAX_SKILL_LENGTH),
        maxTextLength: parsePositiveInt(process.env.FREELANCER_MAX_TEXT_LENGTH),
        maxDescriptionLength: parsePositiveInt(process.env.FREELANCER_MAX_DESCRIPTION_LENGTH),
        maxPortfolioDescriptionLength: parsePositiveInt(
            process.env.FREELANCER_MAX_PORTFOLIO_DESCRIPTION_LENGTH,
        ),
        maxBase64ImageBytes: parsePositiveInt(process.env.FREELANCER_MAX_BASE64_IMAGE_BYTES),
    },
} as const;
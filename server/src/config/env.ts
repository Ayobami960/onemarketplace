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

const parseOptionalBoolean = (value: string | undefined, name: string): boolean | undefined => {
    if (value === undefined || value === "") return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`${name} must be either true or false.`);
}

const parsePositiveInt = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined || value === "") {
        return defaultValue;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Value must be a positive integer.");
    }

    return parsed;
}

const parseDuration = (value: string | undefined, fallback: string): number => {
    const input = value || fallback;
    const match = /^(\d+)(s|m|h|d)$/.exec(input);
    if (!match) throw new Error("Token TTL must use seconds, minutes, hours, or days (for example 15m).");
    const amount = Number(match[1]);
    const multiplier = match[2] === "s" ? 1 : match[2] === "m" ? 60 : match[2] === "h" ? 3600 : 86400;
    return amount * multiplier;
}

const nodeEnv = process.env.NODE_ENV || "development";
const requiredSecret = (value: string | undefined, name: string, developmentFallback: string): string => {
    const secret = value || (nodeEnv === "production" ? "" : developmentFallback);
    if (secret.length < 32) throw new Error(`${name} must be at least 32 characters.`);
    return secret;
};

const configuredOrigins = [
    process.env.ORIGINS_CLIENT_DASHBOARD,
    process.env.ORIGINS_CLIENT_LANDING_PAGE,
    process.env.ORIGINS_FREELANCER_DASHBOARD,
    process.env.ORIGINS_AGENCY_DASHBOARD,
    process.env.ORIGINS_ADMIN_DASHBOARD,
    ...(process.env.API_ALLOWED_ORIGINS || "").split(","),
].map((origin) => origin?.trim()).filter((origin): origin is string => Boolean(origin));

const allowedOrigins = [...new Set(configuredOrigins.map((origin) => {
    try {
        const url = new URL(origin);
        if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            (url.pathname !== "/" && url.pathname !== "") ||
            url.search ||
            url.hash
        ) {
            throw new Error();
        }
        return url.origin;
    } catch {
        throw new Error("ORIGINS_* and API_ALLOWED_ORIGINS must contain valid absolute HTTP(S) origins.");
    }
}))];

if (nodeEnv === "production" && allowedOrigins.length === 0) {
    throw new Error("At least one ORIGINS_* value must be configured in production.");
}

export const env = {
    port: parsePort(process.env.PORT),
    nodeEnv,
    apiPrefix: "/api/v1",
    allowedOrigins,
    jwtAccessSecret: requiredSecret(process.env.JWT_ACCESS_SECRET, "JWT_ACCESS_SECRET", "development-access-secret-change-me-32-bytes"),
    otpHmacSecret: requiredSecret(process.env.OTP_HMAC_SECRET, "OTP_HMAC_SECRET", "development-otp-secret-change-me-32-bytes"),
    accessTokenTtlSeconds: parseDuration(process.env.ACCESS_TOKEN_TTL, "15m"),
    refreshTokenTtlSeconds: parseDuration(process.env.REFRESH_TOKEN_TTL, "30d"),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    smtp: {
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT ? parsePort(process.env.SMTP_PORT) : undefined,
        secure: parseOptionalBoolean(process.env.SMTP_SECURE, "SMTP_SECURE"),
        user: process.env.SMTP_USER || undefined,
        pass: process.env.SMTP_PASS || undefined,
        from: process.env.SMTP_FROM || undefined,
    },
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || undefined,
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
        maxPortfolioProjects: parsePositiveInt(process.env.FREELANCER_MAX_PORTFOLIO_PROJECTS, 12),
        maxSkills: parsePositiveInt(process.env.FREELANCER_MAX_SKILLS, 15),
        minSkills: parsePositiveInt(process.env.FREELANCER_MIN_SKILLS, 3),
        maxLanguages: parsePositiveInt(process.env.FREELANCER_MAX_LANGUAGES, 5),
        maxSkillLength: parsePositiveInt(process.env.FREELANCER_MAX_SKILL_LENGTH, 20),
        maxTextLength: parsePositiveInt(process.env.FREELANCER_MAX_TEXT_LENGTH, 120),
        maxDescriptionLength: parsePositiveInt(process.env.FREELANCER_MAX_DESCRIPTION_LENGTH, 5000),
        maxPortfolioDescriptionLength: parsePositiveInt(
            process.env.FREELANCER_MAX_PORTFOLIO_DESCRIPTION_LENGTH,
            2000,
        ),
        maxBase64ImageBytes: parsePositiveInt(process.env.FREELANCER_MAX_BASE64_IMAGE_BYTES, 5_242_880),
    },
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookKey: process.env.STRIPE_WEBHOOK_SECRET,
    freelancerDashboard: process.env.PUBLIC_FREELANCER_DASHBOARD || process.env.FREELANCER_DASHBOARD,
} as const;
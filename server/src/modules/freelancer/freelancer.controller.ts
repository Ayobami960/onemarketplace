import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { ApiResponse } from "../../types/common.types.js";
import type { FreelancerProfileData, PortfolioData, SaveFreelancerProfileInput } from "./@types.js";
import { getFreelancerProfile, saveFreelancerProfile } from "./freelancer.service.js";
import { requireText } from "../../config/constants.js";
import { env } from "../../config/env.js";

const requireFreelancer = (request: Parameters<RequestHandler>[0]) => {
    if (!request.auth) throw new ApiError(401, "Authentication is required.");
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    return request.auth;
};

const {
    maxPortfolioProjects: MAX_PORTFOLIO_PROJECTS,
    maxSkills: MAX_SKILLS,
    minSkills: MIN_SKILLS,
    maxLanguages: MAX_LANGUAGES,
    maxSkillLength: MAX_SKILL_LENGTH,
    maxTextLength: MAX_TEXT_LENGTH,
    maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
    maxPortfolioDescriptionLength: MAX_PORTFOLIO_DESCRIPTION_LENGTH,
    maxBase64ImageBytes: MAX_BASE64_IMAGE_BYTES,
} = env.freelancerProfile;

const AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const;
const WEEKLY_AVAILABILITY_OPTIONS = [
    "Less than 20 hours / week",
    "20–30 hours / week",
    "30+ hours / week",
] as const;
const EXPERIENCE_LEVELS = ["Entry", "Intermediate", "Expert"] as const;
const LANGUAGE_PROFICIENCIES = ["Conversational", "Fluent", "Native"] as const;

const isEnumValue = <T extends readonly string[]>(
    value: unknown,
    allowed: T,
): value is T[number] => typeof value === "string" && (allowed as readonly string[]).includes(value);

const requireEnum = <T extends readonly string[]>(
    value: unknown,
    allowed: T,
    fieldName: string,
): T[number] => {
    if (!isEnumValue(value, allowed)) {
        throw new ApiError(400, `${fieldName} must be one of: ${allowed.join(", ")}.`);
    }
    return value;
};

const requireBoundedText = (
    value: unknown,
    fieldName: string,
    maxLength: number = MAX_TEXT_LENGTH,
): string => {
    const text = requireText(typeof value === "string" ? value : undefined, fieldName);
    if (text.length > maxLength) {
        throw new ApiError(400, `${fieldName} must be at most ${maxLength} characters.`);
    }
    return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** Rough decoded-size check so oversized images fail fast before hitting ImageKit. */
const parseBase64Image = (dataUrl: string): string | null => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match?.[2]) return null;

    const base64Payload = match[2];
    const base64Length = base64Payload.length - (base64Payload.endsWith("==") ? 2 : base64Payload.endsWith("=") ? 1 : 0);
    const decodedBytes = Math.floor((base64Length * 3) / 4);

    return decodedBytes <= MAX_BASE64_IMAGE_BYTES ? dataUrl : null;
};

const parsePortfolioInput = (portfolios: unknown): PortfolioData[] => {
    if (!Array.isArray(portfolios) || portfolios.length < 1) {
        throw new ApiError(400, "At least one portfolio project is required.");
    }

    if (portfolios.length > MAX_PORTFOLIO_PROJECTS) {
        throw new ApiError(400, `A portfolio can contain at most ${MAX_PORTFOLIO_PROJECTS} projects.`);
    }

    return portfolios.map((item, index) => {
        if (!isRecord(item)) {
            throw new ApiError(400, `Portfolio project ${index + 1} is invalid.`);
        }

        const label = `Portfolio project ${index + 1}`;

        const coverImage = item.cover_image;
        if (!isRecord(coverImage)) {
            throw new ApiError(400, `${label}: a cover image is required.`);
        }

        const imageId = typeof coverImage.imageId === "string" ? coverImage.imageId.trim() : "";
        const imageUrl = requireText(
            typeof coverImage.url === "string" ? coverImage.url : undefined,
            `${label} cover image URL`,
        );

        /*
         * The frontend only ever sends either a fresh data-URL image (new upload)
         * or an existing image untouched (imageId + hosted URL). Anything else is
         * untrusted, so require the data-URL form for anything without an imageId.
         */
        if (!imageId && !parseBase64Image(imageUrl)) {
            throw new ApiError(400, `${label}: the cover image is invalid or too large (max 5 MB).`);
        }

        const liveUrl =
            typeof item.live_url === "string" && item.live_url.trim()
                ? item.live_url.trim()
                : null;

        if (liveUrl) {
            try {
                const url = new URL(liveUrl);
                if (url.protocol !== "https:" && url.protocol !== "http:") {
                    throw new Error("Unsupported protocol.");
                }
            } catch {
                throw new ApiError(400, `${label}: the live link must be a valid URL.`);
            }
        }

        return {
            title: requireBoundedText(item.title, `${label} title`),
            category: requireBoundedText(item.category, `${label} category`),
            description: requireBoundedText(
                item.description,
                `${label} description`,
                MAX_PORTFOLIO_DESCRIPTION_LENGTH,
            ),
            live_url: liveUrl,
            cover_image: { imageId, url: imageUrl },
        };
    });
};

export const getLoggedInFreelancerProfileHandler: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const profile = await getFreelancerProfile(auth.userId);

    const body: ApiResponse<FreelancerProfileData | null> = {
        success: true,
        message: profile
            ? "Freelancer profile retrieved."
            : "Freelancer profile has not been completed.",
        data: profile,
    };

    return response.status(200).json(body);
});

export const upsertFreelanceProfile: RequestHandler = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);

    const body = request.body as Record<string, unknown> | undefined;
    if (!isRecord(body)) {
        throw new ApiError(400, "A request body is required.");
    }

    const metadata = body.freelancer_metadata;
    if (!isRecord(metadata)) {
        throw new ApiError(400, "Freelancer metadata is required.");
    }

    const portfolios = parsePortfolioInput(body.freelancer_portfolios);

    const hourlyRate = Number(metadata.hourly_rate);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 5 || hourlyRate > 1000) {
        throw new ApiError(400, "Hourly rate must be between 5 and 1000.");
    }

    const skills = metadata.skills;
    if (
        !Array.isArray(skills) ||
        skills.length < MIN_SKILLS ||
        skills.length > MAX_SKILLS ||
        skills.some((skill) => typeof skill !== "string" || !skill.trim() || skill.trim().length > MAX_SKILL_LENGTH)
    ) {
        throw new ApiError(
            400,
            `Add ${MIN_SKILLS} to ${MAX_SKILLS} skills with at most ${MAX_SKILL_LENGTH} characters each.`,
        );
    }

    const languages = metadata.languages;
    if (!Array.isArray(languages) || languages.length < 1 || languages.length > MAX_LANGUAGES) {
        throw new ApiError(400, `Add between 1 and ${MAX_LANGUAGES} languages.`);
    }

    const input: SaveFreelancerProfileInput = {
        userId: auth.userId,
        professional_title: requireBoundedText(metadata.professional_title, "Professional title"),
        professional_description: requireBoundedText(
            metadata.professional_description,
            "Professional description",
            MAX_DESCRIPTION_LENGTH,
        ),
        hourly_rate: hourlyRate.toFixed(2),
        country: requireBoundedText(metadata.country, "Country", 56),
        city: requireBoundedText(metadata.city, "City", 85),
        availability_status: requireEnum(
            metadata.availability_status,
            AVAILABILITY_STATUSES,
            "Availability status",
        ),
        weekly_availability: requireEnum(
            metadata.weekly_availability,
            WEEKLY_AVAILABILITY_OPTIONS,
            "Weekly availability",
        ),
        experience_level: requireEnum(metadata.experience_level, EXPERIENCE_LEVELS, "Experience level"),
        skills: [...new Set(skills.map((skill) => String(skill).trim()))],
        languages: languages.map((item, index) => {
            if (!isRecord(item)) {
                throw new ApiError(400, `Language ${index + 1} is invalid.`);
            }
            return {
                language: requireBoundedText(item.language, `Language ${index + 1}`, 58),
                proficiency: requireEnum(
                    item.proficiency,
                    LANGUAGE_PROFICIENCIES,
                    `Language ${index + 1} proficiency`,
                ),
            };
        }),
        portfolios,
    };

    const profile = await saveFreelancerProfile(input, request.auth?.isOnboarded);

    const responseBody: ApiResponse<FreelancerProfileData> = {
        success: true,
        message: "Freelancer profile saved.",
        data: profile,
    };
    return response.status(200).json(responseBody);
});
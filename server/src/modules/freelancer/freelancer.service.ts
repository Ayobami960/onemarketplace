import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, client_metadata, freelancer_metadata, freelancer_portfolios, job_posts, proposals } from "../../database/schema.js";
import type { FreelancerProfileData, JobFeedFilters, PortfolioData, SaveFreelancerProfileInput } from "./@types.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { imageKit } from "../../config/imageKit.js";
import { randomUUID } from "crypto";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";
import { redis } from "../../config/redis.js";
import { addConnects } from "../connects/connects.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client country comes from the client profile first, then the account row.
 * Both values are selected by the job queries below, so no extra query is needed.
 */
const resolveClientCountry = (
    profileCountry: string | null,
    accountCountry: string | null,
): string | null => profileCountry?.trim() || accountCountry?.trim() || null;

export const getFreelancerProfile = async (userId: string): Promise<FreelancerProfileData | null> => {
    const [result] = await db
        .select()
        .from(freelancer_metadata)
        .innerJoin(
            accounts,
            and(
                eq(accounts.auth_id, freelancer_metadata.auth_id),
                eq(accounts.role, "FREELANCER"),
            ),
        )
        .where(eq(freelancer_metadata.auth_id, userId))
        .limit(1);

    if (!result) return null;

    const profile = result.freelancer_metadata;

    const portfolios = await db
        .select()
        .from(freelancer_portfolios)
        .where(eq(freelancer_portfolios.freelancer_id, profile.id));

    return {
        ...profile,
        avatarUrl: profile.avatar_url ?? "",
        identityVerified: result.accounts.identityVerified === true,
        joined_at: profile.created_at,
        portfolios,
    };
};

const isStorageConfigured = () =>
    Boolean(env.imageKitPrivateKey && env.imageKitPublicKey && env.imageKitUrlEndpoint);

/** Deletes ImageKit assets, logging failures instead of hiding them (cleanup is best-effort). */
const deleteStorageAssets = async (fileIds: string[]): Promise<void> => {
    await Promise.allSettled(
        [...new Set(fileIds.filter(Boolean))].map(async (fileId) => {
            try {
                await imageKit.files.delete(fileId);
            } catch (error) {
                console.error(
                    `Failed to delete ImageKit asset ${fileId}. The asset may be orphaned in storage.`,
                    error,
                );
            }
        }),
    );
};

const uploadPortfolioImages = async (
    userId: string,
    portfolios: PortfolioData[],
): Promise<{ uploadedPortfolios: PortfolioData[]; uploadedFileIds: string[] }> => {
    if (!isStorageConfigured()) {
        throw new ApiError(503, "Portfolio image uploads are not configured.");
    }

    const uploadedFileIds: string[] = [];
    const uploadedPortfolios: PortfolioData[] = [];

    try {
        for (const portfolio of portfolios) {
            /*
             * Untouched existing projects carry an already-hosted image
             * (imageId + URL). Only fresh data-URL images need uploading.
             */
            if (!portfolio.cover_image.url.startsWith("data:image/")) {
                uploadedPortfolios.push(portfolio);
                continue;
            }

            const upload = await imageKit.files.upload({
                file: portfolio.cover_image.url,
                fileName: `portfolio-${randomUUID()}`,
                folder: `/onemarketplace/freelancer-portfolios/${userId}`,
                useUniqueFileName: true,
            });

            if (!upload.fileId || !upload.url) {
                throw new ApiError(502, "Portfolio image upload failed.");
            }

            uploadedFileIds.push(upload.fileId);
            uploadedPortfolios.push({
                ...portfolio,
                cover_image: { imageId: upload.fileId, url: upload.url },
            });
        }

        return { uploadedPortfolios, uploadedFileIds };
    } catch (error) {
        // Roll back any images that were already uploaded in this batch.
        await deleteStorageAssets(uploadedFileIds);
        throw error;
    }
};

export const saveFreelancerProfile = async (
    input: SaveFreelancerProfileInput,
): Promise<FreelancerProfileData> => {
    const existingImages = await db
        .select({ cover_image: freelancer_portfolios.cover_image })
        .from(freelancer_portfolios)
        .innerJoin(
            freelancer_metadata,
            eq(freelancer_portfolios.freelancer_id, freelancer_metadata.id),
        )
        .where(eq(freelancer_metadata.auth_id, input.userId));

    const { uploadedPortfolios, uploadedFileIds } = await uploadPortfolioImages(
        input.userId,
        input.portfolios,
    );

    let profile: FreelancerProfileData;

    try {
        profile = await db.transaction(async (transaction) => {
            const [account] = await transaction
                .update(accounts)
                .set({ isOnboardingComplete: true })
                .where(
                    and(
                        eq(accounts.auth_id, input.userId),
                        eq(accounts.role, "FREELANCER"),
                    ),
                )
                .returning();

            if (!account) throw new ApiError(404, "Freelancer account not found.");

            const metadataValues = {
                professional_title: input.professional_title,
                professional_description: input.professional_description,
                hourly_rate: input.hourly_rate,
                country: input.country,
                city: input.city,
                availability_status: input.availability_status,
                weekly_availability: input.weekly_availability,
                experience_level: input.experience_level,
                skills: input.skills,
                languages: input.languages,
                avatar_url: input.avatarUrl || null,
            };

            // Upsert: one metadata row per auth_id, no duplicates.
            const [metadata] = await transaction
                .insert(freelancer_metadata)
                .values({
                    auth_id: input.userId,
                    ...metadataValues,
                })
                .onConflictDoUpdate({
                    target: freelancer_metadata.auth_id,
                    set: metadataValues,
                })
                .returning();

            if (!metadata) {
                throw new ApiError(500, "Freelancer profile could not be saved.");
            }

            /*
             * Portfolio is saved as full replacement: delete then re-insert the
             * submitted set. The image lifecycle is handled by comparing the
             * retained imageIds against the pre-save snapshot below.
             */
            await transaction
                .delete(freelancer_portfolios)
                .where(eq(freelancer_portfolios.freelancer_id, metadata.id));

            const portfolios = uploadedPortfolios.length
                ? await transaction
                    .insert(freelancer_portfolios)
                    .values(uploadedPortfolios.map((portfolio) => ({ freelancer_id: metadata.id, ...portfolio })))
                    .returning()
                : [];

            return {
                professional_title: metadata.professional_title,
                professional_description: metadata.professional_description,
                hourly_rate: metadata.hourly_rate,
                country: metadata.country,
                city: metadata.city,
                availability_status: metadata.availability_status,
                weekly_availability: metadata.weekly_availability,
                experience_level: metadata.experience_level,
                skills: metadata.skills,
                languages: metadata.languages,
                avatarUrl: metadata.avatar_url ?? "",
                portfolios,
                identityVerified: account.identityVerified === true,
                joined_at: metadata.created_at,
            };
        });
    } catch (error) {
        // The DB write failed: roll back every image uploaded for this save.
        await deleteStorageAssets(uploadedFileIds);
        throw error;
    }

    /*
     * The transaction committed. DB now points only to `retainedImageIds`.
     * Delete storage assets that are no longer referenced: replaced images
     * and images of removed projects. The new uploads are never in this set.
     */
    const retainedImageIds = new Set(
        uploadedPortfolios.map(({ cover_image }) => cover_image.imageId),
    );

    const staleImageIds = existingImages
        .map(({ cover_image }) => cover_image.imageId)
        .filter((fileId) => fileId && !retainedImageIds.has(fileId));

    await deleteStorageAssets(staleImageIds);

    await addConnects(input.userId);

    // Best-effort cache refresh: a Redis failure must not fail a committed save.
    try {
        await redis.setEx(
            getAccountAuthCacheKey(input.userId, "freelancer"),
            ACCOUNT_AUTH_CACHE_TTL_SECONDS,
            JSON.stringify({
                userId: input.userId,
                role: "freelancer",
                accountExists: true,
                isOnboarded: true,
                emailVerified: true,
            }),
        );
    } catch (error) {
        console.warn(
            "Freelancer auth cache could not be refreshed after profile save.",
            error,
        );
    }

    return profile;
};

/** Job feed for the freelancer dashboard. */
export const getMatchedJobPosts = async (
    userId: string,
    filters: JobFeedFilters = {},
) => {
    const [profile] = await db
        .select({ skills: freelancer_metadata.skills })
        .from(freelancer_metadata)
        .where(eq(freelancer_metadata.auth_id, userId));

    if (!profile) throw new ApiError(404, "Freelancer profile not found.");

    const skills = profile.skills.map((skill) => skill.toLowerCase());

    const jobs = await db
        .select({
            job: job_posts,
            companyName: client_metadata.company_name,
            profileCountry: client_metadata.country,
            accountCountry: accounts.country,
            paymentVerified: accounts.paymentMethodVerified,
        })
        .from(job_posts)
        .innerJoin(accounts, eq(job_posts.client_id, accounts.auth_id))
        .innerJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
        .where(eq(job_posts.status, "PUBLISHED"))
        .orderBy(desc(job_posts.published_at));

    const proposalCounts = await db
        .select({ jobId: proposals.job_id, count: count(proposals.id) })
        .from(proposals)
        .groupBy(proposals.job_id);

    const counts = new Map(
        proposalCounts.map((item) => [item.jobId, Number(item.count)]),
    );

    const filteredJobs = jobs
        .map(({ job, companyName, profileCountry, accountCountry, paymentVerified }) => ({
            ...job,
            companyName,
            clientCountry: resolveClientCountry(profileCountry, accountCountry),
            paymentVerified: paymentVerified === true,
            proposalCounts: counts.get(job.id) ?? 0,
        }))
        .filter((job) => {
            const budget = Number(job.total_budget);
            return (
                (!filters.levels?.length || filters.levels.includes(job.expertise_level)) &&
                (!filters.durations?.length || filters.durations.includes(job.expected_duration)) &&
                (filters.minBudget === undefined || budget >= filters.minBudget) &&
                (filters.maxBudget === undefined || budget <= filters.maxBudget) &&
                (filters.minProposals === undefined || job.proposalCounts >= filters.minProposals) &&
                (filters.maxProposals === undefined || job.proposalCounts <= filters.maxProposals) &&
                (!filters.paymentVerified || job.paymentVerified)
            );
        });

    // "recent": already ordered by published_at desc from the query.
    if (filters.sort === "recent") return filteredJobs;

    const postedAt = (job: { published_at: Date | null; created_at: Date | null }) =>
        new Date(job.published_at ?? job.created_at ?? 0).getTime();

    return filteredJobs
        .map((job) => {
            const jobSkills = job.skills.map((skill) => skill.toLowerCase());
            const content = `${job.title} ${job.description}`.toLowerCase();

            const skillMatches = skills.filter((skill) =>
                jobSkills.some(
                    (jobSkill) => jobSkill === skill || jobSkill.includes(skill),
                ),
            ).length;

            const contentMatches = skills.filter((skill) =>
                content.includes(skill),
            ).length;

            return { ...job, matchScore: skillMatches * 2 + contentMatches };
        })
        // Hides jobs that share nothing with the freelancer's skills.
        .filter((job) => job.matchScore > 0)
        .sort(
            (first, second) =>
                second.matchScore - first.matchScore ||
                postedAt(second) - postedAt(first),
        );
};

/** Single job post for the freelancer job details page. */
export const getFreelancerJobPost = async (jobId: string) => {
    if (!UUID_PATTERN.test(jobId)) {
        throw new ApiError(400, "Invalid job id.");
    }

    const [result] = await db
        .select({
            job: job_posts,
            companyName: client_metadata.company_name,
            companyDescription: client_metadata.company_description,
            profileCountry: client_metadata.country,
            accountCountry: accounts.country,
            paymentVerified: accounts.paymentMethodVerified,
            clientJoinedAt: accounts.created_at,
        })
        .from(job_posts)
        .innerJoin(accounts, eq(job_posts.client_id, accounts.auth_id))
        .innerJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
        .where(and(eq(job_posts.id, jobId), eq(job_posts.status, "PUBLISHED")))
        .limit(1);

    if (!result) throw new ApiError(404, "Job post not found.");

    const [proposalTotal] = await db
        .select({ count: count(proposals.id) })
        .from(proposals)
        .where(eq(proposals.job_id, jobId));

    return {
        ...result.job,
        companyName: result.companyName,
        companyDescription: result.companyDescription,
        clientCountry: resolveClientCountry(result.profileCountry, result.accountCountry),
        paymentVerified: result.paymentVerified === true,
        clientJoinedAt: result.clientJoinedAt,
        proposalCounts: Number(proposalTotal?.count ?? 0),
    };
};
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { job_posts } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { imageKit } from "../../config/imageKit.js";
import { env } from "../../config/env.js";
import { randomUUID } from "crypto";

type JobData =  Omit<typeof job_posts.$inferInsert, "client_id">;
type Attachment = NonNullable<JobData["attachments"]>[number];

const deleteDocuments = (attachments: Attachment[] = []) => 
    Promise.allSettled(
    attachments
        .filter(({fileId}) => fileId)
        .map(({fileId}) => imageKit.files.delete(fileId)),
);

const uploadDocuments = async (
    userId: string, 
    attachments: Attachment[] = [],

) => {
    const uploaded: Attachment[] = []
    const uploadedIds: string[] = [];


    try {
        for (const attachment of attachments){
            if(!attachment.fileUrl.startsWith("data:")){
                uploaded.push(attachment);
                continue;
            }

            if (!env.imageKitPrivateKey && env.imageKitPublicKey && env.imageKitUrlEndpoint) {
                throw new ApiError(503, "Document uploads are not configured.")
            }

            const file = await imageKit.files.upload({
                file: attachment.fileUrl,
                fileName: attachment.fileName || `job-document-${randomUUID()}`,
                folder: `/onemarketplace/job-attachments/${userId}`,
            });

            if(!file.fileId || !file.url){
                throw new ApiError(502, "Document upload failed.");
            }

            uploaded.push({ ...attachment, fileId: file.fileId, fileUrl: file.url});
            uploadedIds.push(file.fileId);
        }

        return {attachments: uploaded, uploadedIds}
    } catch (error) {
        await Promise.allSettled(
            uploadedIds.map((fileId) => imageKit.files.delete(fileId)),
        );
        throw error;
    }
}




export const createJobPost = async (
    userId: string,
    data: Omit<typeof job_posts.$inferInsert, "client_id">,
) => {

     const {attachments, uploadedIds} = await uploadDocuments(
        userId,
        data.attachments ?? [],
    );

   try {
     const [job] = await db.insert(job_posts).values({
        ...data,
        attachments,
        client_id: userId,
    }).returning();

     return job;
   } catch (error) {
     await Promise.allSettled(
            uploadedIds.map((fileId) => imageKit.files.delete(fileId)),
        );
        throw error;
   }

};


export const getJobPosts = async (userId: string, jobId?: string) => {
    return db
        .select()
        .from(job_posts)
        .where(
            jobId
             ? and(eq(job_posts.client_id, userId), eq(job_posts.id, jobId)) 
             : eq(job_posts.client_id, userId),
        ).orderBy(desc(job_posts.created_at))
};

export const updateJobPost =  async (userId: string, jobId: string, data: Partial<typeof job_posts.$inferInsert>) => {

    const [existingJob] = await db.select().from(job_posts).where(
        and(
            eq(job_posts.id, jobId),
                eq(job_posts.client_id, userId),
                ne(job_posts.status, "HIRED")
        )
    ).limit(1);


    if (!existingJob) throw new ApiError(404, "Editable job post not found.");


     const {attachments, uploadedIds} = await uploadDocuments(
        userId,
        data.attachments ?? [],
    );



    let job;

   try {
    [job] = await db
        .update(job_posts)
        .set({...data, updated_at: new Date()})
        .where(
            and(
                eq(job_posts.id, jobId), 
                eq(job_posts.client_id, userId), 
                ne(job_posts.status, "HIRED"),
            ),
        ).returning();
        return job;
   } catch (error) {}
   
   
   if (!job){

   await Promise.allSettled(
            uploadedIds.map((fileId) => imageKit.files.delete(fileId)),
        );
        throw new ApiError(404, "Editable job post not found.");
    }

    const retainedIds = new Set(attachments.map(({fileId}) => fileId));
    await deleteDocuments(
        existingJob.attachments?.filter(({fileId}) => !retainedIds.has(fileId))
    );

    return job;
}


export const deleteJobPost = async (userId: string, jobId: string) => {
    const [job] = await db
    .delete(job_posts)
    .where(
        and(
            eq(job_posts.id, jobId), 
            eq(job_posts.client_id, userId), 
            ne(job_posts.status, "HIRED"),
        ),
    ).returning();

    if(!job) throw new ApiError(404, "Deletable job post not found.");

    await deleteDocuments(job.attachments ?? []);
    return job;
}
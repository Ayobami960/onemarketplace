CREATE TABLE "freelancer_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"freelancer_id" text NOT NULL,
	"bid_amount" numeric(9, 2) NOT NULL,
	"delivery_time" text NOT NULL,
	"cover_letter" text NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"connects_charged" integer DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "freelancer_proposals" ADD CONSTRAINT "freelancer_proposals_job_id_job_posts_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_proposals" ADD CONSTRAINT "freelancer_proposals_freelancer_id_accounts_auth_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "freelancer_proposals_job_freelancer_unique" ON "freelancer_proposals" USING btree ("job_id","freelancer_id");
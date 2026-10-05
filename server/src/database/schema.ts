
import { relations, sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, boolean, timestamp, numeric, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const accountRole = pgEnum("account_role", ["FREELANCER", "CLIENT"])
export const verificationPurpose = pgEnum("verification_purpose", ["email_verification", "password_reset"])

export const accounts = pgTable("accounts", {
    id: uuid("id").defaultRandom().primaryKey(),
    auth_id: text("auth_id").notNull().unique(),
    email: text("email").notNull(),
    first_name: text("first_name"),
    last_name: text("last_name"),
    country: text("country"),
    password_hash: text("password_hash"),
    email_verified_at: timestamp("email_verified_at", { withTimezone: true }),
    failed_login_count: integer("failed_login_count").default(0).notNull(),
    locked_until: timestamp("locked_until", { withTimezone: true }),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    role: accountRole().default("CLIENT").notNull(),
    identityVerified: boolean("identityVerified").default(false).notNull(),
    paymentMethodVerified: boolean("paymentMethodVerified").default(false).notNull(),
    isOnboardingComplete: boolean("isOnboardingComplete").default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [uniqueIndex("accounts_email_unique").on(sql`lower(${table.email})`)]);

export const sessions = pgTable("sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    account_id: text("account_id").notNull().references(() => accounts.auth_id, { onDelete: "cascade" }),
    family_id: uuid("family_id").notNull(),
    token_hash: text("token_hash").notNull(),
    user_agent: text("user_agent"),
    ip: text("ip"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
    replaced_by: uuid("replaced_by"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.token_hash),
    index("sessions_account_id_idx").on(table.account_id),
    index("sessions_family_id_idx").on(table.family_id),
    index("sessions_expires_at_idx").on(table.expires_at),
]);

export const verification_codes = pgTable("verification_codes", {
    id: uuid("id").defaultRandom().primaryKey(),
    account_id: text("account_id").notNull().references(() => accounts.auth_id, { onDelete: "cascade" }),
    purpose: verificationPurpose().notNull(),
    code_hash: text("code_hash").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    consumed_at: timestamp("consumed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("verification_codes_account_purpose_idx").on(table.account_id, table.purpose),
    index("verification_codes_expires_at_idx").on(table.expires_at),
]);


export const client_metadata = pgTable("client_metadata", {
    id: uuid("id").defaultRandom().primaryKey(),
    auth_id: text("auth_id").notNull(),
    first_name: text("first_name"),
    last_name: text("last_name"),
    country: text("country"),
    avatar_url: text("avatar_url"),
    role: text("role").notNull(),
    company_name: text("company_name").notNull(),
    company_website: text("company_website").notNull(),
    company_size: text("company_size").notNull(),
    industry: text("industry").notNull(),
    company_description: text("company_description").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const freelancer_metadata = pgTable("freelancer_metadata", {
    id: uuid("id").defaultRandom().primaryKey(),
    auth_id: text("auth_id").notNull().unique(),
    professional_title: text("professional_title").notNull(),
    professional_description: text("professional_description").notNull(),
    hourly_rate: numeric("hourly_rate", {
        precision: 6,
        scale: 2,
    }).notNull(),
    country: text("country").notNull(),
    city: text("city").notNull(),
    availability_status: text("availability_status").notNull().default("AVAILABLE"),
    weekly_availability: text("weekly_availability").notNull(), 
    experience_level: text("experience_level").notNull(), 
    skills: text("skills").array().notNull().default([]),
    languages: 
        jsonb("languages").$type<
            Array<{language: string; proficiency: string }>
        >().notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),  

})

export const freelancer_portfolios = pgTable("freelancer_portfolios", {
    id: uuid("id").defaultRandom().primaryKey(),
    freelancer_id: uuid("freelancer_id")
        .notNull()
        .references(() => freelancer_metadata.id, {
            onDelete: "cascade",
        }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    live_url: text("live_url"),
    cover_image: jsonb("cover_image")
        .$type<{
            imageId: string;
            url: string;
        }>()
        .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})



export const freelancerMetadataRelations = relations(
    freelancer_metadata,
    ({ many }) => ({
        portfolios: many(freelancer_portfolios),
    })
);



export const freelancerPortfolioRelations = relations(
    freelancer_portfolios,
    ({ one }) => ({
        freelancer: one(freelancer_metadata, {
            fields: [freelancer_portfolios.freelancer_id],
            references: [freelancer_metadata.id]
        })
    })
);



export const job_posts = pgTable("job_posts", {
    id: uuid("id").defaultRandom().primaryKey(),
    client_id: text("client_id").notNull().references(() => accounts.auth_id, {
        onDelete: "cascade"
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    expertise_level: text("expertise_level").notNull(),
    expected_duration: text("expected_duration").notNull(),
    skills: text("skills").array().notNull().default([]),

    total_budget: numeric("total_budget", {
        precision: 9,
        scale: 2,
    }).notNull(),

    milestones: jsonb("milestones").$type<Array<{
        id: string,
        title: string,
        budget: number;
        dueDate: string;
    }>
    >().notNull(),
    
    screening_questions: text("screening_questions").array().default([]),
    attachments: jsonb("attachments").$type<Array <{
       fileId: string,
       fileName: string;
       fileUrl: string;
       fileType: string;
       fileSize: number 
    }>
    >().default([]),
    status: text("status").notNull().default("DRAFT"),


     published_at: timestamp("published_at", {
        withTimezone: true,
    }),

    hired_at: timestamp("hired_at", {
        withTimezone: true,
    }),

    created_at: timestamp("created_at", {
        withTimezone: true,
    }).defaultNow(),

    updated_at: timestamp("updated_at", {
        withTimezone: true,
    }).defaultNow(),
});

export const connects = pgTable("connects", {
    id: uuid("id").defaultRandom().primaryKey(),
    freelancer_id: text("freelancer_id").notNull().unique().references(() => freelancer_metadata.auth_id, {
        onDelete: "cascade",
    }),
    connects: integer("connects").notNull().default(0),
    created_at: timestamp("created_at", {withTimezone: true}).defaultNow(),
    updated_at: timestamp("updated_at", {withTimezone: true}).defaultNow(),
});

export const freelancer_proposals = pgTable("freelancer_proposals", {
    id: uuid("id").defaultRandom().primaryKey(),
    job_id: uuid("job_id").notNull().references(() => job_posts.id, { onDelete: "cascade" }),
    freelancer_id: text("freelancer_id").notNull().references(() => accounts.auth_id, { onDelete: "cascade" }),
    bid_amount: numeric("bid_amount", { precision: 9, scale: 2 }).notNull(),
    delivery_time: text("delivery_time").notNull(),
    cover_letter: text("cover_letter").notNull(),
    status: text("status").notNull().default("SUBMITTED"),
    connects_charged: integer("connects_charged").notNull().default(6),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
    uniqueIndex("freelancer_proposals_job_freelancer_unique").on(table.job_id, table.freelancer_id),
]);


export const connects_history = pgTable("connects_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    connects_id: uuid("connects_id").notNull().references(() => connects.id, {onDelete: "cascade"}),
    type: text("type").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    created_at: timestamp("created_at", {withTimezone: true}).defaultNow(),
});


export const connects_purchase_history = pgTable("connects_purchase_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    connects_id: uuid("connects_id").notNull().references(() => connects.id, {onDelete: "cascade"}),
    purchased_connects: integer("purchased_connects").notNull(),
    amount_paid: numeric("amount_paid").notNull(),
    payment_id: text("payment_id").notNull().unique(),
    status: text("status").notNull().default("PENDING"),
    created_at: timestamp("created_at", {withTimezone: true}).defaultNow(),
    updated_at: timestamp("updated_at", {withTimezone: true}).defaultNow(),

})


// we need tot connect relation with the freelancer for the connects, connects_history, connects_purchase_history which  is called many to one relation.
export const connectsRelations = relations(connects, ({many, one}) => ({
    freelancer: one(freelancer_metadata, {
        fields: [connects.freelancer_id],
        references: [freelancer_metadata.auth_id],
    }),
    history: many(connects_history),
    purchases: many(connects_purchase_history),
}));

// connect history relations
export const connectsHistoryRelations = relations(connects_history, ({one}) => ({
    balance: one(connects, {
        fields: [connects_history.connects_id],
        references: [connects.id],
    }),
}));   



// connects purchase history relations

export const connectsPurchaseHistoryRelations = relations(connects_purchase_history, ({one}) => ({
    balance: one(connects, {
        fields: [connects_purchase_history.connects_id],
        references: [connects.id],
    }),
}),
);

import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const assessmentSession = pgTable("assessment_session", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  framework: text("framework").notNull(),
  problemContent: text("problem_content").notNull(),
  rubric: jsonb("rubric"), // Grading rubric for the assessment
  status: text("status").notNull().default("active"), // "active" | "completed" | "abandoned"
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const assessmentSubmission = pgTable("assessment_submission", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id")
    .notNull()
    .references(() => assessmentSession.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  code: jsonb("code").notNull(), // Store file structure and code
  score: text("score"), // Will be populated after grading
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

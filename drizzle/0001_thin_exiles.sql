CREATE TABLE "assessment_session" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"framework" text NOT NULL,
	"problem_content" text NOT NULL,
	"rubric" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_submission" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code" jsonb NOT NULL,
	"score" text,
	"feedback" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"graded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_session" ADD CONSTRAINT "assessment_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_submission" ADD CONSTRAINT "assessment_submission_session_id_assessment_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_submission" ADD CONSTRAINT "assessment_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
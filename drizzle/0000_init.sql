CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"guess" text NOT NULL,
	"confidence" integer NOT NULL,
	"correct" boolean NOT NULL,
	"points" integer NOT NULL,
	"response_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_guess_ck" CHECK ("answers"."guess" in ('real', 'ai')),
	CONSTRAINT "answers_confidence_ck" CHECK ("answers"."confidence" between 50 and 100)
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"region" jsonb
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"media_type" text NOT NULL,
	"media_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"license" text NOT NULL,
	"license_url" text,
	"attribution" text NOT NULL,
	"generator" text,
	"provenance_note" text NOT NULL,
	"assessment_set" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"review_status" text DEFAULT 'ai_draft' NOT NULL,
	"rating" real DEFAULT 1500 NOT NULL,
	"times_shown" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_label_ck" CHECK ("items"."label" in ('real', 'ai')),
	CONSTRAINT "items_media_type_ck" CHECK ("items"."media_type" in ('image', 'audio', 'video')),
	CONSTRAINT "items_status_ck" CHECK ("items"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "items_review_ck" CHECK ("items"."review_status" in ('ai_draft', 'reviewed')),
	CONSTRAINT "items_assessment_ck" CHECK ("items"."assessment_set" is null or "items"."assessment_set" in ('A', 'B')),
	CONSTRAINT "items_generator_ck" CHECK (("items"."label" = 'ai') = ("items"."generator" is not null))
);
--> statement-breakpoint
CREATE TABLE "player_skills" (
	"player_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"rating" real DEFAULT 1500 NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_skills_player_id_tag_pk" PRIMARY KEY("player_id","tag")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text,
	"classroom_id" uuid,
	"streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"last_daily_day" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"day_key" text NOT NULL,
	"item_ids" jsonb NOT NULL,
	"score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "rounds_kind_ck" CHECK ("rounds"."kind" in ('daily', 'practice', 'assessment_pre', 'assessment_post'))
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_role_ck" CHECK ("staff_users"."role" in ('teacher', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_staff_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clues" ADD CONSTRAINT "clues_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answers_round_item_uq" ON "answers" USING btree ("round_id","item_id");--> statement-breakpoint
CREATE INDEX "answers_player_idx" ON "answers" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE INDEX "answers_item_idx" ON "answers" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classrooms_join_code_uq" ON "classrooms" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "classrooms_teacher_idx" ON "classrooms" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "clues_item_idx" ON "clues" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_slug_uq" ON "items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "players_classroom_idx" ON "players" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "rounds_player_idx" ON "rounds" USING btree ("player_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_daily_uq" ON "rounds" USING btree ("player_id","day_key") WHERE "rounds"."kind" = 'daily';--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_assessment_uq" ON "rounds" USING btree ("player_id","kind") WHERE "rounds"."kind" like 'assessment%';--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_email_uq" ON "staff_users" USING btree ("email");
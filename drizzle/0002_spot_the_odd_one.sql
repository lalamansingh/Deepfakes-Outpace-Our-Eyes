ALTER TABLE "rounds" DROP CONSTRAINT "rounds_kind_ck";--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "picked_item_id" uuid;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "puzzles" jsonb;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_picked_item_id_items_id_fk" FOREIGN KEY ("picked_item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_kind_ck" CHECK ("rounds"."kind" in ('daily', 'practice', 'assessment_pre', 'assessment_post', 'spot'));
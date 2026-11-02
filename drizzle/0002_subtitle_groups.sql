CREATE TABLE "subtitle_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"subtitles" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subtitle_groups" ADD CONSTRAINT "subtitle_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subtitle_groups_project_idx" ON "subtitle_groups" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "subtitle_groups" ENABLE ROW LEVEL SECURITY;

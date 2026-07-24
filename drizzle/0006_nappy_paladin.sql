CREATE TYPE "public"."editorial_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "editor_list_items" (
	"list_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "editor_list_items_list_id_title_id_pk" PRIMARY KEY("list_id","title_id")
);
--> statement-breakpoint
CREATE TABLE "editor_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editor_lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "editor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"score" integer NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editor_reviews_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "editor_list_items" ADD CONSTRAINT "editor_list_items_list_id_editor_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."editor_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_list_items" ADD CONSTRAINT "editor_list_items_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_lists" ADD CONSTRAINT "editor_lists_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_reviews" ADD CONSTRAINT "editor_reviews_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_reviews" ADD CONSTRAINT "editor_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
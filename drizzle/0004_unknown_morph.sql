CREATE TYPE "public"."library_status" AS ENUM('watchlist', 'watching', 'completed');--> statement-breakpoint
CREATE TABLE "user_title_states" (
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"status" "library_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_title_states_user_id_title_id_pk" PRIMARY KEY("user_id","title_id")
);
--> statement-breakpoint
ALTER TABLE "user_title_states" ADD CONSTRAINT "user_title_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_title_states" ADD CONSTRAINT "user_title_states_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;
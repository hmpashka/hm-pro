CREATE TABLE "concours" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"lieu" text DEFAULT '' NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"objectif_centimes" integer,
	"note" text DEFAULT '' NOT NULL,
	"cree" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vente" (
	"id" serial PRIMARY KEY NOT NULL,
	"concours_id" integer NOT NULL,
	"t" timestamp with time zone DEFAULT now() NOT NULL,
	"moyen" text NOT NULL,
	"centimes" integer NOT NULL,
	"libelle" text DEFAULT '' NOT NULL,
	"ref" text,
	"saisi_par" text
);
--> statement-breakpoint
ALTER TABLE "vente" ADD CONSTRAINT "vente_concours_id_concours_id_fk" FOREIGN KEY ("concours_id") REFERENCES "public"."concours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "concours_debut_idx" ON "concours" USING btree ("debut");--> statement-breakpoint
CREATE INDEX "vente_concours_idx" ON "vente" USING btree ("concours_id","t");--> statement-breakpoint
CREATE UNIQUE INDEX "vente_ref_idx" ON "vente" USING btree ("ref");
CREATE TABLE "projet" (
	"depot" text PRIMARY KEY NOT NULL,
	"statut" text DEFAULT 'en_cours' NOT NULL,
	"priorite" text DEFAULT 'normale' NOT NULL,
	"masque" boolean DEFAULT false NOT NULL,
	"contenu_c" text,
	"maj" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par" text
);

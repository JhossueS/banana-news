CREATE TYPE "public"."especie_mascota" AS ENUM('canina', 'felina', 'aves');--> statement-breakpoint
CREATE TYPE "public"."estado_mascota" AS ENUM('pendiente', 'publicada', 'rechazada', 'adoptada');--> statement-breakpoint
CREATE TABLE "mascotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"especie" "especie_mascota" NOT NULL,
	"sexo" text NOT NULL,
	"nacimiento" date NOT NULL,
	"peso" text,
	"color" text,
	"chip" text,
	"condiciones" text,
	"descripcion" text NOT NULL,
	"situacion" text NOT NULL,
	"ciudad" text NOT NULL,
	"provincia" text NOT NULL,
	"foto_key" text,
	"contacto_nombre" text NOT NULL,
	"contacto_correo" text NOT NULL,
	"contacto_telefono" text,
	"autoriza_publicar" boolean DEFAULT false NOT NULL,
	"estado" "estado_mascota" DEFAULT 'pendiente' NOT NULL,
	"motivo_rechazo" text,
	"revisado_por" text,
	"revisado_en" timestamp with time zone,
	"publicado_en" timestamp with time zone,
	"ip_hash" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mascotas" ADD CONSTRAINT "mascotas_revisado_por_auth_user_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mascotas_slug_idx" ON "mascotas" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "mascotas_estado_idx" ON "mascotas" USING btree ("estado","creado");--> statement-breakpoint
CREATE INDEX "mascotas_listado_idx" ON "mascotas" USING btree ("estado","especie","publicado_en");
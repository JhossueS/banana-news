CREATE TYPE "public"."estado_aporte" AS ENUM('sin-verificar', 'verificado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."estado_mensaje" AS ENUM('nuevo', 'respondido');--> statement-breakpoint
CREATE TYPE "public"."estado_nota" AS ENUM('ultima-hora', 'en-vivo', 'analisis', 'verificado', 'contexto', 'alerta');--> statement-breakpoint
CREATE TYPE "public"."publicacion" AS ENUM('borrador', 'publicada');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'editor', 'moderador');--> statement-breakpoint
CREATE TYPE "public"."seccion" AS ENUM('Ciudad', 'Política', 'Economía', 'Ecuador', 'Ambiente');--> statement-breakpoint
CREATE TYPE "public"."tipo_medio" AS ENUM('imagen', 'video');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denuncias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relato" text NOT NULL,
	"lugar" text NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"provincia" text,
	"adjunto_key" text,
	"anonimo" boolean DEFAULT true NOT NULL,
	"contacto" text,
	"estado" "estado_aporte" DEFAULT 'sin-verificar' NOT NULL,
	"ip_hash" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_medio" NOT NULL,
	"r2_key" text,
	"stream_uid" text,
	"ancho" integer,
	"alto" integer,
	"alt" text DEFAULT '' NOT NULL,
	"credito" text DEFAULT '' NOT NULL,
	"listo" boolean DEFAULT true NOT NULL,
	"subido_por" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"asunto" text NOT NULL,
	"mensaje" text NOT NULL,
	"estado" "estado_mensaje" DEFAULT 'nuevo' NOT NULL,
	"ip_hash" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "noticias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"titulo" text NOT NULL,
	"bajada" text NOT NULL,
	"seccion" "seccion" NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado" timestamp with time zone,
	"autor" text NOT NULL,
	"autor_id" text,
	"lugar" text NOT NULL,
	"imagen_id" uuid,
	"alt" text DEFAULT '' NOT NULL,
	"credito" text DEFAULT '' NOT NULL,
	"claves" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado" "estado_nota",
	"cuerpo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cuerpo_html" text DEFAULT '' NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"provincia" text,
	"ciudad" text,
	"publicacion" "publicacion" DEFAULT 'borrador' NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"clave" text PRIMARY KEY NOT NULL,
	"contador" integer DEFAULT 0 NOT NULL,
	"ventana_hasta" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reportes_mapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titular" text NOT NULL,
	"seccion" text NOT NULL,
	"bajada" text DEFAULT '' NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"provincia" text NOT NULL,
	"canton" text,
	"ciudad" text DEFAULT '' NOT NULL,
	"estado" "estado_aporte" DEFAULT 'sin-verificar' NOT NULL,
	"nota_id" uuid,
	"ip_hash" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"rol" "rol" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medios" ADD CONSTRAINT "medios_subido_por_auth_user_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_autor_id_auth_user_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_imagen_id_medios_id_fk" FOREIGN KEY ("imagen_id") REFERENCES "public"."medios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes_mapa" ADD CONSTRAINT "reportes_mapa_nota_id_noticias_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."noticias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "denuncias_estado_idx" ON "denuncias" USING btree ("estado","creado");--> statement-breakpoint
CREATE INDEX "mensajes_estado_idx" ON "mensajes" USING btree ("estado","creado");--> statement-breakpoint
CREATE UNIQUE INDEX "noticias_slug_idx" ON "noticias" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "noticias_publicadas_idx" ON "noticias" USING btree ("publicacion","fecha");--> statement-breakpoint
CREATE INDEX "reportes_mapa_estado_idx" ON "reportes_mapa" USING btree ("estado","creado");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");
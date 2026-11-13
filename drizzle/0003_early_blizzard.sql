ALTER TABLE "auth"."session" ADD COLUMN "token_sha256" text;--> statement-breakpoint
CREATE FUNCTION "auth"."maintain_session_token_sha256"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $function$ BEGIN NEW.token_sha256 := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(NEW.token, 'UTF8')), 'hex'); RETURN NEW; END $function$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "auth"."maintain_session_token_sha256"() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER "auth_session_token_sha256_trg" BEFORE INSERT OR UPDATE OF "token" ON "auth"."session" FOR EACH ROW EXECUTE FUNCTION "auth"."maintain_session_token_sha256"();--> statement-breakpoint
UPDATE "auth"."session" SET "token_sha256" = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("token", 'UTF8')), 'hex') WHERE "token_sha256" IS DISTINCT FROM pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("token", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "token_sha256" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_session_token_sha256_uq" ON "auth"."session" USING btree ("token_sha256");

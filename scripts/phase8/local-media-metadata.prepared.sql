-- PREPARED ONLY. No apply runner. Requires explicit authorization before application.
BEGIN;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test' OR current_user <> 'phase5_local'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() <> 55441
     OR current_setting('server_version_num')::integer /10000 <> 18
     OR (SELECT array_agg(hash::text ORDER BY created_at) FROM drizzle.__drizzle_migrations) IS DISTINCT FROM ARRAY['201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc', '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc', '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be', '42d90a2e9812f63638359a109a064878bfa1c06444c08c5acbca19698cb9f47f', 'ef5ed1cd7b1acea20a0a25efb664cf1b1119ce141259b0ede082aa15f24c0377', '966d65b038eddfd1f12ceb47e17140e2c4252b848174429e218387070b6dbe14']::text[]
  THEN RAISE EXCEPTION 'Unapproved local target/baseline'; END IF;
  IF to_regprocedure('app_private.current_owner_id()') IS NULL
     OR to_regprocedure('app_private.phase8_media_metadata(text,jsonb)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='media' AND column_name IN ('alt_text','revision'))
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='drckgomz_local_functions' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'Unexpected local function/column/role state'; END IF;
END $guard$;
ALTER TABLE app.media ADD COLUMN alt_text text NOT NULL DEFAULT '', ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE app.media ADD CONSTRAINT phase8_media_metadata_bounds CHECK (length(alt_text)<=500 AND revision>0);
GRANT SELECT (id,caption,title,alt_text,revision) ON app.media TO drckgomz_local_functions;
GRANT UPDATE (caption,title,alt_text,revision) ON app.media TO drckgomz_local_functions;
CREATE POLICY phase8_media_metadata_read ON app.media FOR SELECT TO drckgomz_local_functions
  USING (app_private.current_owner_id() IS NOT NULL);
CREATE POLICY phase8_media_metadata_update ON app.media FOR UPDATE TO drckgomz_local_functions
  USING (app_private.current_owner_id() IS NOT NULL) WITH CHECK (app_private.current_owner_id() IS NOT NULL);
GRANT INSERT (actor_user_id,action,evidence_ref) ON app.security_audit_events TO drckgomz_local_functions;
GRANT CREATE ON SCHEMA app_private TO drckgomz_local_functions;
CREATE FUNCTION app_private.phase8_media_metadata(p_id text,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE v_actor text; v_item app.media%ROWTYPE;
BEGIN
  v_actor:=app_private.current_owner_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  IF p_patch IS NULL THEN
    SELECT id,caption,title,alt_text,revision INTO v_item.id,v_item.caption,v_item.title,v_item.alt_text,v_item.revision FROM app.media WHERE id=p_id;
  ELSE
    IF jsonb_typeof(p_patch)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_patch))<>4
       OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('caption','title','alt_text','expected_revision'))
       OR jsonb_typeof(p_patch->'expected_revision')<>'number' OR (p_patch->>'expected_revision')!~'^[1-9][0-9]*$'
       OR jsonb_typeof(p_patch->'alt_text')<>'string' OR length(p_patch->>'alt_text')>500
       OR jsonb_typeof(p_patch->'caption') NOT IN ('string','null') OR length(p_patch->>'caption')>2000
       OR jsonb_typeof(p_patch->'title') NOT IN ('string','null') OR length(p_patch->>'title')>240
    THEN RAISE EXCEPTION 'Invalid metadata' USING ERRCODE='22023'; END IF;
    SELECT id,caption,title,alt_text,revision INTO v_item.id,v_item.caption,v_item.title,v_item.alt_text,v_item.revision FROM app.media WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('kind','missing'); END IF;
    IF v_item.revision<>(p_patch->>'expected_revision')::integer THEN RETURN jsonb_build_object('kind','conflict'); END IF;
    UPDATE app.media SET caption=p_patch->>'caption', title=p_patch->>'title',alt_text=p_patch->>'alt_text',revision=revision+1 WHERE id=p_id;
    INSERT INTO app.security_audit_events(actor_user_id,action,evidence_ref) VALUES(v_actor,'media_metadata_updated',p_id);
    v_item.caption:=p_patch->>'caption';v_item.title:=p_patch->>'title';v_item.alt_text:=p_patch->>'alt_text';v_item.revision:=v_item.revision+1;
  END IF;
  IF v_item.id IS NULL THEN RETURN jsonb_build_object('kind','missing'); END IF;
  RETURN jsonb_build_object('kind','ok','item',jsonb_build_object('id',v_item.id,'caption',v_item.caption,'title',v_item.title,'alt_text',v_item.alt_text,'revision',v_item.revision));
END $fn$;
ALTER FUNCTION app_private.phase8_media_metadata(text,jsonb) OWNER TO drckgomz_local_functions;
REVOKE CREATE ON SCHEMA app_private FROM drckgomz_local_functions;
REVOKE ALL ON FUNCTION app_private.phase8_media_metadata(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.phase8_media_metadata(text,jsonb) TO drckgomz_local_owner;
COMMIT;

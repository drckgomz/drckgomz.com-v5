-- PREPARED ONLY: no apply runner, no remote target support.
-- Requires review alongside app contracts and synthetic concurrency/RLS tests.
BEGIN;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF current_database()<>'drckgomz_phase5_test' OR current_user<>'phase5_local'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port()<>55441
     OR current_setting('server_version_num')::integer /10000<>18
     OR (SELECT array_agg(hash::text ORDER BY created_at) FROM drizzle.__drizzle_migrations) IS DISTINCT FROM ARRAY['201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc', '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc', '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be', '42d90a2e9812f63638359a109a064878bfa1c06444c08c5acbca19698cb9f47f', 'ef5ed1cd7b1acea20a0a25efb664cf1b1119ce141259b0ede082aa15f24c0377', '966d65b038eddfd1f12ceb47e17140e2c4252b848174429e218387070b6dbe14']::text[]
     OR to_regprocedure('app_private.current_owner_id()') IS NULL
     OR to_regprocedure('app_private.phase8_cms_read(text,text,integer,integer)') IS NOT NULL
     OR to_regprocedure('app_private.phase8_cms_write(text,jsonb)') IS NOT NULL
     OR to_regclass('app.site_configuration') IS NOT NULL
     OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='home_projects' AND column_name='technologies')
     OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='drckgomz_local_functions' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR (SELECT count(*) FROM app.user_roles WHERE role='owner')<>1
  THEN RAISE EXCEPTION 'Local CMS preconditions failed'; END IF;
END $guard$;
CREATE TABLE app.site_configuration(
  key text PRIMARY KEY CHECK(key IN ('appearance','navigation','homepage','settings')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_by text REFERENCES app.user_profiles(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.site_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.site_configuration FORCE ROW LEVEL SECURITY;
CREATE POLICY phase8_config_owner ON app.site_configuration TO drckgomz_local_functions
  USING(app_private.current_owner_id() IS NOT NULL) WITH CHECK(app_private.current_owner_id() IS NOT NULL);
CREATE POLICY phase8_config_public ON app.site_configuration FOR SELECT TO drckgomz_local_content USING(published IS NOT NULL);
GRANT SELECT,INSERT,UPDATE ON app.site_configuration TO drckgomz_local_functions;
GRANT SELECT(key,published) ON app.site_configuration TO drckgomz_local_content;
ALTER TABLE app.home_projects ADD COLUMN technologies jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(technologies)='array' AND jsonb_array_length(technologies)<=30);
ALTER TABLE app.home_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.home_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY phase8_projects_owner ON app.home_projects TO drckgomz_local_functions USING(app_private.current_owner_id() IS NOT NULL) WITH CHECK(app_private.current_owner_id() IS NOT NULL);
CREATE POLICY phase8_projects_public ON app.home_projects FOR SELECT TO drckgomz_local_content USING(publication_state='published' AND visibility='public' AND deleted_at IS NULL AND deletion_date IS NULL);
ALTER TABLE app.home_project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.home_project_media FORCE ROW LEVEL SECURITY;
CREATE POLICY phase8_project_media_owner ON app.home_project_media TO drckgomz_local_functions USING(app_private.current_owner_id() IS NOT NULL) WITH CHECK(app_private.current_owner_id() IS NOT NULL);
CREATE POLICY phase8_project_media_public ON app.home_project_media FOR SELECT TO drckgomz_local_content USING(EXISTS(SELECT 1 FROM app.home_projects p WHERE p.id=project_id AND p.publication_state='published' AND p.visibility='public' AND p.deleted_at IS NULL AND p.deletion_date IS NULL));
GRANT SELECT,INSERT,UPDATE,DELETE ON app.home_projects TO drckgomz_local_functions;
GRANT SELECT,UPDATE(idx) ON app.home_project_media TO drckgomz_local_functions;
GRANT SELECT ON app.home_projects,app.home_project_media TO drckgomz_local_content;
GRANT SELECT(id,email,name,email_verified,created_at) ON auth."user" TO drckgomz_local_functions;
GRANT SELECT ON app.user_profiles TO drckgomz_local_functions;
GRANT SELECT(user_id,role) ON app.user_roles TO drckgomz_local_functions;
GRANT UPDATE(enabled,banned_at,updated_at,version) ON app.user_profiles TO drckgomz_local_functions;
-- No role field can ever be changed into owner by these routines.
GRANT INSERT(user_id,role,granted_by),DELETE ON app.user_roles TO drckgomz_local_functions;
GRANT INSERT(actor_user_id,subject_user_id,action,evidence_ref) ON app.security_audit_events TO drckgomz_local_functions;
GRANT CREATE ON SCHEMA app_private TO drckgomz_local_functions;
CREATE FUNCTION app_private.phase8_cms_read(p_section text,p_id text,p_limit integer,p_offset integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $read$
DECLARE v_items jsonb;v_total bigint;
BEGIN
  IF app_private.current_owner_id() IS NULL THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  IF p_limit NOT BETWEEN 1 AND 50 OR p_offset NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'Invalid pagination'; END IF;
  IF p_section='projects' THEN
    SELECT count(*) INTO v_total FROM app.home_projects WHERE p_id IS NULL OR id=p_id;
    SELECT coalesce(jsonb_agg(item ORDER BY sort_idx,id),'[]'::jsonb) INTO v_items FROM (
      SELECT p.id,p.idx AS sort_idx,jsonb_build_object('id',p.id,'title',p.title,'slug',coalesce(p.slug,''),'excerpt',coalesce(p.excerpt,''),'content',coalesce(p.content,''),'href',coalesce(p.href,''),'idx',p.idx,'publication_state',p.publication_state,'visibility',p.visibility,'technologies',p.technologies,'revision',p.revision,
        'media_ids',coalesce((SELECT jsonb_agg(m.id ORDER BY m.idx,m.id) FROM app.home_project_media m WHERE m.project_id=p.id),'[]'::jsonb),
        'featured_media_id',(SELECT m.id FROM app.home_project_media m WHERE m.project_id=p.id AND m.url=p.image_url ORDER BY m.id LIMIT 1)) AS item
      FROM app.home_projects p WHERE p_id IS NULL OR p.id=p_id ORDER BY p.idx,p.id LIMIT p_limit OFFSET p_offset
    ) q;
  ELSIF p_section='users' THEN
    SELECT count(*) INTO v_total FROM app.user_profiles WHERE p_id IS NULL OR id=p_id;
    SELECT coalesce(jsonb_agg(item ORDER BY id),'[]'::jsonb) INTO v_items FROM (
      SELECT p.id,jsonb_build_object('id',p.id,'email',u.email,'name',u.name,'email_verified',u.email_verified,'is_owner',EXISTS(SELECT 1 FROM app.user_roles r WHERE r.user_id=p.id AND r.role='owner'),
        'roles',coalesce((SELECT jsonb_agg(role ORDER BY role) FROM app.user_roles r WHERE r.user_id=p.id AND r.role IN('content_admin','whitelist_manager')),'[]'::jsonb),
        'enabled',p.enabled,'banned',p.banned_at IS NOT NULL,'revision',p.version) AS item
      FROM app.user_profiles p JOIN auth."user" u ON u.id=p.id WHERE p_id IS NULL OR p.id=p_id ORDER BY p.id LIMIT p_limit OFFSET p_offset
    ) q;
  ELSIF p_section IN('appearance','navigation','homepage','settings') THEN
    SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',key,'data',draft,'published',published,'revision',version)),'[]'::jsonb) INTO v_total,v_items FROM app.site_configuration WHERE key=p_section;
  ELSE RAISE EXCEPTION 'Unknown section'; END IF;
  RETURN jsonb_build_object('kind','ok','items',v_items,'total',v_total);
END $read$;
ALTER FUNCTION app_private.phase8_cms_read(text,text,integer,integer) OWNER TO drckgomz_local_functions;
CREATE FUNCTION app_private.phase8_cms_write(p_section text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $write$
DECLARE v_actor text;v_id text;v_operation text;v_revision integer;v_data jsonb;v_existing integer;v_role text;v_enabled boolean;v_banned boolean;v_media_id text;v_idx integer:=0;v_featured text;v_allowed text[];
BEGIN
  PERFORM pg_advisory_xact_lock(1651279904,1);
  v_actor:=app_private.current_owner_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  v_id:=p_input->>'id';v_operation:=p_input->>'operation';v_data:=p_input->'data';
  IF jsonb_typeof(p_input)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE k NOT IN('id','operation','expected_revision','data','publication'))
     OR v_id IS NULL OR v_id!~'^[A-Za-z0-9_-]{1,128}$' OR v_operation NOT IN('create','update','delete') THEN RAISE EXCEPTION 'Invalid mutation'; END IF;
  IF v_operation<>'create' THEN v_revision:=(p_input->>'expected_revision')::integer;IF v_revision IS NULL OR v_revision<1 THEN RAISE EXCEPTION 'Revision required';END IF;END IF;
  IF p_section='projects' THEN
    SELECT revision INTO v_existing FROM app.home_projects WHERE id=v_id FOR UPDATE;
    IF v_operation='create' AND FOUND THEN RETURN jsonb_build_object('kind','conflict');END IF;
    IF v_operation<>'create' AND NOT FOUND THEN RETURN jsonb_build_object('kind','missing');END IF;
    IF v_operation<>'create' AND v_existing<>v_revision THEN RETURN jsonb_build_object('kind','conflict');END IF;
    IF v_operation='delete' THEN
      IF EXISTS(SELECT 1 FROM app.home_project_media WHERE project_id=v_id) THEN RETURN jsonb_build_object('kind','protected');END IF;
      DELETE FROM app.home_projects WHERE id=v_id;
    ELSE
      IF v_data IS NULL OR jsonb_typeof(v_data) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_data))<>11 OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_data) k WHERE k NOT IN('title','slug','excerpt','content','href','idx','publication_state','visibility','technologies','media_ids','featured_media_id'))
         OR length(v_data->>'title') NOT BETWEEN 1 AND 240 OR (v_data->>'slug')!~'^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_data->>'slug')>240
         OR length(v_data->>'excerpt')>2000 OR length(v_data->>'content')>2000000 OR length(v_data->>'href')>2048
         OR (v_data->>'publication_state') NOT IN('draft','published','archived') OR (v_data->>'visibility') NOT IN('public','private')
         OR jsonb_typeof(v_data->'technologies')<>'array' OR jsonb_array_length(v_data->'technologies')>30
         OR jsonb_typeof(v_data->'media_ids')<>'array' OR jsonb_array_length(v_data->'media_ids')>50
         OR (v_data->>'idx')::integer NOT BETWEEN 0 AND 100000
      THEN RAISE EXCEPTION 'Invalid project';END IF;
      IF v_operation='create' THEN
        INSERT INTO app.home_projects(id,title,slug,excerpt,content,href,idx,publication_state,visibility,technologies) VALUES(v_id,v_data->>'title',v_data->>'slug',v_data->>'excerpt',v_data->>'content',nullif(v_data->>'href',''),(v_data->>'idx')::integer,(v_data->>'publication_state')::public.publication_state,(v_data->>'visibility')::public.content_visibility,v_data->'technologies');
      ELSE
        UPDATE app.home_projects SET title=v_data->>'title',slug=v_data->>'slug',excerpt=v_data->>'excerpt',content=v_data->>'content',href=nullif(v_data->>'href',''),idx=(v_data->>'idx')::integer,publication_state=(v_data->>'publication_state')::public.publication_state,visibility=(v_data->>'visibility')::public.content_visibility,technologies=v_data->'technologies',updated_at=statement_timestamp(),revision=revision+1 WHERE id=v_id;
      END IF;
      -- Only existing gallery rows already bound to this project may be organized.
      FOR v_media_id IN SELECT jsonb_array_elements_text(v_data->'media_ids') LOOP
        IF NOT EXISTS(SELECT 1 FROM app.home_project_media WHERE id=v_media_id AND project_id=v_id) THEN RAISE EXCEPTION 'Unbound gallery media';END IF;
        UPDATE app.home_project_media SET idx=v_idx WHERE id=v_media_id AND project_id=v_id;v_idx:=v_idx+1;
      END LOOP;
      v_featured:=v_data->>'featured_media_id';
      IF v_featured IS NOT NULL AND NOT (v_data->'media_ids') ? v_featured THEN RAISE EXCEPTION 'Featured media must be selected';END IF;
      UPDATE app.home_projects SET image_url=(SELECT url FROM app.home_project_media WHERE id=v_featured AND project_id=v_id AND type='image') WHERE id=v_id;
    END IF;
  ELSIF p_section='users' THEN
    IF v_operation<>'update' OR v_actor=v_id OR EXISTS(SELECT 1 FROM app.user_roles WHERE user_id=v_id AND role='owner') THEN RETURN jsonb_build_object('kind','protected');END IF;
    SELECT version INTO v_existing FROM app.user_profiles WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('kind','missing');END IF;
    IF v_existing<>v_revision THEN RETURN jsonb_build_object('kind','conflict');END IF;
    IF v_data IS NULL OR jsonb_typeof(v_data) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_data))<>3 OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_data) k WHERE k NOT IN('roles','enabled','banned'))
       OR jsonb_typeof(v_data->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(v_data->'roles')>2 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_data->'roles') r WHERE r NOT IN('content_admin','whitelist_manager')) OR (SELECT count(DISTINCT r) FROM jsonb_array_elements_text(v_data->'roles') r)<>jsonb_array_length(v_data->'roles') OR jsonb_typeof(v_data->'enabled')<>'boolean' OR jsonb_typeof(v_data->'banned')<>'boolean'
    THEN RAISE EXCEPTION 'Invalid user access';END IF;
    v_enabled:=(v_data->>'enabled')::boolean;v_banned:=(v_data->>'banned')::boolean;
    IF jsonb_array_length(v_data->'roles')>0 AND NOT EXISTS(SELECT 1 FROM auth."user" WHERE id=v_id AND email_verified) THEN RETURN jsonb_build_object('kind','protected');END IF;
    DELETE FROM app.user_roles WHERE user_id=v_id AND role IN('content_admin','whitelist_manager');
    INSERT INTO app.user_roles(user_id,role,granted_by) SELECT v_id,r,v_actor FROM jsonb_array_elements_text(v_data->'roles') r;
    UPDATE app.user_profiles SET enabled=v_enabled,banned_at=CASE WHEN v_banned THEN coalesce(banned_at,statement_timestamp()) ELSE NULL END,version=version+1,updated_at=statement_timestamp() WHERE id=v_id;
  ELSIF p_section IN('appearance','navigation','homepage','settings') THEN
    IF v_operation<>'update' OR v_id<>p_section OR jsonb_typeof(v_data)<>'object' OR length(v_data::text)>32768 THEN RAISE EXCEPTION 'Invalid configuration';END IF;
    v_allowed:=CASE p_section WHEN 'appearance' THEN ARRAY['light','dark','font','reading_size','mode'] WHEN 'navigation' THEN ARRAY['items'] WHEN 'homepage' THEN ARRAY['title','description','enabled'] ELSE ARRAY['title','description','profile_name','bio','social_links'] END;
    IF (SELECT count(*) FROM jsonb_object_keys(v_data))<>cardinality(v_allowed) OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_data) k WHERE NOT(k=ANY(v_allowed))) THEN RAISE EXCEPTION 'Unsupported configuration field';END IF;
    INSERT INTO app.site_configuration(key) VALUES(p_section) ON CONFLICT(key) DO NOTHING;
    SELECT version INTO v_existing FROM app.site_configuration WHERE key=p_section FOR UPDATE;
    IF v_existing<>v_revision THEN RETURN jsonb_build_object('kind','conflict');END IF;
    UPDATE app.site_configuration SET draft=v_data,published=CASE WHEN p_input->>'publication'='published' THEN v_data ELSE published END,version=version+1,updated_by=v_actor,updated_at=statement_timestamp() WHERE key=p_section;
  ELSE RAISE EXCEPTION 'Unknown section';END IF;
  INSERT INTO app.security_audit_events(actor_user_id,action,evidence_ref) VALUES(v_actor,'cms_'||p_section||'_'||v_operation,v_id);
  RETURN jsonb_build_object('kind','ok');
END $write$;
ALTER FUNCTION app_private.phase8_cms_write(text,jsonb) OWNER TO drckgomz_local_functions;
REVOKE CREATE ON SCHEMA app_private FROM drckgomz_local_functions;
REVOKE ALL ON FUNCTION app_private.phase8_cms_read(text,text,integer,integer),app_private.phase8_cms_write(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.phase8_cms_read(text,text,integer,integer),app_private.phase8_cms_write(text,jsonb) TO drckgomz_local_owner;
COMMIT;

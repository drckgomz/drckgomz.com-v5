-- Disposable local-only integration check. The fixed runner below is pinned
-- to the repository-local PostgreSQL 18 test database and ends with ROLLBACK.
BEGIN;
SET LOCAL statement_timeout = '5s';

DO $test$
DECLARE
  inserted_digest text;
  updated_digest text;
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_setting('server_version_num')::integer / 10000 <> 18 THEN
    RAISE EXCEPTION 'Local session digest smoke test target mismatch';
  END IF;

  INSERT INTO auth."user" (id, name, email, email_verified)
  VALUES ('phase5-synthetic-user', 'Synthetic User', 'phase5-synthetic@example.invalid', true);

  INSERT INTO auth.session (id, expires_at, token, user_id)
  VALUES ('phase5-synthetic-session', statement_timestamp() + interval '1 hour', 'phase5-token-one', 'phase5-synthetic-user');

  SELECT token_sha256 INTO inserted_digest
  FROM auth.session WHERE id = 'phase5-synthetic-session';
  IF inserted_digest IS DISTINCT FROM encode(sha256(convert_to('phase5-token-one', 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Session digest trigger did not populate the expected SHA-256';
  END IF;

  UPDATE auth.session SET token = 'phase5-token-two' WHERE id = 'phase5-synthetic-session';
  SELECT token_sha256 INTO updated_digest
  FROM auth.session WHERE id = 'phase5-synthetic-session';
  IF updated_digest IS DISTINCT FROM encode(sha256(convert_to('phase5-token-two', 'UTF8')), 'hex')
     OR updated_digest = inserted_digest THEN
    RAISE EXCEPTION 'Session digest trigger did not track a token update';
  END IF;
END
$test$;

ROLLBACK;

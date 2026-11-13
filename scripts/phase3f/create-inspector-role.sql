-- PREPARED ONLY. Never run without separate explicit approval.
-- Target must be the verified development branch/database `neondb` only.
-- SQL itself cannot prove a Neon branch ID. Immediately before use, verify in
-- Neon Console that project jolly-poetry-87664309, branch
-- br-nameless-dust-bewpmr4r, and endpoint ep-sparkling-sun-bedq0ozn are mapped
-- together, and execute only in that branch's SQL Editor. A URL alone is not
-- branch attestation. Never run this in production.
-- This deliberately grants no table, sequence, schema, create, or ownership rights.
-- Set the password later with psql's interactive `\password` command; never put
-- a password in this file, shell history, or a tracked file.

BEGIN;

CREATE ROLE drckgomz_inspector
  WITH LOGIN
       NOSUPERUSER
       NOINHERIT
       NOCREATEDB
       NOCREATEROLE
       NOREPLICATION
       NOBYPASSRLS
       CONNECTION LIMIT 2;

GRANT CONNECT ON DATABASE neondb TO drckgomz_inspector;

COMMIT;

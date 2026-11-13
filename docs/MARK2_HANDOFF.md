# Resume on Mark-2

Branch: `feat/cinematic-redesign`. Repository: `https://github.com/drckgomz/drckgomz.com-v5`.

New checkout:

```sh
git clone --branch feat/cinematic-redesign https://github.com/drckgomz/drckgomz.com-v5.git
cd drckgomz.com-v5
pnpm install --frozen-lockfile
```

Existing clean checkout (preserve any local edits first):

```sh
cd /path/to/drckgomz.com-v5
git status --short
git fetch origin
git switch feat/cinematic-redesign
git pull --ff-only origin feat/cinematic-redesign
pnpm install --frozen-lockfile
```

Use Node >=22.12 (Node 24 recommended for the direct TypeScript test commands) and a pnpm installation compatible with the committed lockfile. Read `AGENTS.md`, installed Next.js docs, and `docs/ADMIN_CMS_PROGRESS.md` before changing code.

## Local application and database

`pnpm dev` uses the isolated launcher, binds localhost:3000, and requires PostgreSQL 18 at `127.0.0.1:55441/drckgomz_phase5_test`, distinct local runtime roles, the existing auth/session/RLS functions and a mode-0600 `.artifacts/phase6/local-owner.json` artifact. The artifact contains local authentication material and must be provisioned through an approved secure process, never Git or chat. Its synthetic bootstrap identity is no longer the recovered owner. Owner login/automation needs separately approved credentials or storage state; never bypass auth or transfer ownership to make tests pass.

The database, sessions, ignored credentials/mailbox, historical media files and Phase 9 verification snapshots are **not transferred by Git**. Mark-2 needs separately approved local provisioning or private transfer; do not copy all `.artifacts`, connect to a remote database, import historical data or bootstrap/transfer an owner automatically. Existing asset paths may also require separately supplied ignored media.

On the original computer: the six ledger migrations through `0005_session_digest_adapter_default` and prior local runtime patches are installed. Phase 9 additionally applied only `scripts/phase8/local-post-metadata.prepared.sql` (SHA-256 `ab58ffe081cc41335b791a368967a9a87597213d11add1dd6d397b66e07e37ec`), granting only `UPDATE(excerpt,date)` on `app.posts` to `drckgomz_local_owner`. It has no fabricated Drizzle ledger entry. Verify Mark-2's actual schema/privileges before considering any separately approved application; do not blindly rerun it. The other three Phase 8 candidates remain unapplied and are not approved for activation.

Without a provisioned database, public design preview can use:

```sh
OFFLINE_DESIGN_MODE=1 pnpm exec next dev --hostname 127.0.0.1 --port 3000
```

This preview does not certify CMS persistence. Do not use the historical handoff's offline `pnpm dev` command; the current launcher requires its local setup.

## Safe focused verification

```sh
pnpm exec tsc --noEmit
node --test tests/phase6/*.test.mjs tests/phase8/*.test.cjs
node scripts/phase5/validate-migrations.mjs
pnpm exec eslint src/lib/terminal/safe-command.ts src/components/admin/management src/components/admin/posts/EditPostForm.tsx src/lib/db/repositories/admin-posts.ts
```

Synthetic component browser checks, when Chromium is installed:

```sh
pnpm exec playwright test --config=playwright.phase8.editor.config.ts
```

Do not run `tests/phase6/owner-edit.browser.spec.ts`: it edits historical content. Real owner Phase 8 automation requires an approved private fixture. Legacy broad security/integration failures remain documented; do not weaken their assertions. Remaining CMS blockers are database-side validation/concurrency corrections and security rehearsal before user/project/media/settings activation; post taxonomy, featured-image editing, SEO overrides, slug editing and revision history remain unfinished.

Checkpoint validation passed TypeScript, focused lint, 63 Phase 6/8 tests, two terminal tests and offline migration validation. The separate cinematic-media Node/tsx test has an existing `server-only` module-loading failure; it was reported without modifying tests.

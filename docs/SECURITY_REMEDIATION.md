# Phase 2C security remediation

Date: 2026-11-11. Branch: `feat/cinematic-redesign`. This report supersedes the corresponding behavior in [Phase 2B](AUTHORIZATION_HARDENING.md). Earlier discovery/forensics documents remain historical evidence, not statements about current production. All inspection and tests were local; no provider, database, backup, deployment, commit or push was used for this phase.

## Findings and disposition

| Finding | Implemented boundary and verification | Status |
| --- | --- | --- |
| Stored project HTML injection | `src/lib/content/projectHtml.ts` sanitizes legacy HTML on every server read through `src/lib/projects/public.ts` and public/admin project detail APIs; admin PATCH sanitizes writes too. Both project page aliases use the shared reader. Outside HTML, project link/cover/media URLs reject executable schemes. Actual sanitizer tests cover handlers, scripts, SVG/MathML, entities/control characters, forms, CSS URLs, iframe host/path tricks, malformed HTML, and legitimate formatting/media. | Locally addressed |
| Owner management/recovery | `src/app/api/admin/users/[id]/route.ts` denies self access changes, reserves role/ownership/enabled changes for active owners, rejects contradictory owner/banned/disabled states, supports another active owner restoring an inactive owner, and uses nullable snapshot predicates on updates. UI exposes explicit restoration. Destructive changes to existing owners remain blocked. | Partial: atomic co-owner restriction/revocation requires database work |
| Media confidentiality | Public DTOs gate parents and omit arbitrary metadata; unsafe project URL schemes are suppressed. S3 upload/public URL behavior was audited in code. [Private delivery design](PRIVATE_MEDIA_DELIVERY.md) specifies authorization and signed GETs. Existing public URLs are preserved. | Application discovery controls tested; object confidentiality unverified |
| Blog slug/ID compatibility | `src/lib/blog/read.ts` uses an anchored, regex-escaped, case-insensitive slug match; ID fallback is allowed only for slugless records. Status/deletion/profile checks apply to both paths. Tests include literal `%`, `_`, `*`, regex syntax, Unicode, duplicate case variants, private grants and deleted content. | Locally addressed |
| Nullable account flags | Null ownership/whitelist/role conveys no privilege. Access still requires explicit enabled=true and banned=false. Target updates compare null with SQL IS NULL, avoiding false conflicts. Unknown target privileges remain protected from ordinary admins. | Locally addressed |
| Project pagination | `src/app/api/home/projects/route.ts` filters public status in SQL, orders by idx then id, and fetches at most limit+1 candidates (limit 1–50). Optional deletion markers are checked before DTOs. HomeGrid consumes hasMore and aborts stale requests. 1,500-record shuffled fixtures verify ordering, bounds and visibility. | Bounded query addressed; exact deletion-aware totals depend on verified schema |

## HTML policy and dependency decision

The server-only sanitizer uses pinned `sanitize-html` 2.18.1 and types 2.16.2. The [maintained upstream package](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html) supports a parser-based allowlist, rather than regex HTML stripping. Its Node minimum is 22.12.0; package engines now declare that prerequisite. Local checks used Node 24.21.0. Hosting runtime compatibility is a prerequisite before any later rollout.

Formatting, lists, tables, figures, images, audio/video and narrowly allowed classes/styles survive. Forms, scripts, handlers, SVG/MathML, arbitrary CSS, DOM-clobbering names/IDs and unsafe schemes do not. Iframes are restricted to HTTPS YouTube embed paths on two explicit hosts, with fixed sandbox/referrer attributes. Third-party embeds and remote images still have privacy/tracking implications. Arbitrary embed support is intentionally narrower; visually review legitimate legacy content with sanitized fixtures before release.

A related owner-browser sink was found during review: the shared blog editor initializes contentEditable with stored HTML. `src/lib/admin/getAdminPost.ts` now sanitizes that initial value on the server. `src/lib/content/placeholder.ts` escapes media caption text before the editor's innerHTML replacement, preserving literal dollar replacement characters. Tests exercise both. Public blog rendering retains its existing DOMPurify pipeline; this phase does not claim a comprehensive redesign of blog embeds.

PostgREST ILIKE accepts `*` as a wildcard alias, so merely escaping SQL LIKE `%`/`_` was insufficient for literal compatibility. The SDK's `regexIMatch` uses the documented `imatch` operator with an escaped anchored literal. See [PostgREST filtering](https://docs.postgrest.org/en/stable/references/api/tables_views.html). Mock tests cover application/operator selection; they do not prove deployed collation, PostgREST version, regex performance or indexing. Case-colliding slugs fail closed rather than selecting an arbitrary row.

## Owner invariants and explicit limitation

Only an active owner may promote another explicitly enabled, unbanned account. An ordinary administrator cannot grant roles/ownership, change enabled, edit owners or ambiguous privileged accounts. No account may modify its own access. Owner restoration by another active owner is additive; clearing a ban also clears its timestamp/reason. Conditional writes compare role, ownership, whitelist, enabled and ban snapshots, returning conflict on a changed target.

**Safe restriction of another owner is not implemented**, even when a UI/count might suggest two owners exist. REST count-then-update is not atomic. A future authorized database transaction must serialize owner-changing writers (including promotion, revocation, disabling, banning, deletion and external writers), verify current actor authority inside the transaction, and enforce at least one explicitly enabled, unbanned owner at commit. The locking protocol and real current schema must be reviewed first. No assumed RPC, trigger or migration was added. Target CAS does not prevent actor-revocation races across separate requests or provider-side writers.

If no active owner remains, this application intentionally cannot bootstrap itself. Recovery requires a separately authorized, verified operator procedure and an auditable identity check; no hardcoded identity, backdoor, secret recovery account or Clerk password migration was introduced. Account credential recovery remains Clerk-owned and was not exercised or reconfigured.

## Pagination contract

The response now has `count: null`, `hasMore` and `nextOffset`. HomeGrid no longer expects an exact count. The limit bounds database root rows, not the cardinality of each project's embedded media relation. Private/draft/unpublished status rows are excluded before range. Optional deletion flags are filtered before serialization without assuming production columns exist.

A page may be short/empty if candidates are soft-deleted. `hasMore` describes additional public-status candidates, so it is conservative and can reveal candidate existence, not their content or an exact visible count. Concurrent reorder/edit operations may shift offset pages. Verified schema-specific deletion predicates, child projection optimization and cursor pagination belong in a subsequent approved phase. Do not reintroduce whole-catalog scanning to obtain a total.

## Validation and second adversarial review

Run:

```sh
npm run test:security
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint src tests
npm run lint
```

- Security suite: **127 passed, 0 failed** (73 original authorization tests plus remediation coverage). Uses real TS handlers/readers/guards, real sanitize-html and invented in-memory identities/content. Closed provider mocks reject unexpected imports/network. Owner concurrency tests simulate target snapshot changes, not a database transaction.
- TypeScript: passed, no emit/incremental writes.
- Focused lint: **184 pre-existing errors, 11 warnings; zero new diagnostics** compared with the Phase 2C pre-edit snapshot by file/rule/message/severity. Existing debt is not suppressed.
- Full repository lint: **184 errors, 12 warnings**, including the existing postcss unused-import warning; exit 1 from existing debt.
- pnpm frozen installation/lock validation succeeded with install scripts disabled. New sanitizer dependency closure was added without upgrading unrelated resolutions. Existing package-lock.json was already stale and remains unchanged; npm ci is not certified. Use the verified pnpm lock for reproducibility until package-manager consolidation is separately reviewed.
- No provider integration, browser execution, production RLS/cache probes or Next build using configured credentials was run. These tests cannot certify S3 privacy, hosted Clerk recovery, deployed runtime, layout fidelity or real database constraints.

The second code review traced both project rendering aliases, HTML write/read/editor sinks, profile privilege transitions, ID/slug paths, media serialization and pagination query bounds. It found and corrected PostgREST asterisk interpretation, the shared editor caption/initial-HTML sinks and unhandled/stale project fetches. Confirmed residual risks: public objects and caches; atomic owner operations; actor-check/write races; schema-dependent deletion predicates; upload MIME/size/content validation; direct Supabase RLS/grants; existing Next/React patch debt; third-party embed privacy. No new confidentiality guarantee is asserted.

## Release dependencies and next decisions

1. Review sanitized legacy formatting and ID/slug compatibility using nonprivate fixtures.
2. Approve a separate verified-schema transaction design for owner restriction/recovery and a documented operator recovery procedure.
3. Authorize a future provider-side private object inventory/policy/cache assessment before private delivery implementation. Never sign a publicly readable object and call it confidential.
4. Confirm Node >=22.12.0, one authoritative package manager and framework security patching before release.
5. Complete isolated browser/Next integration and accessible UI checks without production credentials. Redesign preparation is documented separately; no homepage replacement is included here.

## Phase 2C file manifest

Relative to the pre-remediation working-tree snapshot (not the branch HEAD, which also includes earlier Phase 2B work):

- `docs/AUTHORIZATION_HARDENING.md`
- `docs/CINEMATIC_DESIGN_SPEC.md`
- `docs/CINEMATIC_IMPLEMENTATION_PLAN.md`
- `docs/DESIGN_SYSTEM_SPEC.md`
- `docs/PRIVATE_MEDIA_DELIVERY.md`
- `docs/SECURITY_REMEDIATION.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/app/admin/projects/[id]/project-editor-page-client.tsx`
- `src/app/admin/users/UsersTable.tsx`
- `src/app/admin/users/types.ts`
- `src/app/api/admin/projects/[id]/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/home/projects/[id]/media/route.ts`
- `src/app/api/home/projects/[id]/route.ts`
- `src/app/api/home/projects/route.ts`
- `src/components/admin/editor/Editor.tsx`
- `src/components/home/sections/project/HomeGrid.tsx`
- `src/lib/admin/getAdminPost.ts`
- `src/lib/blog/read.ts`
- `src/lib/content/placeholder.ts`
- `src/lib/content/projectHtml.ts`
- `src/lib/projects/public.ts`
- `tests/security/authorization.test.cjs`
- `tests/security/harness.cjs`
- `tests/security/remediation.test.cjs`

No commits were created. The pre-existing workspace configuration and earlier discovery/forensics planning documents were preserved. A local sensitive-material pattern scan of changed/untracked text files found no private-key blocks, AWS access-key patterns, Clerk secret-key patterns, SQL password clauses or raw COPY data blocks; this is a targeted check, not a guarantee from a dedicated secret scanner. Final security suite: 127/127 passed; TypeScript exit 0; focused/full lint have no new diagnostics; git diff --check passed.

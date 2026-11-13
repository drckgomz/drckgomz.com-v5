# Clerk / Next.js Server Action Compilation Fix

## Root cause

The installed `@clerk/nextjs` 6.35.6 package declared `keyless-custom-headers.js` as a `"use server"` module while exporting the synchronous `formatMetadataHeaders` helper. Next.js 16 validates exports from server-action modules and rejected that helper with `Server Actions must be async functions.` The local peer metadata allowed Next.js 16, so this was a Clerk package implementation defect, exposed by Next.js's server-action validation. The root layout's direct server import of `ClerkProvider` also crossed the framework's client boundary unnecessarily, but fixing that boundary alone did not remove the package defect.

The upstream fix first appears in the verified `@clerk/nextjs@6.36.3` package archive; 6.36.2 was still reported with the defect. The exact direct dependency is now pinned to `@clerk/nextjs@6.39.8`, the newest 6.x release old enough for pnpm's active 24-hour minimum-release-age gate. Its installed Clerk graph is `@clerk/backend@2.33.8`, `@clerk/clerk-react@5.61.11`, `@clerk/shared@3.48.0`, and `@clerk/types@4.101.28`. The lockfile passed a frozen install with strict minimum-release-age enforcement and no exclusions. Next.js remains 16.4.5. See [Clerk PR #7445](https://github.com/clerk/javascript/pull/7445), [issue #7461](https://github.com/clerk/javascript/issues/7461), and [pnpm's release-age policy](https://pnpm.io/supply-chain-security).

## App boundary changes

- Root layout remains a Server Component and resolves the existing explicit backend configuration there.
- `RootAuthProvider` is a Client Component boundary for the provider UI.
- Clerk's `SignIn` and `SignUp` widgets are isolated in a small Client Component wrapper; their server pages keep backend selection and redirect validation on the server.
- Better Auth remains disabled by the existing configuration default. Clerk/Supabase behavior and authorization policy are unchanged.

## Validation

- Frozen, strict, offline pnpm install with scripts disabled: passed; resolved all five Clerk packages to versions outside the release-age window, with no `minimumReleaseAgeExclude` entries.
- Blocked unreviewed build scripts for `@clerk/shared`, `esbuild`, and `unrs-resolver` are explicitly denied in `pnpm-workspace.yaml`; no dependency lifecycle scripts were executed.
- Isolated optimized compile-only build with synthetic environment and no `.env` files: passed; Next.js compiled the homepage and listed `/` in the route manifest.
- Isolated `pnpm dev` passed the lockfile policy check and started Next.js 16.4.5 with Turbopack without the Server Action error. The synthetic loopback GET timed out (`ETIMEDOUT`) before receiving a response. Therefore HTTP 200 from localhost and Turbopack completion of the homepage request are **not verified**.
- TypeScript: passed.
- Focused ESLint: passed.
- Integration tests: 61 passed.
- Security tests: 224 passed.
- `git diff --check`: passed.
- Full production build: not run because the actual dev homepage HTTP response is still unverified; no real provider or database configuration was used.

## Remaining check

Run `pnpm dev` locally with the existing valid development configuration, then confirm `GET /` returns HTTP 200. Do not infer runtime provider integration from the isolated synthetic compile. This issue did not require a database, auth cutover, or CMS change.

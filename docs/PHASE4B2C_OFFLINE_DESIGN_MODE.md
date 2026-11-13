# Phase 4B.2C — Offline Design Mode

## Purpose

The local public homepage can be reviewed without Clerk or Supabase configuration. This is a design preview, not an authentication simulator or a replacement content backend. Placeholder text is deterministic and visibly labeled; real CMS data and contact details are omitted.

## Start locally

From the repository root, run:

```sh
OFFLINE_DESIGN_MODE=1 pnpm dev
```

The mode is accepted only when `NODE_ENV` is `development`. It is off by default. A malformed value or an attempt to enable it outside development fails closed. No provider keys or fake credentials are needed.

## Route behavior

In offline design mode, middleware allows only `/` and the existing `/terminal` shell. Other application routes—including sign-in/sign-up, blog/journal, admin, all APIs, private content, and CMS mutations—return a generic `404` with `Cache-Control: private, no-store`. The terminal shell remains available as the existing Easter egg, while its command API is blocked.

The root layout skips backend selection and the Clerk/Better Auth provider subtree only after the server validates the explicit development flag. Normal operation keeps the existing Clerk/Supabase defaults and their missing-configuration errors. No private data is rendered by the preview.

## Validation

The isolated smoke runner is `node scripts/clerk-dev-smoke.cjs`. It copies application source to a temporary artifact directory, does not copy environment files, and starts Next with only `OFFLINE_DESIGN_MODE=1` and ordinary local runtime settings. It checks the homepage and protected route statuses. It does not contact providers or use synthetic provider credentials.

Latest local run: homepage `200`; `/admin`, `/blog`, `/api/admin/posts`, `/api/private/journal`, `/api/auth/sign-in`, `/sign-in`, and `/sign-up` each `404`.

## Limits

- This mode intentionally does not validate CMS-backed content rendering, provider authentication, or media delivery.
- Real homepage content still requires the existing Clerk and Supabase configuration.
- Offline mode must not be used to test private access, role behavior, or protected APIs.

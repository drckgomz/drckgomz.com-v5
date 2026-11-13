# Phase 4B.4 — Blog Interaction Audit

## Interaction inventory

| Surface | Behavior | Offline mode |
| --- | --- | --- |
| `drckgomz` brand | Next.js link to `/` | Works; homepage route is allowlisted |
| Header Home link | Next.js link to `/` on every viewport | Works |
| Home page Journal navigation | Opens `/blog`; mobile menu opens, traps focus, closes with Escape, and restores focus | Works |
| Public post cards | Whole card is a semantic link to the post slug, keyboard focusable, Enter activates | Works for local public fixtures |
| Locked private card | Generic private label and access explanation; no title, slug, date, thumbnail, or media link | Explanation is available; no fake sign-up action |
| Sign-in control in header | Opens existing sign-in flow when configured | Disabled with an offline-unavailable tooltip |
| Locked-card sign-up/sign-in links | Existing authentication routes when configured | Omitted because those routes are intentionally blocked offline |
| Article Back to Blog | Semantic Next.js link to `/blog` | Works from direct article entry and click-through |
| Media carousel | Previous/next buttons, swipe, and keyboard arrows when multiple items exist | Works for local supported media; fixture article media uses local assets/placeholders |
| Instagram embeds | Explicit consent button loads the provider script; load failure has status text | No Instagram content exists in fixtures, and no provider request is made |
| Account avatar menu | Sign-in action or authenticated account/admin/settings/sign-out menu | Auth routes are blocked; no synthetic signed-in state is exposed |
| Report a Bug | Opens an accessible dialog; submits only when the existing reporting endpoint is configured | Dialog explains unavailability; text area and submit action are disabled |
| Footer social links | Opens the existing external social destinations | Hidden to keep offline review free of external requests |
| Draft/archive/private article URLs | Server route and APIs apply existing status/permission rules | Unknown/private routes are denied by the offline allowlist |

## Defects found and repaired

- The brand control was a button routing to `/blog`; it now links to `/`.
- There was no explicit Home control in the blog header; a visible, keyboard-focusable Home link now routes to `/`.
- Footer social visibility checked a legacy route pattern; it now detects `/blog` and `/blog/*` in configured mode.
- The bug-report control could open a form that could only fail when no endpoint was configured. It now opens an accessible Radix dialog, clearly reports unavailable state, disables submission when offline or unconfigured, and reports generic success/failure inline when configured.
- The previous browser smoke script only checked route statuses and article view. It now clicks through logo/Home/Journal, exercises the responsive menu, activates a post card with the keyboard, returns to the index, and opens/closes the bug-report dialog at each requested viewport.

## Security and unavailable behavior

No authentication or database boundary changed. Public and private post authorization remains server-side; a locked card receives only a generic teaser boolean. Offline sign-in/sign-up, bug submission, social links, and provider embeds do not contact providers. These actions either show a clear unavailable state or are hidden when they would require external traffic. No fake session is created.

Configured authentication, real bug-report submission, and authorized private-media playback still require their respective services; they were not contacted or tested in this offline review.

## Local verification

Run `OFFLINE_DESIGN_MODE=1 pnpm dev` to preview manually. For the isolated interaction run (which starts its own clean development server), run `node scripts/clerk-dev-smoke.cjs`. It captures index and article screenshots at 390, 768, and 1440 pixel widths under a unique `.artifacts/clerk-dev-smoke/blog-viewports-*` directory and rejects external browser requests.

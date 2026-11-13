# Privacy-conscious analytics proposal

Planning and synthetic examples only. No analytics dependency, endpoint, cookie, collector, network beacon, visitor tracking or production provider is enabled.

## Proposed measurements

| Event | Minimal allowlisted fields | Purpose |
| --- | --- | --- |
| page_view | route_template, coarse_device, day_bucket | Aggregate traffic; never full private path/slug/query/referrer |
| reading_bucket | route_template, progress_bucket 25/50/75/100, active_time_bucket | Approximate reading; count visible/active time only, no mouse/keystroke recording |
| performance_bucket | route_template, metric LCP/INP/CLS, coarse numeric bucket, coarse_device | Aggregate experience; do not attach session/user identifiers |
| publish_operation | operation draft_save/publish/archive, outcome success/conflict/error, duration_bucket | Publishing reliability; operational log, segregated from visitor analytics |

Synthetic example: {"event":"reading_bucket","route_template":"/blog/[slug]","progress_bucket":50,"active_time_bucket":"30-60s","coarse_device":"mobile","synthetic":true}. Synthetic publishing example: {"event":"publish_operation","operation":"draft_save","outcome":"conflict","duration_bucket":"under-1s","synthetic":true}. These are examples, not emitted events.

## Privacy contract

No account IDs, emails, IP retention, exact user-agent, fingerprint, precise location, full URLs, titles, content, search terms, clipboard/text input, signed object URLs, tokens or ban reasons. Avoid persistent visitor IDs; aggregate counts will not equal unique people. Keep private/draft routes out of visitor reports (at most a generic protected-route bucket after approved policy). Do not mix admin operational audit requirements with anonymous reading metrics. A future security audit log requires an approved restricted identity/retention design.

Proposed retention: raw sanitized anonymous event buffer <=7 days, aggregates <=90 days, suppress low-volume dimensions and expose only to authorized admins. These are decisions requiring approval, not current behavior. Reverse proxy/provider access logs may independently collect IPs; verify before claiming anonymity. Handle DNT/GPC and consent preferences as opt-out by default; never infer consent from login. Reading time is noisy and should not be represented as proof of comprehension.

Before enabling: approve lawful purpose/consent, retention, host/location, sampling, public privacy notice and cost; review collector schema/rate limits/bot filtering/redaction; use synthetic-only tests; verify no transmission before consent and no protected data leakage. Do not enable production tracking as an incidental CMS feature.

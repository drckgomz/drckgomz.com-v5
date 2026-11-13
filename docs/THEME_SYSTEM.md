# Theme system: Phase 3B

Canonical editable text configuration: **src/styles/themes.css**. It contains semantic color palettes plus typography, reading size/leading/measure, spacing rhythm/gutter, borders, radii, focus, shadow and motion tokens. Tailwind/shadcn mapping stays in globals.css; responsive content styles consume the tokens in src/styles/blog.css. Do not duplicate a JSON palette or override colors per component to change a theme.

Scopes: public, blog, admin, projects and terminal, identified by data-theme-scope. data-theme=light/dark selects explicit variants; .dark compatibility remains. Public/blog/admin/terminal retain dark defaults; projects inherit the public palette with an explicit scope. Terminal retains prompt green/mono identity; zoom is no longer explicitly disabled. Scope labels do not promise every legacy literal color or fixed layout has been migrated.

Edit tokens in the appropriate CSS palette, for example --background, --foreground, --primary/--primary-foreground, --muted/--muted-foreground, --border, --ring, --radius and --shadow-raised. Paired foreground/background values must be reviewed together. Reading rhythm uses --text-reading, --leading-reading and --space-content; font families have system fallbacks instead of assuming Geist is loaded. New tokens such as --measure-reading and --motion-standard are a shared contract for incremental adoption, not a claim that every component consumes them.

Publishing/list controls and status badges use semantic colors; state labels carry meaning independently from color. Gallery arrows have a solid backing; gallery status uses semantic foreground/background; automatic advancement is disabled and reduced-motion removes transitions. Prior light/dark article/form contrast results are historical; new list/gallery states await browser execution. No numerical contrast compliance claim is made without measuring the actual changed states.

Future admin editing must use a bounded, versioned allowlist of presets/scopes/variants and numeric ranges, server permission checks, draft preview, explicit publish and rollback. Never accept arbitrary CSS/HTML/JavaScript, remote font URLs, url() expressions or Tailwind strings from database settings. Check WCAG contrast, focus, forced colors, zoom and nested scopes before publishing presets. No theme persistence schema or admin theme editor was added.

No cinematic homepage redesign is included. Existing globals/discovery documents are historical; this document describes the current configuration source and incomplete adoption explicitly.

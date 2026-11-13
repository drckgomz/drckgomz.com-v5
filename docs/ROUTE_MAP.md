# Route and component map

Date: 2026-11-11. Complete filesystem inventory of implemented App Router pages and route handlers in this checkout. No runtime or production requests performed. Paths are relative to repository root; route groups do not create URL segments.

## Pages

| URL | Source | Guard | Function |
| --- | --- | --- | --- |
| `/blog/[slug]` | [src/app/(protected)/blog/[slug]/page.tsx](<../src/app/(protected)/blog/[slug]/page.tsx>) | Clerk middleware + requireUserProfile layout | BlogView client; fetches first 25 list rows rather than slug API. |
| `/blog` | [src/app/(protected)/blog/page.tsx](<../src/app/(protected)/blog/page.tsx>) | Clerk middleware + requireUserProfile layout | Blog index; currentUser welcome and AllPostsGrid. |
| `/[slug]` | [src/app/[slug]/page.tsx](../src/app/[slug]/page.tsx) | Public; anonymous Supabase/RLS | Legacy project slug/ID detail; synchronous params; no explicit public-status check. |
| `/admin` | [src/app/admin/page.tsx](../src/app/admin/page.tsx) | Middleware + profile/requireAdmin | Admin menu; role admin required to show controls; non-admin receives in-page 403 text. |
| `/admin/posts/[slug]` | [src/app/admin/posts/[slug]/page.tsx](../src/app/admin/posts/[slug]/page.tsx) | Middleware + lib/admin/requireAdmin | Server initial post/media read then edit/upload/link/reorder/delete UI. |
| `/admin/posts/new` | [src/app/admin/posts/new/page.tsx](../src/app/admin/posts/new/page.tsx) | Middleware + lib/admin/requireAdmin | Create post form, custom HTML editor and status/date/slug fields. |
| `/admin/posts` | [src/app/admin/posts/page.tsx](../src/app/admin/posts/page.tsx) | Middleware sign-in; APIs enforce admin | Post list/search/status tabs and status/delete actions; no local server admin guard. |
| `/admin/projects/[id]` | [src/app/admin/projects/[id]/page.tsx](../src/app/admin/projects/[id]/page.tsx) | Middleware + lib/admin/requireAdmin | Project editor and project media manager. |
| `/admin/projects` | [src/app/admin/projects/page.tsx](../src/app/admin/projects/page.tsx) | Middleware sign-in; APIs enforce admin | Project list/search/status/delete; New project link has no dedicated create route. |
| `/admin/terminal/commands/[id]` | [src/app/admin/terminal/commands/[id]/page.tsx](../src/app/admin/terminal/commands/[id]/page.tsx) | Middleware + lib/admin/requireAdmin | Command identity/flags/builder/raw actions editor and delete. |
| `/admin/terminal/commands` | [src/app/admin/terminal/commands/page.tsx](../src/app/admin/terminal/commands/page.tsx) | Middleware sign-in; APIs enforce admin | Command list/search/create UI. |
| `/admin/users` | [src/app/admin/users/page.tsx](../src/app/admin/users/page.tsx) | Middleware sign-in; APIs enforce admin | Members table, private grants, roles, bans and owner controls; UI restrictions exceed API restrictions. |
| `/banned` | [src/app/banned/page.tsx](../src/app/banned/page.tsx) | Public | Ban notice and Clerk signout. |
| `/` | [src/app/page.tsx](../src/app/page.tsx) | Public | Section portfolio; dots background, hero/About/projects/experience/skills/contact; resume modal in navigation. |
| `/projects/[slug]` | [src/app/projects/[slug]/page.tsx](../src/app/projects/[slug]/page.tsx) | Public; anonymous Supabase/RLS | Project detail, slug then UUID fallback; no explicit public-status denial; raw HTML. |
| `/settings` | [src/app/settings/page.tsx](../src/app/settings/page.tsx) | Enabled profile via getUserProfile; redirect if missing | Profile name/avatar form; PUT save method absent; ban not checked. |
| `/sign-in/[[...sign-in]]` | [src/app/sign-in/[[...sign-in]]/page.tsx](../src/app/sign-in/[[...sign-in]]/page.tsx) | Public | Clerk SignIn widget catch-all. |
| `/sign-up/[[...sign-up]]` | [src/app/sign-up/[[...sign-up]]/page.tsx](../src/app/sign-up/[[...sign-up]]/page.tsx) | Public | Clerk SignUp widget catch-all; no local profile provisioning receiver. |
| `/terminal` | [src/app/terminal/page.tsx](../src/app/terminal/page.tsx) | Public | TerminalShell, command/media engine, Clerk session UX; admin flag fixed false. |

All pages inherit `src/app/layout.tsx` (ClerkProvider and global CSS). Blog layout calls requireUserProfile and adds Navbar/BlogFooter; admin layout adds shared chrome but **does not authorize**; terminal layout sets title and disables zoom. Blog/admin layouts force dynamic rendering. There are no other layout files. Global favicon is `src/app/favicon.ico`. No custom loading/error/not-found, sitemap/robots, parallel/intercepted routes, server-action files or Pages Router routes were found. Framework default error/not-found behavior is implicit.

## HTTP endpoints

`A` = `requireAdminApi`: current Clerk subject + enabled profile + role exactly admin; no ban check. It is called inside every implemented admin endpoint except the profile stub. `B` = Clerk identity read inside handler, anonymous permitted; profile flags govern only some statuses. Middleware does not protect the `/api/admin` prefix. See the architecture audit for helper differences.

| Path | Methods | Handler | Access / data identity | Behavior |
| --- | --- | --- | --- | --- |
| `/api/admin/media/[mediaId]` | PATCH, DELETE | [src/app/api/admin/media/[mediaId]/route.ts](../src/app/api/admin/media/[mediaId]/route.ts) | A; service-role DB (S3 signer has no data query) | Update blog caption; delete metadata and resequence parent media (no object deletion). |
| `/api/admin/posts/[slug]/media/link` | POST | [src/app/api/admin/posts/[slug]/media/link/route.ts](../src/app/api/admin/posts/[slug]/media/link/route.ts) | A; service-role DB (S3 signer has no data query) | Attach external media URL/caption/type; append idx. |
| `/api/admin/posts/[slug]/media/reorder` | PATCH | [src/app/api/admin/posts/[slug]/media/reorder/route.ts](../src/app/api/admin/posts/[slug]/media/reorder/route.ts) | A; service-role DB (S3 signer has no data query) | Validate/dedupe requested IDs against parent; preserve remaining order; upsert idx. |
| `/api/admin/posts/[slug]/media` | GET | [src/app/api/admin/posts/[slug]/media/route.ts](../src/app/api/admin/posts/[slug]/media/route.ts) | A; service-role DB (S3 signer has no data query) | Get ordered post media with URL normalization. |
| `/api/admin/posts/[slug]/media/upload` | POST | [src/app/api/admin/posts/[slug]/media/upload/route.ts](../src/app/api/admin/posts/[slug]/media/upload/route.ts) | A; service-role DB (S3 signer has no data query) | Multipart image to S3 then insert media key. |
| `/api/admin/posts/[slug]` | GET, PATCH, DELETE | [src/app/api/admin/posts/[slug]/route.ts](../src/app/api/admin/posts/[slug]/route.ts) | A; service-role DB (S3 signer has no data query) | Read/update post; PATCH also creates absent post; delete child rows then post. |
| `/api/admin/posts` | GET, POST | [src/app/api/admin/posts/route.ts](../src/app/api/admin/posts/route.ts) | A; service-role DB (S3 signer has no data query) | List with optional status and nested ordered media; create post. |
| `/api/admin/profile` | GET | [src/app/api/admin/profile/route.ts](../src/app/api/admin/profile/route.ts) | Public stub | Unprotected stub returning profile:null; no data query or JWT verification. |
| `/api/admin/projects/[id]/media/[mediaId]` | PATCH, DELETE | [src/app/api/admin/projects/[id]/media/[mediaId]/route.ts](../src/app/api/admin/projects/[id]/media/[mediaId]/route.ts) | A; service-role DB (S3 signer has no data query) | Update caption/idx/type/url/meta or delete project-scoped media metadata. |
| `/api/admin/projects/[id]/media` | GET, POST | [src/app/api/admin/projects/[id]/media/route.ts](../src/app/api/admin/projects/[id]/media/route.ts) | A; service-role DB (S3 signer has no data query) | Read ordered media; append or delete-and-replace metadata. |
| `/api/admin/projects/[id]` | GET, PATCH, DELETE | [src/app/api/admin/projects/[id]/route.ts](../src/app/api/admin/projects/[id]/route.ts) | A; service-role DB (S3 signer has no data query) | Read/update/delete project, delete child metadata first. |
| `/api/admin/projects` | GET | [src/app/api/admin/projects/route.ts](../src/app/api/admin/projects/route.ts) | A; service-role DB (S3 signer has no data query) | List projects, optional status filter; no POST implementation. |
| `/api/admin/terminal/commands/[id]` | GET, PATCH, DELETE | [src/app/api/admin/terminal/commands/[id]/route.ts](../src/app/api/admin/terminal/commands/[id]/route.ts) | A; service-role DB (S3 signer has no data query) | Read/update/delete command; actions normalized to JSON string. |
| `/api/admin/terminal/commands` | GET, POST | [src/app/api/admin/terminal/commands/route.ts](../src/app/api/admin/terminal/commands/route.ts) | A; service-role DB (S3 signer has no data query) | Paginated command list; create command with stringified actions. |
| `/api/admin/uploads/presign` | POST | [src/app/api/admin/uploads/presign/route.ts](../src/app/api/admin/uploads/presign/route.ts) | A; service-role DB (S3 signer has no data query) | Projects-only five-minute S3 PUT signature; returns URL/key. |
| `/api/admin/users/[id]` | PATCH | [src/app/api/admin/users/[id]/route.ts](../src/app/api/admin/users/[id]/route.ts) | A; service-role DB (S3 signer has no data query) | Patch role/private grant/ban/reason/owner; no owner-only restriction in handler. |
| `/api/admin/users/me` | GET | [src/app/api/admin/users/me/route.ts](../src/app/api/admin/users/me/route.ts) | A; service-role DB (S3 signer has no data query) | Current accepted admin profile with derived is_admin flag. |
| `/api/admin/users` | GET | [src/app/api/admin/users/route.ts](../src/app/api/admin/users/route.ts) | A; service-role DB (S3 signer has no data query) | List user_profiles including grants/bans/roles. |
| `/api/home/projects/[id]/media` | GET | [src/app/api/home/projects/[id]/media/route.ts](../src/app/api/home/projects/[id]/media/route.ts) | Public; anonymous Supabase + public-status predicates | Check parent public then return ordered media. |
| `/api/home/projects/[id]` | GET | [src/app/api/home/projects/[id]/route.ts](../src/app/api/home/projects/[id]/route.ts) | Public; anonymous Supabase + public-status predicates | Read project; explicitly hide nonpublic status. |
| `/api/home/projects` | GET | [src/app/api/home/projects/route.ts](../src/app/api/home/projects/route.ts) | Public; anonymous Supabase + public-status predicates | Public project status filter; offset/limit (max 50), count and thumbnail resolution. |
| `/api/profile` | GET | [src/app/api/profile/route.ts](../src/app/api/profile/route.ts) | Clerk required; enabled profile; service-role DB | Current session profile with enabled filter, null when absent; no PUT. |
| `/api/public/blogs/[slug]` | GET | [src/app/api/public/blogs/[slug]/route.ts](../src/app/api/public/blogs/[slug]/route.ts) | B; service-role DB | Exact slug read; bans return 404; only private status checked, draft/archive leak. |
| `/api/public/blogs` | GET | [src/app/api/public/blogs/route.ts](../src/app/api/public/blogs/route.ts) | B; service-role DB | Viewer flags; status parameter/all handling; 25-row limit, date and nested media ordering. Draft/archive leak; see content audit. |
| `/api/terminal/commands` | GET | [src/app/api/terminal/commands/route.ts](../src/app/api/terminal/commands/route.ts) | Public; service-role DB + enabled/role predicates | Public enabled role=user registry; pagination clamped 1–500. Includes requires_auth action payloads. |

No additional exported HTTP methods or server actions were found. Framework handling of unsupported methods/implicit HEAD/OPTIONS is not a separate business endpoint. Clerk widget subpaths are handled through the sign-in/up catch-all pages, not a local auth API handler.

## Referenced paths without implemented handlers

| Reference | Source / consequence |
| --- | --- |
| `/admin/home`, `/admin/bugs` | Admin menu links; no page or API implementation here |
| `/admin/projects/new` | Project list create link; matches dynamic `[id]` with id=new, so opens edit/fetch behavior rather than a create page; project list API has no POST |
| `/api/profile` PUT | Account settings save; only GET exists |
| `/api/terminal/login` POST | Legacy terminal engine collects email/password and expects token; endpoint absent |
| `/auth?to=…` | IdleLogoutGuard redirect; no dedicated auth page; can fall into root project slug route |
| `/v1/public/bugs/report` | Footer calls configured external backend; not implemented in this repository |
| `/v1/public/terminal/commands` | Optional external registry when NEXT_PUBLIC_API_BASE_URL is configured |

`src/proxy.ts.off` is inactive legacy API rewrite code, not an App Router route and not Clerk protection. Root `/<slug>` may catch missing one-segment paths; it does not establish their intended feature.

## Major component groups

| Group | Files and responsibility |
| --- | --- |
| Home composition | `NavBar` (text/section navigation, mobile menu, resume); `DotsCanvas` background; server/client pairs HeroSection, AboutSection, ExperienceSection, SkillsSection, ContactSection; ResumeModal |
| Projects | ProjectSection → HomeGrid pagination → ProjectTile/TileThumb; useProjectDetail fetches detail/media; ProjectDialogBody and InlineCarousel display story/gallery; lib/types and thumbs share models/thumbnail logic |
| Blog | BlogHeader, AllPostsGrid, BlogView, BlogContent, MediaCarousel/MediaList, BlogFooter, Navbar/NavbarClientShell, avatar server/client, SignInButton, BackButton, AccountSettings, DebugAuthBadge, IdleLogoutGuard |
| Post administration | ManagePostsPage/usePosts/PostRow/StatusBadge; CreatePostForm/EditPostForm; Editor/usePostEditor/useSlug/useMediaOrder/media/MediaList for rich HTML/media authoring |
| User administration | useMembers, UsersTable and types beside route; Clerk token requests and permission toggles |
| Project administration | useProjects/ProjectRow/types; project-editor-page-client; ProjectMediaManager presign/direct PUT and metadata edits |
| Terminal administration | page.client list/create; CommandEditor; HeaderBar, IdentityForm, FlagsRow, CommandBuilder, ActionsJsonEditor; types/utils action conversions |
| Terminal runtime | TerminalShell, TerminalInput/Output, Header, VHSetter/KeyboardInset; useTerminalIO/useCommandEngine/useMedia; engine/schema/mediaController; VideoBackground/HiddenVideo/AudioPlayer and CSS |
| UI primitives | All files in components/ui inventoried below; local shadcn/Radix primitives, not routes or domain access guards |

The exhaustive inventory below includes legacy/possibly unused components; presence is not proof they are mounted. IdleLogoutGuard and DebugAuthBadge have no import callers in this checkout; their behavior is not active. UserAvatar.server and the legacy blog MediaList likewise have no observed import callers.

## Clerk import inventory

- [src/app/(protected)/blog/page.tsx](<../src/app/(protected)/blog/page.tsx>)
- [src/app/admin/users/useMembers.ts](../src/app/admin/users/useMembers.ts)
- [src/app/api/admin/users/me/route.ts](../src/app/api/admin/users/me/route.ts)
- [src/app/api/profile/route.ts](../src/app/api/profile/route.ts)
- [src/app/api/public/blogs/[slug]/route.ts](../src/app/api/public/blogs/[slug]/route.ts)
- [src/app/api/public/blogs/route.ts](../src/app/api/public/blogs/route.ts)
- [src/app/banned/page.tsx](../src/app/banned/page.tsx)
- [src/app/layout.tsx](../src/app/layout.tsx)
- [src/app/sign-in/[[...sign-in]]/page.tsx](../src/app/sign-in/[[...sign-in]]/page.tsx)
- [src/app/sign-up/[[...sign-up]]/page.tsx](../src/app/sign-up/[[...sign-up]]/page.tsx)
- [src/components/admin/posts/usePosts.ts](../src/components/admin/posts/usePosts.ts)
- [src/components/blog/AllPostsGrid.tsx](../src/components/blog/AllPostsGrid.tsx)
- [src/components/blog/BlogView.tsx](../src/components/blog/BlogView.tsx)
- [src/components/blog/DebugAuthBadge.tsx](../src/components/blog/DebugAuthBadge.tsx)
- [src/components/blog/IdleLogoutGuard.tsx](../src/components/blog/IdleLogoutGuard.tsx)
- [src/components/blog/SignInButton.client.tsx](../src/components/blog/SignInButton.client.tsx)
- [src/components/blog/UserAvatar.client.tsx](../src/components/blog/UserAvatar.client.tsx)
- [src/components/terminal/components/TerminalShell.tsx](../src/components/terminal/components/TerminalShell.tsx)
- [src/lib/profile/getUserProfile.ts](../src/lib/profile/getUserProfile.ts)
- [src/lib/profile/requireUser.ts](../src/lib/profile/requireUser.ts)
- [src/middleware.ts](../src/middleware.ts)

## Component and supporting-library file inventory

Every component file and supporting application hook/type/library is listed, including route-adjacent admin components. Page/layout/route files are mapped above.

| File | Role |
| --- | --- |
| [src/app/admin/projects/ProjectRow.tsx](../src/app/admin/projects/ProjectRow.tsx) | Admin editing/list component or helper: ProjectRow |
| [src/app/admin/projects/[id]/components/ProjectMediaManager.tsx](../src/app/admin/projects/[id]/components/ProjectMediaManager.tsx) | Admin editing/list component or helper: ProjectMediaManager |
| [src/app/admin/projects/[id]/project-editor-page-client.tsx](../src/app/admin/projects/[id]/project-editor-page-client.tsx) | Admin editing/list component or helper: project-editor-page-client |
| [src/app/admin/projects/types.ts](../src/app/admin/projects/types.ts) | Type/schema contracts |
| [src/app/admin/projects/useProjects.ts](../src/app/admin/projects/useProjects.ts) | State/data hook: useProjects |
| [src/app/admin/terminal/commands/[id]/CommandEditor.tsx](../src/app/admin/terminal/commands/[id]/CommandEditor.tsx) | Terminal presentation or command editor: CommandEditor |
| [src/app/admin/terminal/commands/[id]/components/ActionsJsonEditor.tsx](../src/app/admin/terminal/commands/[id]/components/ActionsJsonEditor.tsx) | Terminal presentation or command editor: ActionsJsonEditor |
| [src/app/admin/terminal/commands/[id]/components/CommandBuilder.tsx](../src/app/admin/terminal/commands/[id]/components/CommandBuilder.tsx) | Terminal presentation or command editor: CommandBuilder |
| [src/app/admin/terminal/commands/[id]/components/FlagsRow.tsx](../src/app/admin/terminal/commands/[id]/components/FlagsRow.tsx) | Terminal presentation or command editor: FlagsRow |
| [src/app/admin/terminal/commands/[id]/components/HeaderBar.tsx](../src/app/admin/terminal/commands/[id]/components/HeaderBar.tsx) | Terminal presentation or command editor: HeaderBar |
| [src/app/admin/terminal/commands/[id]/components/IdentityForm.tsx](../src/app/admin/terminal/commands/[id]/components/IdentityForm.tsx) | Terminal presentation or command editor: IdentityForm |
| [src/app/admin/terminal/commands/[id]/types.ts](../src/app/admin/terminal/commands/[id]/types.ts) | Type/schema contracts |
| [src/app/admin/terminal/commands/[id]/utils.ts](../src/app/admin/terminal/commands/[id]/utils.ts) | Terminal presentation or command editor: utils |
| [src/app/admin/terminal/commands/page.client.tsx](../src/app/admin/terminal/commands/page.client.tsx) | Terminal presentation or command editor: page.client |
| [src/app/admin/users/UsersTable.tsx](../src/app/admin/users/UsersTable.tsx) | Admin editing/list component or helper: UsersTable |
| [src/app/admin/users/types.ts](../src/app/admin/users/types.ts) | Type/schema contracts |
| [src/app/admin/users/useMembers.ts](../src/app/admin/users/useMembers.ts) | State/data hook: useMembers |
| [src/components/admin/editor/Editor.tsx](../src/components/admin/editor/Editor.tsx) | Admin editing/list component or helper: Editor |
| [src/components/admin/editor/MediaList.tsx](../src/components/admin/editor/MediaList.tsx) | Admin editing/list component or helper: MediaList |
| [src/components/admin/editor/media.ts](../src/components/admin/editor/media.ts) | Admin editing/list component or helper: media |
| [src/components/admin/editor/useMediaOrder.ts](../src/components/admin/editor/useMediaOrder.ts) | State/data hook: useMediaOrder |
| [src/components/admin/editor/usePostEditor.ts](../src/components/admin/editor/usePostEditor.ts) | State/data hook: usePostEditor |
| [src/components/admin/editor/useSlug.ts](../src/components/admin/editor/useSlug.ts) | State/data hook: useSlug |
| [src/components/admin/posts/CreatePostForm.tsx](../src/components/admin/posts/CreatePostForm.tsx) | Admin editing/list component or helper: CreatePostForm |
| [src/components/admin/posts/EditPostForm.tsx](../src/components/admin/posts/EditPostForm.tsx) | Admin editing/list component or helper: EditPostForm |
| [src/components/admin/posts/ManagePostsPage.tsx](../src/components/admin/posts/ManagePostsPage.tsx) | Admin editing/list component or helper: ManagePostsPage |
| [src/components/admin/posts/PostRow.tsx](../src/components/admin/posts/PostRow.tsx) | Admin editing/list component or helper: PostRow |
| [src/components/admin/posts/StatusBadge.tsx](../src/components/admin/posts/StatusBadge.tsx) | Admin editing/list component or helper: StatusBadge |
| [src/components/admin/posts/types.ts](../src/components/admin/posts/types.ts) | Type/schema contracts |
| [src/components/admin/posts/usePosts.ts](../src/components/admin/posts/usePosts.ts) | State/data hook: usePosts |
| [src/components/blog/AccountSettings.client.tsx](../src/components/blog/AccountSettings.client.tsx) | Blog/account presentation component: AccountSettings.client |
| [src/components/blog/AllPostsGrid.tsx](../src/components/blog/AllPostsGrid.tsx) | Blog/account presentation component: AllPostsGrid |
| [src/components/blog/BackButton.tsx](../src/components/blog/BackButton.tsx) | Blog/account presentation component: BackButton |
| [src/components/blog/BlogContent.tsx](../src/components/blog/BlogContent.tsx) | Blog/account presentation component: BlogContent |
| [src/components/blog/BlogFooter.tsx](../src/components/blog/BlogFooter.tsx) | Blog/account presentation component: BlogFooter |
| [src/components/blog/BlogHeader.tsx](../src/components/blog/BlogHeader.tsx) | Blog/account presentation component: BlogHeader |
| [src/components/blog/BlogView.tsx](../src/components/blog/BlogView.tsx) | Blog/account presentation component: BlogView |
| [src/components/blog/DebugAuthBadge.tsx](../src/components/blog/DebugAuthBadge.tsx) | Blog/account presentation component: DebugAuthBadge |
| [src/components/blog/IdleLogoutGuard.tsx](../src/components/blog/IdleLogoutGuard.tsx) | Blog/account presentation component: IdleLogoutGuard |
| [src/components/blog/MediaCarousel.tsx](../src/components/blog/MediaCarousel.tsx) | Blog/account presentation component: MediaCarousel |
| [src/components/blog/MediaList.tsx](../src/components/blog/MediaList.tsx) | Blog/account presentation component: MediaList |
| [src/components/blog/Navbar.tsx](../src/components/blog/Navbar.tsx) | Blog/account presentation component: Navbar |
| [src/components/blog/NavbarClientShell.tsx](../src/components/blog/NavbarClientShell.tsx) | Blog/account presentation component: NavbarClientShell |
| [src/components/blog/SignInButton.client.tsx](../src/components/blog/SignInButton.client.tsx) | Blog/account presentation component: SignInButton.client |
| [src/components/blog/UserAvatar.client.tsx](../src/components/blog/UserAvatar.client.tsx) | Blog/account presentation component: UserAvatar.client |
| [src/components/blog/UserAvatar.server.tsx](../src/components/blog/UserAvatar.server.tsx) | Blog/account presentation component: UserAvatar.server |
| [src/components/home/DotsCanvas.tsx](../src/components/home/DotsCanvas.tsx) | Portfolio presentation/data component: DotsCanvas |
| [src/components/home/NavBar.tsx](../src/components/home/NavBar.tsx) | Portfolio presentation/data component: NavBar |
| [src/components/home/sections/about/AboutSection.tsx](../src/components/home/sections/about/AboutSection.tsx) | Portfolio presentation/data component: AboutSection |
| [src/components/home/sections/about/AboutSectionClient.tsx](../src/components/home/sections/about/AboutSectionClient.tsx) | Portfolio presentation/data component: AboutSectionClient |
| [src/components/home/sections/contact/ContactSection.tsx](../src/components/home/sections/contact/ContactSection.tsx) | Portfolio presentation/data component: ContactSection |
| [src/components/home/sections/contact/ContactSectionClient.tsx](../src/components/home/sections/contact/ContactSectionClient.tsx) | Portfolio presentation/data component: ContactSectionClient |
| [src/components/home/sections/experience/ExperienceSection.tsx](../src/components/home/sections/experience/ExperienceSection.tsx) | Portfolio presentation/data component: ExperienceSection |
| [src/components/home/sections/experience/ExperienceSectionClient.tsx](../src/components/home/sections/experience/ExperienceSectionClient.tsx) | Portfolio presentation/data component: ExperienceSectionClient |
| [src/components/home/sections/hero/HeroSection.tsx](../src/components/home/sections/hero/HeroSection.tsx) | Portfolio presentation/data component: HeroSection |
| [src/components/home/sections/hero/HeroSectionClient.tsx](../src/components/home/sections/hero/HeroSectionClient.tsx) | Portfolio presentation/data component: HeroSectionClient |
| [src/components/home/sections/project/HomeGrid.tsx](../src/components/home/sections/project/HomeGrid.tsx) | Portfolio presentation/data component: HomeGrid |
| [src/components/home/sections/project/InlineCarousel.tsx](../src/components/home/sections/project/InlineCarousel.tsx) | Portfolio presentation/data component: InlineCarousel |
| [src/components/home/sections/project/ProjectDialogBody.tsx](../src/components/home/sections/project/ProjectDialogBody.tsx) | Portfolio presentation/data component: ProjectDialogBody |
| [src/components/home/sections/project/ProjectSection.tsx](../src/components/home/sections/project/ProjectSection.tsx) | Portfolio presentation/data component: ProjectSection |
| [src/components/home/sections/project/ProjectTile.tsx](../src/components/home/sections/project/ProjectTile.tsx) | Portfolio presentation/data component: ProjectTile |
| [src/components/home/sections/project/TileThumb.tsx](../src/components/home/sections/project/TileThumb.tsx) | Portfolio presentation/data component: TileThumb |
| [src/components/home/sections/project/lib/thumbs.ts](../src/components/home/sections/project/lib/thumbs.ts) | Portfolio presentation/data component: thumbs |
| [src/components/home/sections/project/lib/types.ts](../src/components/home/sections/project/lib/types.ts) | Type/schema contracts |
| [src/components/home/sections/project/useProjectDetail.ts](../src/components/home/sections/project/useProjectDetail.ts) | State/data hook: useProjectDetail |
| [src/components/home/sections/resume/ResumeModal.tsx](../src/components/home/sections/resume/ResumeModal.tsx) | Portfolio presentation/data component: ResumeModal |
| [src/components/home/sections/skills/SkillsSection.tsx](../src/components/home/sections/skills/SkillsSection.tsx) | Portfolio presentation/data component: SkillsSection |
| [src/components/home/sections/skills/SkillsSectionClient.tsx](../src/components/home/sections/skills/SkillsSectionClient.tsx) | Portfolio presentation/data component: SkillsSectionClient |
| [src/components/terminal/components/AudioPlayer.tsx](../src/components/terminal/components/AudioPlayer.tsx) | Terminal presentation or command editor: AudioPlayer |
| [src/components/terminal/components/Header.tsx](../src/components/terminal/components/Header.tsx) | Terminal presentation or command editor: Header |
| [src/components/terminal/components/HiddenVideo.tsx](../src/components/terminal/components/HiddenVideo.tsx) | Terminal presentation or command editor: HiddenVideo |
| [src/components/terminal/components/KeyboardInset.tsx](../src/components/terminal/components/KeyboardInset.tsx) | Terminal presentation or command editor: KeyboardInset |
| [src/components/terminal/components/TerminalInput.tsx](../src/components/terminal/components/TerminalInput.tsx) | Terminal presentation or command editor: TerminalInput |
| [src/components/terminal/components/TerminalOutput.tsx](../src/components/terminal/components/TerminalOutput.tsx) | Terminal presentation or command editor: TerminalOutput |
| [src/components/terminal/components/TerminalShell.tsx](../src/components/terminal/components/TerminalShell.tsx) | Terminal presentation or command editor: TerminalShell |
| [src/components/terminal/components/VHSetter.tsx](../src/components/terminal/components/VHSetter.tsx) | Terminal presentation or command editor: VHSetter |
| [src/components/terminal/components/VideoBackground.tsx](../src/components/terminal/components/VideoBackground.tsx) | Terminal presentation or command editor: VideoBackground |
| [src/components/terminal/components/audio-player.css](../src/components/terminal/components/audio-player.css) | Media component styling |
| [src/components/terminal/components/hidden-video.css](../src/components/terminal/components/hidden-video.css) | Media component styling |
| [src/components/terminal/hooks/useCommandEngine.ts](../src/components/terminal/hooks/useCommandEngine.ts) | State/data hook: useCommandEngine |
| [src/components/terminal/hooks/useMedia.ts](../src/components/terminal/hooks/useMedia.ts) | State/data hook: useMedia |
| [src/components/terminal/hooks/useTerminalIO.ts](../src/components/terminal/hooks/useTerminalIO.ts) | State/data hook: useTerminalIO |
| [src/components/terminal/lib/engine.ts](../src/components/terminal/lib/engine.ts) | Terminal command/media runtime |
| [src/components/terminal/lib/mediaController.ts](../src/components/terminal/lib/mediaController.ts) | Terminal command/media runtime |
| [src/components/terminal/lib/schema.ts](../src/components/terminal/lib/schema.ts) | Type/schema contracts |
| [src/components/ui/accordion.tsx](../src/components/ui/accordion.tsx) | UI primitive: accordion |
| [src/components/ui/alert-dialog.tsx](../src/components/ui/alert-dialog.tsx) | UI primitive: alert-dialog |
| [src/components/ui/avatar.tsx](../src/components/ui/avatar.tsx) | UI primitive: avatar |
| [src/components/ui/badge.tsx](../src/components/ui/badge.tsx) | UI primitive: badge |
| [src/components/ui/breadcrumb.tsx](../src/components/ui/breadcrumb.tsx) | UI primitive: breadcrumb |
| [src/components/ui/button.tsx](../src/components/ui/button.tsx) | UI primitive: button |
| [src/components/ui/calendar.tsx](../src/components/ui/calendar.tsx) | UI primitive: calendar |
| [src/components/ui/card.tsx](../src/components/ui/card.tsx) | UI primitive: card |
| [src/components/ui/checkbox.tsx](../src/components/ui/checkbox.tsx) | UI primitive: checkbox |
| [src/components/ui/collapsible.tsx](../src/components/ui/collapsible.tsx) | UI primitive: collapsible |
| [src/components/ui/command.tsx](../src/components/ui/command.tsx) | UI primitive: command |
| [src/components/ui/dialog.tsx](../src/components/ui/dialog.tsx) | UI primitive: dialog |
| [src/components/ui/drawer.tsx](../src/components/ui/drawer.tsx) | UI primitive: drawer |
| [src/components/ui/dropdown-menu.tsx](../src/components/ui/dropdown-menu.tsx) | UI primitive: dropdown-menu |
| [src/components/ui/form.tsx](../src/components/ui/form.tsx) | UI primitive: form |
| [src/components/ui/hover-card.tsx](../src/components/ui/hover-card.tsx) | UI primitive: hover-card |
| [src/components/ui/input.tsx](../src/components/ui/input.tsx) | UI primitive: input |
| [src/components/ui/label.tsx](../src/components/ui/label.tsx) | UI primitive: label |
| [src/components/ui/navigation-menu.tsx](../src/components/ui/navigation-menu.tsx) | UI primitive: navigation-menu |
| [src/components/ui/popover.tsx](../src/components/ui/popover.tsx) | UI primitive: popover |
| [src/components/ui/radio-group.tsx](../src/components/ui/radio-group.tsx) | UI primitive: radio-group |
| [src/components/ui/resizable.tsx](../src/components/ui/resizable.tsx) | UI primitive: resizable |
| [src/components/ui/scroll-area.tsx](../src/components/ui/scroll-area.tsx) | UI primitive: scroll-area |
| [src/components/ui/select.tsx](../src/components/ui/select.tsx) | UI primitive: select |
| [src/components/ui/separator.tsx](../src/components/ui/separator.tsx) | UI primitive: separator |
| [src/components/ui/sheet.tsx](../src/components/ui/sheet.tsx) | UI primitive: sheet |
| [src/components/ui/skeleton.tsx](../src/components/ui/skeleton.tsx) | UI primitive: skeleton |
| [src/components/ui/slider.tsx](../src/components/ui/slider.tsx) | UI primitive: slider |
| [src/components/ui/sonner.tsx](../src/components/ui/sonner.tsx) | UI primitive: sonner |
| [src/components/ui/switch.tsx](../src/components/ui/switch.tsx) | UI primitive: switch |
| [src/components/ui/table.tsx](../src/components/ui/table.tsx) | UI primitive: table |
| [src/components/ui/tabs.tsx](../src/components/ui/tabs.tsx) | UI primitive: tabs |
| [src/components/ui/textarea.tsx](../src/components/ui/textarea.tsx) | UI primitive: textarea |
| [src/components/ui/tooltip.tsx](../src/components/ui/tooltip.tsx) | UI primitive: tooltip |
| [src/lib/admin/getAdminPost.ts](../src/lib/admin/getAdminPost.ts) | Admin lookup, model or authorization helper |
| [src/lib/admin/requireAdmin.ts](../src/lib/admin/requireAdmin.ts) | Admin lookup, model or authorization helper |
| [src/lib/admin/requireAdminApi.ts](../src/lib/admin/requireAdminApi.ts) | Admin lookup, model or authorization helper |
| [src/lib/admin/types.ts](../src/lib/admin/types.ts) | Admin lookup, model or authorization helper |
| [src/lib/blog/media.ts](../src/lib/blog/media.ts) | Blog media URL or HTML/embed transformation |
| [src/lib/blog/render.ts](../src/lib/blog/render.ts) | Blog media URL or HTML/embed transformation |
| [src/lib/profile/getUserProfile.ts](../src/lib/profile/getUserProfile.ts) | Profile lookup, model or authorization helper |
| [src/lib/profile/requireAdmin.ts](../src/lib/profile/requireAdmin.ts) | Profile lookup, model or authorization helper |
| [src/lib/profile/requireUser.ts](../src/lib/profile/requireUser.ts) | Profile lookup, model or authorization helper |
| [src/lib/profile/types.ts](../src/lib/profile/types.ts) | Profile lookup, model or authorization helper |
| [src/lib/supabase/admin.server.ts](../src/lib/supabase/admin.server.ts) | Supabase connection/client boundary |
| [src/lib/supabase/browserClient.ts](../src/lib/supabase/browserClient.ts) | Supabase connection/client boundary |
| [src/lib/supabase/client.ts](../src/lib/supabase/client.ts) | Supabase connection/client boundary |
| [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) | Supabase connection/client boundary |
| [src/lib/utils/inactivityWatcher.ts](../src/lib/utils/inactivityWatcher.ts) | Shared utility: inactivityWatcher |
| [src/lib/utils/utils.ts](../src/lib/utils/utils.ts) | Shared utility: utils |

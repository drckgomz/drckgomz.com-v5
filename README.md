# drckgomz.com

## What is this?

This site is meant to be everything **Derick Gomez**.

There are three main areas on the site: **Home (Portfolio Page)**, **Terminal**, and **Blog**. The following sections break down what each area does and why it exists.

---

### Home (Portfolio)

This page shows multiple sections that introduce who I am and what I do.

- **Hero Section** – My name, profile picture, and a small intro.
- **About Section** – A deeper dive into my background and what I’m aiming for.
- **Skills** – A list of the skills I currently have and actively practice.
- **Projects** – Tiles for all my featured projects, each with more info and links to live demos or repos.
- **Experience** – Any previous experience worth showcasing.
- **Resume** – Lets the user view my current resume.
- **Contact** – Allows people to send me a message if they want to reach out.

---

### Terminal

This page is meant to showcase more of my artistic side.  
By running certain commands, the user can watch videos I’ve uploaded, listen to audio I’ve made, view images, or navigate to other pages.

Some common terminal commands are:

- `-h` — View all available commands  
- `Chisholm` — Plays a music video I helped create in 2022  
- `Someone to be` — Instrumental I started in 2023  
- `Remember` — A song I helped produce in 2023  
- `blog` — Navigates to my blog

The terminal is also where users can discover a lot of hidden content, easter eggs, and personal pieces of art I’ve made over the years.

---

### Blog

I built the blog because I wanted more control over what I share publicly and with who.  
It lets me talk about personal events, my real thoughts, and everything behind the scenes in a controlled way.

There’s a full **admin dashboard** behind the blog where I can:

- Manage the entire home / portfolio page  
- Change images and text for each portfolio section  
- Manage projects and project tiles  
- Manage blog posts  
- Manage users and permissions  
- Manage terminal commands  
- Review and respond to bug reports  

This dashboard basically acts as the control panel for the entire site.

---

## Tech Stack  
#### Current Version  
version 5

This version of the site is a complete rebuild using a modern, simple, and scalable setup.  
Here’s the full tech stack powering drckgomz.com v5 — and *why* I chose each piece.

### Frontend

- **Next.js 16 (App Router, Server Components)**  
- **TypeScript**  
- **Tailwind CSS v4**  
- **shadcn/ui** (Radix-powered UI components I fully own in the repo)  
- **Radix UI primitives**  
- **Framer Motion** for animations  
- **lucide-react** for icons  

**Why this frontend stack?**

- Next.js 16 gives me the perfect mix of **static performance** and **server-side capabilities**.  
- Server Components let me fetch data from Supabase without exposing keys.  
- Tailwind + shadcn/ui let me build a custom design system quickly.  
- Framer Motion provides just enough animation to make the site feel alive without hurting performance.

---

### Backend & Data

- **Supabase Postgres** (database)  
- **Supabase Auth** (optional, depending on auth setup)  
- **Supabase Storage or S3** (for images)  
- **Row Level Security (RLS)** for fine-grained access control  

**Why Supabase?**

- It’s managed Postgres with a clean UI, JSONB, policies, and triggers.  
- Fits perfectly with a site that needs editable content, media, users, roles, etc.  
- The blog, home page, terminal commands, and admin features all live in relational tables.  
- Easy to scale without needing Lambda, API Gateway, or tons of AWS glue.

---

### Hosting & Deployment

- **Vercel** — hosts the entire frontend + backend (via Next.js server components and route handlers)
- **GitHub** — repo: `drckgomz/drckgomz.com-v5`
- **AWS Route 53** — domain: `drckgomz.com`, pointed to Vercel

**Why Vercel?**

- Zero-config Next.js hosting  
- Great performance  
- Automatic builds + preview deployments  
- Basically removes the need for AWS Lambda, S3 static hosting, or API Gateway for this project  
- Cheap (or free) for the amount of compute I need

---

### Authentication (Clerk)

I’m using **Clerk** to handle authentication across the site.  
Clerk manages sign-in, sign-up, sessions, and role-based access without me having to build a full auth system from scratch.

**Why Clerk?**

- It’s extremely easy to integrate with Next.js and works perfectly with the App Router.
- Handles all the edge cases: session rotation, multi-device login, email verification, password resets, etc.
- Gives me user management out of the box so I can control who sees what on the blog.
- Lets me define roles like:
  - `user`
  - `admin`
  - `owner`
  - `whitelist_admin`
- Clean UI components (or I can fully customize them if I want).

Clerk fits perfectly with the setup because the **admin dashboard**, **blog permissions**, and **terminal command restrictions** all rely on knowing exactly who the user is and what access they should have. It saves me from writing a bunch of cookie/session/JWT logic and lets me focus on the actual features of the site.

---

### What This Stack Enables

- Fully dynamic portfolio sections powered by Supabase  
- Editable home page (hero, skills, experience, projects)  
- Server-rendered blog pages with static generation  
- Media/gallery support  
- Interactive terminal with custom command behavior  
- Admin dashboard to manage the entire site from one place  

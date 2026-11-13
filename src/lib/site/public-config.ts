/** Nonsecret effective public configuration shared by the site and admin review. */
export const publicSiteMetadata = {
  title: "drckgomz",
  description: "Derick's portfolio + blog + terminal",
} as const;

export const publicNavigation = [
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/travel", label: "Travel" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const publicHero = { title: "drckgomz", video_sources: [] as string[] };

export const publicDestinations = ["/", "/projects", "/blog", "/travel", "/about", "/contact", "/terminal"] as const;

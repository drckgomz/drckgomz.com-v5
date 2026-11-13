import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import Link from "next/link";

import { publicNavigation } from "@/lib/site/public-config";

/** The centered text links are the only controls layered over the home film. */
export default async function NavBar() {
  const { navigation } = await readPublishedConfiguration();
  const items = navigation?.items ?? publicNavigation;
  return (
    <header className="cinematic-nav">
      <nav className="cinematic-nav__links" aria-label="Main navigation">
        {items.map(({ href, label }, index) => (
          <Link key={href} href={href} className="cinematic-nav__link">
            <span className="cinematic-nav__number" aria-hidden="true">0{index + 1}</span>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

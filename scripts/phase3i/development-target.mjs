export const DEVELOPMENT_TARGET = Object.freeze({
  project: "jolly-poetry-87664309",
  branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  role: "neondb_owner",
  major: "18",
});

/** Validate and normalize only the reviewed development PostgreSQL target. */
export function normalizeDevelopmentDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("development URL is invalid");
  }

  let role;
  try {
    role = decodeURIComponent(url.username);
  } catch {
    throw new Error("development URL target does not match the reviewed endpoint");
  }

  if (!(["postgres:", "postgresql:"].includes(url.protocol)
    && url.hostname === DEVELOPMENT_TARGET.hostname
    && (url.port === "" || url.port === "5432")
    && url.pathname === `/${DEVELOPMENT_TARGET.database}`
    && role === DEVELOPMENT_TARGET.role
    && url.password
    && !url.hash)) {
    throw new Error("development URL target does not match the reviewed endpoint");
  }

  url.searchParams.set("sslmode", "require");
  return url.toString();
}

import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { parseAuthConfiguration } from "@/lib/db/config";
import { getAuthDatabase } from "@/lib/db/client";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/lib/db/schema";
import { userProfiles } from "@/lib/db/schema";
import { newPublicMemberProfile } from "@/lib/auth/registration-policy";
import { appendLocalAuthMessage } from "@/lib/auth/local-mailbox";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

function buildAuth(secret: string, baseURL: string, socialProviders: ReturnType<typeof parseAuthConfiguration>["socialProviders"], localDevelopment: boolean) {
  const db = getAuthDatabase();
  const secure = process.env.NODE_ENV === "production";
  const configuredSocialProviders = Object.fromEntries(
    Object.entries(socialProviders).filter((entry) => entry[1] !== undefined),
  );
  return betterAuth({
    appName: "drckgomz.com",
    baseURL,
    basePath: "/api/auth",
    secret,
    // Apple returns the web OAuth response from an Apple origin (form_post).
    // Keep the allowlist narrow and add it only when Apple is configured.
    trustedOrigins: socialProviders.apple
      ? [baseURL, "https://appleid.apple.com"]
      : [baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schemaName: "auth",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Email delivery is implemented only by the explicitly local mailbox.
      // Keep remote registration closed until an approved provider adapter exists.
      disableSignUp: !localDevelopment,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        await appendLocalAuthMessage({ kind: "password-reset", email: user.email, token, createdAt: new Date().toISOString() });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      expiresIn: 60 * 60,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        await appendLocalAuthMessage({ kind: "email-verification", email: user.email, token, createdAt: new Date().toISOString() });
      },
    },
    socialProviders: configuredSocialProviders,
    account: {
      // OAuth access/refresh/ID tokens are encrypted at rest with the Better Auth secret.
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // A newly registered social account is an ordinary public reader.
            // Privileged roles and private-audience grants require separate owner actions.
            await db.insert(userProfiles).values(newPublicMemberProfile(user.id)).onConflictDoNothing();
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: localDevelopment ? 30 : 8 },
        "/sign-up/email": { window: 60, max: localDevelopment ? 10 : 5 },
        "/request-password-reset": { window: 60, max: localDevelopment ? 10 : 5 },
        "/reset-password": { window: 60, max: localDevelopment ? 30 : 8 },
        "/send-verification-email": { window: 60, max: localDevelopment ? 10 : 5 },
      },
    },
    advanced: {
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, secure, sameSite: "lax", path: "/" },
    },
    plugins: [nextCookies()],
  });
}

type BetterAuthInstance = ReturnType<typeof buildAuth>;
let instance: BetterAuthInstance | undefined;

/** Instantiated only on an auth request; empty local environments produce a typed 503. */
export function getBetterAuth(): BetterAuthInstance {
  if (instance) return instance;
  const config = parseAuthConfiguration(process.env);
  instance = buildAuth(config.secret, config.baseURL, config.socialProviders, isLocalPostgresIntegrationEnabled(process.env));
  return instance;
}

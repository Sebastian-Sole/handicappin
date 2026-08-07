/**
 * Test helpers for minting BOTH `/v1` principal classes against a local
 * Supabase stack.
 *
 * Contract §6 states the requirement these exist to make cheap: "**integration
 * tests must cover both principal classes per route**". `/v1` serves two
 * classes with asymmetric RLS treatment — the same route, same code path,
 * same user sees different data depending on whether the token carries
 * `client_id` — so a route tested only with a first-party token is untested
 * on the path that matters (the OAuth one).
 *
 * Wave 2's route suites should import `mintFirstPartyPrincipal` and
 * `mintOAuthPrincipal` and run their assertions twice, once per class.
 *
 * The OAuth flow here is the real authorization-code + PKCE round trip
 * (authorize → consent → approve → token exchange), factored out of
 * `tests/integration/get-connected-entitlement.test.ts`. It is the only way
 * to obtain a token GoTrue stamps with `client_id` and `scope`; there is no
 * shortcut, and faking the claims would test nothing.
 *
 * This file is NOT a test — it matches no `*.test.ts` pattern, so Vitest does
 * not collect it.
 */
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

/**
 * Whether a REAL local stack is configured. Same gate the sibling suites use:
 * these helpers create and delete auth users, so they must never point at a
 * remote project.
 */
export const hasLocalStack =
  (!!databaseUrl?.includes("127.0.0.1") ||
    !!databaseUrl?.includes("localhost")) &&
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!anonKey &&
  !anonKey.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

/** Service-role client — test setup only, never application code. */
export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestPrincipal {
  /** Which `/v1` principal class this token produces. */
  class: "first-party" | "oauth";
  userId: string;
  /** Raw access token for `Authorization: Bearer …`. */
  token: string;
  /** Present only on the OAuth class. */
  clientId?: string;
  /** Tear down the OAuth client (no-op for first-party). */
  cleanup: () => Promise<void>;
}

/** Page size for the admin list scans below. */
const ADMIN_PAGE_SIZE = 1000;

/**
 * Delete an auth user and its OAuth grants, if it exists.
 *
 * `listUsers()` is PAGINATED (50 per page by default) and `auth-js` exposes no
 * email filter, so an unpaged single call silently misses its target the
 * moment a local auth DB has accumulated more than a page of users from
 * earlier crashed runs — cleanup then no-ops, `createUser` fails on the
 * duplicate email, and the suite fails for a reason that has nothing to do
 * with the code under test. Walk every page until `nextPage` runs out.
 */
export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const admin = adminClient();
  const target = email.toLowerCase();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: ADMIN_PAGE_SIZE,
    });
    if (error) {
      throw new Error(`listUsers(page ${page}) failed: ${error.message}`);
    }

    const existing = data.users.find(
      (user) => user.email?.toLowerCase() === target
    );
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id);
      return;
    }

    const nextPage = "nextPage" in data ? data.nextPage : null;
    if (!nextPage) {
      return;
    }
  }
}

/** Prefix every OAuth client these helpers mint carries, so it is sweepable. */
export const OAUTH_TEST_CLIENT_PREFIX = "v1-test-client-";

/**
 * Delete every leftover OAuth test client whose name starts with `prefix`.
 *
 * `mintOAuthPrincipal` returns a `cleanup` closure, but a closure only runs if
 * the process lives long enough to call it: a crash, a timeout kill, or a
 * failing `beforeAll` leaks the client into the local GoTrue forever. Suites
 * call this on setup so a previous run's wreckage cannot accumulate.
 *
 * Best-effort by design — a sweep failure must never fail the suite that was
 * merely being tidy on the way in.
 */
export async function sweepStaleOAuthTestClients(
  prefix: string = OAUTH_TEST_CLIENT_PREFIX
): Promise<number> {
  const admin = adminClient();
  let deleted = 0;

  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.oauth.listClients({
        page,
        perPage: ADMIN_PAGE_SIZE,
      });
      if (error) {
        return deleted;
      }

      for (const client of data.clients) {
        if (client.client_name?.startsWith(prefix)) {
          const { error: deleteError } =
            await admin.auth.admin.oauth.deleteClient(client.client_id);
          if (!deleteError) deleted += 1;
        }
      }

      const nextPage = "nextPage" in data ? data.nextPage : null;
      if (!nextPage) {
        return deleted;
      }
    }
  } catch {
    return deleted;
  }
}

/**
 * Create a confirmed user and sign in, yielding a FIRST-PARTY token: no
 * `client_id` claim, no `scope` claim. `/v1` classifies it first-party and
 * applies no scope check.
 */
export async function mintFirstPartyPrincipal(
  email: string,
  password: string = randomUUID()
): Promise<TestPrincipal & { password: string; userClient: SupabaseClient }> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${email}) failed: ${error?.message}`);
  }

  const userClient = anonClient();
  const { data: signIn, error: signInError } =
    await userClient.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    throw new Error(`sign-in(${email}) failed: ${signInError?.message}`);
  }

  return {
    class: "first-party",
    userId: data.user.id,
    token: signIn.session.access_token,
    password,
    userClient,
    cleanup: async () => {
      await deleteAuthUserByEmail(email);
    },
  };
}

/**
 * Run the OAuth 2.1 authorization-code + PKCE flow for an ALREADY SIGNED-IN
 * user, yielding an OAUTH token carrying `client_id` and `scope`.
 *
 * `userClient` must be the signed-in client returned by
 * `mintFirstPartyPrincipal` — consent is granted as that user.
 *
 * The default `clientName` carries `OAUTH_TEST_CLIENT_PREFIX` so
 * `sweepStaleOAuthTestClients` can reclaim it after a crash. A caller passing
 * its own name should keep that prefix, or accept that a leaked client is
 * unsweepable.
 */
export async function mintOAuthPrincipal(options: {
  userClient: SupabaseClient;
  userId: string;
  clientName?: string;
  redirectUri?: string;
}): Promise<TestPrincipal> {
  const {
    userClient,
    userId,
    clientName = `${OAUTH_TEST_CLIENT_PREFIX}${randomUUID().slice(0, 8)}`,
    redirectUri = "http://localhost:9999/v1-test-callback",
  } = options;

  const admin = adminClient();
  const { data: client, error: clientError } =
    await admin.auth.admin.oauth.createClient({
      client_name: clientName,
      redirect_uris: [redirectUri],
    });
  if (clientError || !client?.client_secret) {
    throw new Error(`oauth createClient failed: ${clientError?.message}`);
  }
  const clientId = client.client_id;

  const cleanup = async () => {
    await admin.auth.admin.oauth.deleteClient(clientId).catch(() => {});
  };

  try {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", "v1-test");

    const authorizeResponse = await fetch(authorizeUrl, {
      redirect: "manual",
      headers: { apikey: anonKey! },
    });
    const consentLocation = authorizeResponse.headers.get("location");
    const authorizationId = consentLocation
      ? new URL(consentLocation).searchParams.get("authorization_id")
      : null;
    if (!authorizationId) {
      throw new Error(
        `authorize did not redirect to consent (status ${authorizeResponse.status})`
      );
    }

    const { error: detailsError } =
      await userClient.auth.oauth.getAuthorizationDetails(authorizationId);
    if (detailsError) {
      throw new Error(
        `getAuthorizationDetails failed: ${detailsError.message}`
      );
    }

    const { data: approval, error: approveError } =
      await userClient.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      });
    if (approveError || !approval) {
      throw new Error(`approveAuthorization failed: ${approveError?.message}`);
    }

    const code = new URL(approval.redirect_url).searchParams.get("code");
    if (!code) {
      throw new Error(`no code in redirect_url: ${approval.redirect_url}`);
    }

    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/oauth/token`, {
      method: "POST",
      headers: {
        apikey: anonKey!,
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${client.client_secret}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokenJson.access_token) {
      throw new Error(`token exchange failed (${tokenResponse.status})`);
    }

    return {
      class: "oauth",
      userId,
      token: tokenJson.access_token,
      clientId,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Decode a token's payload without verifying it — for asserting in tests that
 * a minted token really does (or doesn't) carry `client_id` / `scope`.
 * Production classification uses `@/lib/api/bearer-token`.
 */
export function decodeTokenClaims(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];
  if (!segment) throw new Error("not a JWT");
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf-8"));
}

/**
 * Build a `/v1` Request carrying this principal's token — the shape a route
 * handler receives. Wave 2 route suites use this to drive handlers directly.
 */
export function v1Request(
  principal: TestPrincipal,
  path: string,
  init: RequestInit = {}
): Request {
  return new Request(`https://api.handicappin.com/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      authorization: `Bearer ${principal.token}`,
    },
  });
}

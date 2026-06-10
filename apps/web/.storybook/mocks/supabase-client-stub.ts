/**
 * Browser-Supabase stub for Storybook.
 *
 * `@/utils/supabase/client` exports `createClientComponentClient()` which
 * wraps `@supabase/ssr`'s `createBrowserClient`. Any story whose component
 * tree calls it would hit the network (or crash on missing env). We alias
 * the module in `.storybook/main.ts` so stories get this stub instead.
 *
 * The shape covers the common call sites — `auth.getUser`, `auth.signOut`,
 * `auth.onAuthStateChange`, and the chainable `from(...)` query builder.
 * Anything else falls through to a no-op Proxy. If a story needs richer
 * fixtures, it can wrap the component in MSW or its own decorator.
 */

type FakeUser = {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
};

const FAKE_USER: FakeUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "storybook@example.com",
  user_metadata: { full_name: "Storybook User" },
};

const noopFn = () => undefined;
const noopAsync = async () => undefined;

// Chainable query-builder Proxy. Each accessor returns the same proxy so
// `.from("x").select("*").eq("id", 1).single()` keeps chaining. Terminal
// awaits resolve to a neutral shape — `{ data: null, error: null }`.
function createQueryBuilder(): unknown {
  const terminal = { data: null, error: null };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make the proxy thenable so `await query` resolves to terminal.
        return (resolve: (v: unknown) => void) => resolve(terminal);
      }
      if (prop === "catch" || prop === "finally") return () => proxy;
      if (prop === Symbol.toPrimitive) return () => "";
      return () => proxy;
    },
  };
  const proxy: unknown = new Proxy({}, handler);
  return proxy;
}

const authStub = {
  getUser: async () => ({ data: { user: FAKE_USER }, error: null }),
  getSession: async () => ({
    data: {
      session: {
        user: FAKE_USER,
        access_token: "fake",
        refresh_token: "fake",
        expires_in: 3600,
        token_type: "bearer",
      },
    },
    error: null,
  }),
  signOut: async () => ({ error: null }),
  signInWithPassword: async () => ({
    data: { user: FAKE_USER, session: null },
    error: null,
  }),
  signInWithOAuth: async () => ({ data: { url: "#", provider: "google" }, error: null }),
  signUp: async () => ({ data: { user: FAKE_USER, session: null }, error: null }),
  onAuthStateChange: (_cb: unknown) => ({
    data: { subscription: { unsubscribe: noopFn } },
  }),
  updateUser: async () => ({ data: { user: FAKE_USER }, error: null }),
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  exchangeCodeForSession: async () => ({
    data: { session: null, user: FAKE_USER },
    error: null,
  }),
};

const storageBucketStub = {
  upload: async () => ({ data: { path: "" }, error: null }),
  download: async () => ({ data: null, error: null }),
  remove: async () => ({ data: [], error: null }),
  list: async () => ({ data: [], error: null }),
  getPublicUrl: () => ({ data: { publicUrl: "" } }),
  createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
};

const supabaseClientHandler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    if (prop === "auth") return authStub;
    if (prop === "from") return () => createQueryBuilder();
    if (prop === "rpc") return () => createQueryBuilder();
    if (prop === "storage") return { from: () => storageBucketStub };
    if (prop === "channel")
      return () => ({
        on: () => ({ subscribe: () => ({ unsubscribe: noopFn }) }),
        subscribe: () => ({ unsubscribe: noopFn }),
        unsubscribe: noopFn,
      });
    if (prop === "removeChannel") return noopFn;
    if (prop === "removeAllChannels") return noopFn;
    if (prop === "__esModule") return true;
    return noopAsync;
  },
};

export function createClientComponentClient() {
  return new Proxy({}, supabaseClientHandler);
}

// Some callers may `import client from "@/utils/supabase/client"`.
const defaultExport = { createClientComponentClient };
export default defaultExport;

/**
 * Reusable Storybook decorators for components that need app providers.
 *
 * Usage (per-story, opt-in):
 *
 *   import { withTrpc, withSupabaseAuth, withReactHookForm } from "../../.storybook/decorators";
 *
 *   const meta: Meta<typeof MyComponent> = {
 *     component: MyComponent,
 *     decorators: [withTrpc, withSupabaseAuth()],
 *   };
 *
 * For components that need the full stack, use `allProviders`:
 *
 *   decorators: [allProviders()];
 *
 * --- Notes on auth ---
 * This codebase does NOT expose a React Context for the Supabase session.
 * Components call `createClientComponentClient()` directly inside effects
 * and event handlers, so there is nothing to "wrap" with a Provider.
 *
 * `withSupabaseAuth(userOverride?)` therefore stubs the supabase browser
 * client by overriding `globalThis.fetch` for Supabase auth endpoints
 * AND attaching a `__STORYBOOK_SUPABASE_USER__` global that tests/stories
 * can read. In practice, most stories just need the component to render
 * without crashing — render is synchronous and supabase calls happen in
 * effects, so the decorator's primary job is to ensure the env vars
 * needed by `createBrowserClient` are present.
 */

import * as React from "react";
import type { Decorator } from "@storybook/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// ---------------------------------------------------------------------------
// tRPC + React Query
// ---------------------------------------------------------------------------

/**
 * Create a fresh QueryClient that never retries and never refetches on focus.
 * Queries called inside stories will stay in `isLoading` state, which is
 * usually what we want for visual snapshots.
 */
function createStoryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wraps a story in QueryClientProvider + tRPC react-query provider.
 *
 * We intentionally avoid mounting the project's `<TRPCReactProvider>` because
 * it instantiates an httpBatchStreamLink that fires real network requests on
 * the configured base URL. Stories don't need a working backend — they need
 * the hook tree to not crash.
 *
 * The project's `api` client (from `@/trpc/react`) is a `createTRPCReact`
 * instance; its hooks read from the React Query cache via the
 * QueryClientProvider context plus an `api.Provider`. We provide both with
 * a no-op trpc client so calls return pending state instead of throwing.
 */
function TrpcDecorator({ children }: { children: React.ReactNode }) {
  // Lazily require to avoid pulling tRPC chunks into stories that don't need it.
  const { api } = require("@/trpc/react") as typeof import("@/trpc/react");

  const [queryClient] = React.useState(createStoryQueryClient);
  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
        // A link that resolves with an empty observable; queries stay pending.
        () => () => {
          // Return an observable that never emits — keeps queries in loading state.
          return {
            subscribe() {
              return { unsubscribe() {} };
            },
          } as never;
        },
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}
TrpcDecorator.displayName = "TrpcDecorator";

export const withTrpc: Decorator = (Story) => (
  <TrpcDecorator>
    <Story />
  </TrpcDecorator>
);

// ---------------------------------------------------------------------------
// Supabase Auth
// ---------------------------------------------------------------------------

type FakeUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

const DEFAULT_FAKE_USER: FakeUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "storybook@handicappin.local",
  user_metadata: { full_name: "Storybook User" },
};

/**
 * Stubs the bits of `globalThis` that `createBrowserClient` reads so that
 * components calling `createClientComponentClient()` don't crash on render.
 *
 * The user override is stashed on `globalThis.__STORYBOOK_SUPABASE_USER__`
 * for any story-level code that wants to inspect it. Real Supabase calls
 * inside effects/handlers will still attempt to hit the network — they'll
 * fail silently because `retry: false` is set on the QueryClient.
 */
function SupabaseAuthDecorator({
  user,
  children,
}: {
  user: FakeUser;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    // Ensure env vars used by createBrowserClient are at least defined.
    // Next.js inlines NEXT_PUBLIC_* at build time; if Storybook env isn't
    // set, createBrowserClient will throw on `!` non-null assertions.
    const g = globalThis as Record<string, unknown>;
    g.__STORYBOOK_SUPABASE_USER__ = user;
  }, [user]);

  return <>{children}</>;
}
SupabaseAuthDecorator.displayName = "SupabaseAuthDecorator";

export function withSupabaseAuth(userOverride?: Partial<FakeUser>): Decorator {
  const user: FakeUser = { ...DEFAULT_FAKE_USER, ...userOverride };

  const SupabaseAuthStory: Decorator = function SupabaseAuthStory(Story) {
    return (
      <SupabaseAuthDecorator user={user}>
        <Story />
      </SupabaseAuthDecorator>
    );
  };
  return SupabaseAuthStory;
}

// ---------------------------------------------------------------------------
// Sonner toasts
// ---------------------------------------------------------------------------

/**
 * Mounts sonner's `<Toaster />` alongside the story so `toast.success(...)`
 * calls visibly fire. Falls back to a no-op if `sonner` is not installed —
 * the package is not currently a project dependency, so this decorator is
 * defensive.
 */
function ToasterDecorator({ children }: { children: React.ReactNode }) {
  // Use lazy state so the import only runs in the browser at story render.
  const [Toaster, setToaster] = React.useState<React.ComponentType | null>(
    null
  );

  React.useEffect(() => {
    let mounted = true;
    // Indirect string prevents webpack from statically resolving "sonner"
    // at build time. If sonner is added to the project later, it will load
    // at runtime. Until then this is a no-op.
    const pkg = "sonner";
    (new Function("p", "return import(p)") as (p: string) => Promise<unknown>)(
      pkg
    )
      .then((mod) => {
        const Component = (mod as { Toaster?: React.ComponentType })?.Toaster;
        if (mounted && Component) setToaster(() => Component);
      })
      .catch(() => {
        // sonner not installed or failed to load — render nothing.
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {children}
      {Toaster ? <Toaster /> : null}
    </>
  );
}
ToasterDecorator.displayName = "ToasterDecorator";

export const withToaster: Decorator = (Story) => (
  <ToasterDecorator>
    <Story />
  </ToasterDecorator>
);

// ---------------------------------------------------------------------------
// next-themes
// ---------------------------------------------------------------------------

/**
 * Wraps the story in the project's `next-themes` ThemeProvider so components
 * that call `useTheme()` resolve correctly.
 *
 * The `@storybook/addon-themes` decorator (configured in preview.tsx) already
 * toggles the `dark` class on the html element, which covers Tailwind dark-
 * mode utilities. Use `withNextThemes` only when a component reads from
 * `useTheme()` directly (e.g. to render a theme toggle).
 */
export const withNextThemes: Decorator = (Story) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="light"
    enableSystem={false}
    disableTransitionOnChange
  >
    <Story />
  </NextThemesProvider>
);

// ---------------------------------------------------------------------------
// React Hook Form
// ---------------------------------------------------------------------------

/**
 * Wraps the story in a `FormProvider` so standalone subcomponents that use
 * `useFormContext()` (e.g. fields rendered outside a full form) don't crash.
 *
 * Pass `defaultValues` via the factory to seed the form.
 */
function ReactHookFormDecorator<TValues extends Record<string, unknown>>({
  defaultValues,
  children,
}: {
  defaultValues?: TValues;
  children: React.ReactNode;
}) {
  const methods = useForm<TValues>({
    defaultValues: defaultValues as never,
  }) as UseFormReturn<TValues>;
  return <FormProvider {...methods}>{children}</FormProvider>;
}
ReactHookFormDecorator.displayName = "ReactHookFormDecorator";

export function withReactHookForm<TValues extends Record<string, unknown>>(
  defaultValues?: TValues
): Decorator {
  const ReactHookFormStory: Decorator = function ReactHookFormStory(Story) {
    return (
      <ReactHookFormDecorator<TValues> defaultValues={defaultValues}>
        <Story />
      </ReactHookFormDecorator>
    );
  };
  return ReactHookFormStory;
}

// ---------------------------------------------------------------------------
// Calculator context
// ---------------------------------------------------------------------------

/**
 * Wraps a story in the `CalculatorProvider` so calculator components that call
 * `useCalculatorContext()` don't throw. All calculator components share state
 * via this context (handicap index, course rating, slope, etc.).
 */
export const withCalculatorContext: Decorator = (Story) => {
  const { CalculatorProvider } =
    require("@/contexts/calculatorContext") as typeof import("@/contexts/calculatorContext");
  return (
    <CalculatorProvider>
      <Story />
    </CalculatorProvider>
  );
};

// ---------------------------------------------------------------------------
// All providers (convenience)
// ---------------------------------------------------------------------------

/**
 * Convenience: composes every provider above for heavy components
 * (e.g. `components/scorecard/golf-scorecard.tsx`) that depend on multiple
 * subsystems.
 *
 * Note: decorators run outside-in in the order returned. `allProviders()`
 * returns an array so Storybook applies them in the correct nesting order.
 */
export function allProviders(opts?: {
  user?: Partial<FakeUser>;
}): Decorator[] {
  return [
    withNextThemes,
    withToaster,
    withSupabaseAuth(opts?.user),
    withTrpc,
  ];
}

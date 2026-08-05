import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OAuthConsentCard } from "@/components/auth/oauth-consent-card";
import {
  hasSelectedPlan,
  loginPathForConsent,
  onboardingPathForConsent,
} from "@/lib/oauth/consent-flow";
import { createServerComponentClient } from "@/utils/supabase/server";

/**
 * OAuth 2.1 consent page — the "Connect handicappin" moment (subplan 004).
 *
 * Supabase's OAuth 2.1 authorization server serves NO default consent UI: its
 * authorize endpoint redirects to `{SITE_URL}/oauth/consent?authorization_id=…`
 * and this page must resolve the pending authorization via the supabase-js
 * consent helpers (verified present in pinned 2.95.3 by the 2026-07-28 spike).
 *
 * Flow: fetch authorization details server-side with the cookie session; if
 * GoTrue reports prior consent it returns a redirect URL and we bounce
 * immediately; otherwise the client card renders approve/deny. Connecting
 * clients must NOT request the `openid` scope (HS256 signing cannot mint OIDC
 * ID tokens — spike JWT-signing note).
 *
 * Parity: declared INTENTIONAL.webOnly in scripts/parity/routes.mjs — consent
 * happens in a browser reached via deeplink from the connecting app; a native
 * twin is not applicable.
 */

export const metadata: Metadata = {
  title: "Connect your handicappin account",
  robots: { index: false, follow: false },
};

interface ConsentSearchParams {
  authorization_id?: string;
}

function ConsentShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-md">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children ? <CardContent>{children}</CardContent> : null}
      </Card>
    </main>
  );
}

const OAuthConsentPage = async ({
  searchParams,
}: {
  searchParams: Promise<ConsentSearchParams>;
}) => {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return (
      <ConsentShell
        title="Invalid connection request"
        description="This page is only reachable from an app requesting access to your handicappin account, and the request reference is missing. Please restart the connection from the app that sent you here."
      />
    );
  }

  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // The pending authorization survives server-side, so we thread this
    // consent URL through login (`?redirect=`, open-redirect-guarded by
    // safeInternalPath on the login surfaces) and resume it after sign-in.
    return (
      <ConsentShell
        title="Sign in to continue"
        description="An app is asking to connect to your handicappin account. Sign in and you'll be brought straight back to this request."
      >
        <Button asChild className="w-full">
          <Link href={loginPathForConsent(authorizationId)}>
            Sign in to handicappin
          </Link>
        </Button>
      </ConsentShell>
    );
  }

  // D3 gate: a signed-in but plan-less account must not approve an
  // authorization — any token minted for it could only ever `403
  // plan_required`. Same profile-driven check and onboarding target as the
  // sign-in path (app/auth/callback/route.ts), with this consent URL threaded
  // through the `?redirect=` resume param (guarded by safeInternalPath on the
  // onboarding page). A query error or missing profile row fails closed into
  // onboarding rather than minting a dead-end grant.
  const { data: profileRow } = await supabase
    .from("profile")
    .select("planSelected: plan_selected")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasSelectedPlan(profileRow?.planSelected)) {
    redirect(onboardingPathForConsent(authorizationId));
  }

  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !data) {
    return (
      <ConsentShell
        title="Connection request unavailable"
        description="This connection request has expired or was already handled. Please restart the connection from the app that sent you here."
      />
    );
  }

  // Already consented (or GoTrue resolved the decision) — bounce straight
  // back to the requesting app with the authorization code.
  if (!("authorization_id" in data)) {
    redirect(data.redirect_url);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-md">
      <OAuthConsentCard
        authorizationId={data.authorization_id}
        clientName={data.client.name}
        clientUri={data.client.uri}
        redirectUri={data.redirect_uri}
        userEmail={data.user.email}
      />
    </main>
  );
};

export default OAuthConsentPage;

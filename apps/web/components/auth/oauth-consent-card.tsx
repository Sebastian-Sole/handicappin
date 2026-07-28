"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Muted } from "@/components/ui/typography";
import { createClientComponentClient } from "@/utils/supabase/client";

/**
 * Interactive half of the OAuth 2.1 consent page ("Connect handicappin",
 * subplan 004). The server page resolves the authorization details; this card
 * only carries the approve/deny decision through the supabase-js consent
 * helpers and follows the redirect GoTrue hands back.
 */

interface OAuthConsentCardProps {
  authorizationId: string;
  clientName: string;
  clientUri?: string;
  logoUri?: string;
  /** Space-separated scope list requested by the client (may be empty). */
  scope: string;
  redirectUri: string;
  userEmail: string;
}

/** Human-readable descriptions for the scopes we expect clients to request. */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  profile: "See your basic profile information",
  email: "See your email address",
  "rounds:write": "Log golf rounds on your behalf",
};

function describeScope(scope: string): string {
  return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

export function OAuthConsentCard({
  authorizationId,
  clientName,
  clientUri,
  logoUri,
  scope,
  redirectUri,
  userEmail,
}: OAuthConsentCardProps) {
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scopes = scope.split(" ").filter(Boolean);
  const redirectHost = (() => {
    try {
      return new URL(redirectUri).host;
    } catch {
      return redirectUri;
    }
  })();

  const decide = async (decision: "approve" | "deny") => {
    setPending(decision);
    setErrorMessage(null);
    try {
      const supabase = createClientComponentClient();
      const { data, error } =
        decision === "approve"
          ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
              skipBrowserRedirect: true,
            })
          : await supabase.auth.oauth.denyAuthorization(authorizationId, {
              skipBrowserRedirect: true,
            });
      if (error || !data) {
        setErrorMessage(
          "Something went wrong while handling your decision. Please try again, or restart the connection from the app.",
        );
        setPending(null);
        return;
      }
      window.location.assign(data.redirect_url);
    } catch {
      setErrorMessage(
        "Something went wrong while handling your decision. Please try again, or restart the connection from the app.",
      );
      setPending(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        {logoUri ? (
          // Client-supplied logo URI on an external host; next/image would
          // require whitelisting arbitrary OAuth-client hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUri}
            alt=""
            width={48}
            height={48}
            className="mx-auto mb-sm h-12 w-12 rounded-md object-contain"
          />
        ) : null}
        <CardTitle>Connect {clientName}?</CardTitle>
        <CardDescription>
          <strong>{clientName}</strong>
          {clientUri ? <> ({redirectHost})</> : null} wants to connect to the
          handicappin account for <strong>{userEmail}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Muted>This will allow {clientName} to:</Muted>
        <ul className="mt-sm list-disc space-y-xs pl-lg text-body-sm">
          {scopes.length > 0 ? (
            scopes.map((s) => <li key={s}>{describeScope(s)}</li>)
          ) : (
            <li>Access your handicappin data on your behalf</li>
          )}
        </ul>
        <p className="mt-md text-body-sm text-muted-foreground">
          It will never see your billing details, and you can disconnect it at
          any time. You will be sent back to {redirectHost}.
        </p>
        {errorMessage ? (
          <p role="alert" className="mt-md text-body-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex gap-sm">
        <Button
          variant="outline"
          className="flex-1"
          disabled={pending !== null}
          onClick={() => decide("deny")}
        >
          {pending === "deny" ? "Cancelling…" : "Cancel"}
        </Button>
        <Button
          className="flex-1"
          disabled={pending !== null}
          onClick={() => decide("approve")}
        >
          {pending === "approve" ? "Connecting…" : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );
}

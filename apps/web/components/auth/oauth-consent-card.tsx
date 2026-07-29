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
import { deriveHost } from "@/lib/oauth/consent-flow";
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
  redirectUri: string;
  userEmail: string;
}

/**
 * What a connected app actually gets, kept in LOCKSTEP with enforcement
 * (until Supabase Phase-2 scopes ship, every OAuth grant carries the same
 * capability set, so this list is fixed rather than scope-mapped):
 * - profile basics via get_connected_profile() — RLS denies direct profile
 *   reads/writes, billing tables and email preferences (20260728091000);
 * - the account's email address and basic identity: GoTrue's /auth/v1/user
 *   endpoint (and the token's own claims) necessarily expose these to any
 *   session holder — disclosed here rather than pretended away (see
 *   004-updateuser-decision.md for the accepted GoTrue surface);
 * - round/score INSERT/UPDATE/SELECT — DELETE is RLS-denied.
 * If the policies change, change this copy in the same PR.
 */
const GRANTED_CAPABILITIES = [
  "See your email address and basic account identity",
  "Read your basic profile — your name and handicap index only (never your billing details or email preferences)",
  "Log and update your golf rounds",
];

export function OAuthConsentCard({
  authorizationId,
  clientName,
  clientUri,
  redirectUri,
  userEmail,
}: OAuthConsentCardProps) {
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectHost = deriveHost(redirectUri) ?? redirectUri;
  // The parenthetical next to the client name shows the CLIENT's own site
  // host (not the redirect host — that's a different URL, shown in the
  // "sent back to" line below).
  const clientHost = deriveHost(clientUri);

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
        {/* No client logo: it lives on an external host the CSP img-src
            doesn't allow, so it would never render. */}
        <CardTitle>Connect {clientName}?</CardTitle>
        <CardDescription>
          <strong>{clientName}</strong>
          {clientHost ? <> ({clientHost})</> : null} wants to connect to the
          handicappin account for <strong>{userEmail}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Muted>This will allow {clientName} to:</Muted>
        <ul className="mt-sm list-disc space-y-xs pl-lg text-body-sm">
          {GRANTED_CAPABILITIES.map((capability) => (
            <li key={capability}>{capability}</li>
          ))}
        </ul>
        <p className="mt-md text-body-sm text-muted-foreground">
          It cannot delete your rounds and it never sees your billing
          information. You can disconnect it at any time. You will be sent
          back to {redirectHost}.
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

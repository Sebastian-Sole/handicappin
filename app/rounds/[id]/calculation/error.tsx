"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { H2, Muted } from "@/components/ui/typography";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RoundCalculationError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        component: "RoundCalculationPage",
        error_boundary: "route",
      },
      contexts: {
        nextjs: {
          digest: error.digest,
        },
      },
    });
  }, [error]);

  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <H2>Unable to Load Calculation</H2>
            <Muted className="mt-2">
              We encountered an error while loading your round calculation.
              This has been reported and we&apos;re looking into it.
            </Muted>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-muted-foreground">Error details:</p>
              <p className="mt-1 text-muted-foreground/80 break-words">
                {error.message || "An unexpected error occurred"}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Reference: {error.digest}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} className="w-full sm:w-auto">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/rounds">
                <Home className="mr-2 h-4 w-4" />
                Back to Rounds
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

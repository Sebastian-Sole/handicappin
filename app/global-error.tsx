"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { captureSentryError } from "@/lib/sentry-utils";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureSentryError(error, {
      level: "fatal",
      tags: {
        source: "global-error-boundary",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>An error occurred</title>
      </head>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass0to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
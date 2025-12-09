// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9a6fb68c482da78fb51302d8388950f1@o4510365767303168.ingest.de.sentry.io/4510365768613968",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.2,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Disable automatic PII sending to comply with GDPR
  sendDefaultPii: false,

  // Filter out PII before sending to Sentry
  beforeSend(event) {
    // Remove user IP addresses
    if (event.user) {
      delete event.user.ip_address;
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["Cookie"];
      delete event.request.headers["X-Forwarded-For"];
    }

    return event;
  },

  // Ignore known non-critical errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});

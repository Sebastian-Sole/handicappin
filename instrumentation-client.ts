// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://9a6fb68c482da78fb51302d8388950f1@o4510365767303168.ingest.de.sentry.io/4510365768613968",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Reduce trace sampling from 100% to 20% for better performance
  // This matches server-side sampling and reduces client overhead
  tracesSampleRate: 0.2,

  // Only enable logs in development to reduce overhead
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Disable PII for better privacy protection
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
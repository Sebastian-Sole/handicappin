"use client";

/**
 * Client-Side Logger
 *
 * Security-conscious logging for client components:
 * - Development: Logs to console for debugging
 * - Production: Silent for debug/info, sends errors to Sentry
 *
 * Usage:
 *   import { clientLogger } from "@/lib/client-logger";
 *   clientLogger.debug("Debug info", { data });  // Dev only
 *   clientLogger.info("Info message");           // Dev only
 *   clientLogger.warn("Warning", { context });   // Dev only
 *   clientLogger.error("Error occurred", error); // Dev + Sentry in prod
 */

import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

type LogContext = Record<string, unknown>;

/**
 * Client-side logger that respects environment
 * - Development: Full console output
 * - Production: Errors go to Sentry, everything else is silent
 */
export const clientLogger = {
  /**
   * Debug logging - development only
   * Use for detailed debugging information
   */
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, context ?? "");
    }
  },

  /**
   * Info logging - development only
   * Use for general flow information
   */
  info(message: string, context?: LogContext): void {
    if (isDev) {
      console.info(`[INFO] ${message}`, context ?? "");
    }
  },

  /**
   * Warning logging - development only
   * Use for non-critical issues
   */
  warn(message: string, context?: LogContext): void {
    if (isDev) {
      console.warn(`[WARN] ${message}`, context ?? "");
    }
    // Optionally add Sentry breadcrumb in production
    if (!isDev) {
      Sentry.addBreadcrumb({
        category: "warning",
        message,
        level: "warning",
        data: context,
      });
    }
  },

  /**
   * Error logging - development console + Sentry in production
   * Use for actual errors that need investigation
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (isDev) {
      console.error(`[ERROR] ${message}`, error, context ?? "");
    }

    // Always send errors to Sentry in production
    if (!isDev) {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: { source: "client" },
          extra: { message, ...context },
        });
      } else {
        Sentry.captureMessage(message, {
          level: "error",
          tags: { source: "client" },
          extra: { error, ...context },
        });
      }
    }
  },
};

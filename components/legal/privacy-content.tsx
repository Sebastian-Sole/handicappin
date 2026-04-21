import { H2, H3, P } from "@/components/ui/typography";
import Link from "next/link";

const EFFECTIVE_DATE = "February 11, 2026";

export function PrivacyContent() {
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Effective Date: {EFFECTIVE_DATE}
      </p>

      {/* 1. Introduction */}
      <div className="space-y-3">
        <H2>
          1. Introduction
        </H2>
        <P className="text-foreground/80">
          Handicappin&apos; (&quot;the Service&quot;) is operated by
          SoleInnovations (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          This Privacy Policy describes how we collect, use, store, and share
          your personal information when you use our web-based golf handicap
          tracking application.
        </P>
        <P className="text-foreground/80">
          By using the Service, you consent to the practices described in this
          Privacy Policy. If you do not agree with this policy, please do not use
          the Service.
        </P>
      </div>

      {/* 2. Information We Collect */}
      <div className="space-y-3">
        <H2>
          2. Information We Collect
        </H2>

        <H3 className="mt-4 font-medium">
          2.1 Information You Provide
        </H3>
        <P className="text-foreground/80">
          When you create an account and use the Service, we collect:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Account information:</strong> Email address, name, and
            password (hashed, never stored in plain text).
          </li>
          <li>
            <strong>Golf data:</strong> Round scores (hole-by-hole and totals),
            courses played, tee selections, dates of play, and notes you add to
            rounds.
          </li>
          <li>
            <strong>Profile preferences:</strong> Email notification preferences
            and display settings.
          </li>
          <li>
            <strong>Payment information:</strong> When you subscribe to a paid
            plan, payment details are collected and processed directly by Stripe.
            We do not store your credit card number, CVV, or full payment details
            on our servers. We store only your Stripe customer identifier to
            manage your subscription.
          </li>
        </ul>

        <H3 className="mt-4 font-medium">
          2.2 Information Collected Automatically
        </H3>
        <P className="text-foreground/80">
          When you use the Service, we may automatically collect:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>IP address:</strong> Logged during account security events
            (email changes, verification requests) for fraud prevention. Not used
            for tracking or advertising.
          </li>
          <li>
            <strong>Usage data:</strong> Pages visited, features used, and
            interaction patterns to improve the Service. Collected via Vercel
            Analytics and Sentry error monitoring.
          </li>
          <li>
            <strong>Device information:</strong> Browser type, operating system,
            and screen size to optimize the responsive design.
          </li>
        </ul>

        <H3 className="mt-4 font-medium">
          2.3 Information from Third Parties
        </H3>
        <P className="text-foreground/80">
          If you sign in with Google, we receive your name, email address, and
          email verification status from Google. We do not receive or store your
          Google password.
        </P>
      </div>

      {/* 3. How We Use Your Information */}
      <div className="space-y-3">
        <H2>
          3. How We Use Your Information
        </H2>
        <P className="text-foreground/80">
          We use your information for the following purposes:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Provide the Service:</strong> Calculate your handicap index,
            store your round history, and display your performance analytics.
          </li>
          <li>
            <strong>Account management:</strong> Authenticate your identity,
            manage your subscription, and communicate account updates.
          </li>
          <li>
            <strong>Security:</strong> Detect fraud, prevent unauthorized access,
            and protect your account using IP logging and verification attempt
            tracking.
          </li>
          <li>
            <strong>Improve the Service:</strong> Analyze usage patterns (in
            aggregate) to improve features, fix bugs, and optimize performance.
          </li>
          <li>
            <strong>Communications:</strong> Send transactional emails
            (verification codes, billing confirmations, password resets) and, if
            you opt in, feature update emails.
          </li>
          <li>
            <strong>Legal compliance:</strong> Meet legal obligations, respond to
            lawful requests, and enforce our Terms of Service.
          </li>
        </ul>
        <P className="text-foreground/80">
          We do <strong>not</strong> sell your personal data. We do{" "}
          <strong>not</strong> use your data for targeted advertising.
        </P>
      </div>

      {/* 4. Calculated and Derived Data */}
      <div className="space-y-3">
        <H2>
          4. Calculated and Derived Data
        </H2>
        <P className="text-foreground/80">
          Based on the scores you submit, we calculate and store:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>Handicap index (current and historical values)</li>
          <li>Score differentials for each round</li>
          <li>Adjusted gross scores per USGA guidelines</li>
          <li>Course handicap calculations</li>
          <li>Exceptional score adjustments</li>
        </ul>
        <P className="text-foreground/80">
          This derived data is part of your account and is treated with the same
          privacy protections as information you directly provide.
        </P>
      </div>

      {/* 5. Data Sharing */}
      <div className="space-y-3">
        <H2>
          5. Data Sharing and Third-Party Services
        </H2>
        <P className="text-foreground/80">
          We share your data only with the following third-party services,
          strictly for the purposes described:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Supabase</strong> &mdash; Database hosting and
            authentication. Receives all account and golf data.
          </li>
          <li>
            <strong>Stripe</strong> &mdash; Payment processing. Receives email
            and subscription plan.
          </li>
          <li>
            <strong>Resend</strong> &mdash; Transactional emails. Receives email
            address and name.
          </li>
          <li>
            <strong>Sentry</strong> &mdash; Error monitoring. Receives error
            context and anonymized usage.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; Hosting and analytics. Receives page
            views and performance data.
          </li>
          <li>
            <strong>Upstash Redis</strong> &mdash; Rate limiting. Receives IP
            address or user ID temporarily.
          </li>
          <li>
            <strong>Google OAuth</strong> &mdash; Sign-in (if you choose Google).
            Receives authentication tokens.
          </li>
        </ul>
        <P className="text-foreground/80">
          We may also share your information if required by law, to protect our
          rights, or in connection with a business transfer (see Section 10).
        </P>
      </div>

      {/* 6. Aggregated Data */}
      <div className="space-y-3">
        <H2>
          6. Anonymized and Aggregated Data
        </H2>
        <P className="text-foreground/80">
          We may use anonymized, aggregated data for analytical and marketing
          purposes, such as displaying the total number of rounds logged or
          average handicap trends across all users. This data cannot be used to
          identify you personally.
        </P>
      </div>

      {/* 7. Data Security */}
      <div className="space-y-3">
        <H2>
          7. Data Security
        </H2>
        <P className="text-foreground/80">
          We implement industry-standard security measures to protect your data:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Encryption in transit:</strong> All data is transmitted over
            HTTPS/TLS.
          </li>
          <li>
            <strong>Database security:</strong> Row Level Security (RLS) policies
            ensure you can only access your own data.
          </li>
          <li>
            <strong>Password security:</strong> Passwords are hashed using
            industry-standard algorithms and never stored in plain text.
          </li>
          <li>
            <strong>Verification codes:</strong> One-time verification codes are
            hashed (SHA-256) before storage and automatically expire.
          </li>
          <li>
            <strong>Payment security:</strong> Credit card details are handled
            entirely by Stripe (PCI DSS Level 1 compliant) and never touch our
            servers.
          </li>
          <li>
            <strong>Rate limiting:</strong> API endpoints are rate-limited to
            prevent abuse.
          </li>
        </ul>
        <P className="text-foreground/80">
          While we take reasonable precautions, no system is completely secure.
          We will notify affected users promptly in the event of a data breach.
        </P>
      </div>

      {/* 8. Data Retention */}
      <div className="space-y-3">
        <H2>
          8. Data Retention
        </H2>
        <P className="text-foreground/80">
          We retain your data for as long as your account is active:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Account and golf data:</strong> Retained for the lifetime of
            your account. Deleted upon account closure, subject to legal
            retention requirements.
          </li>
          <li>
            <strong>Verification codes:</strong> Automatically expire within 15
            minutes and are cleaned up periodically.
          </li>
          <li>
            <strong>IP addresses:</strong> Retained for up to 90 days for
            security purposes, then deleted.
          </li>
          <li>
            <strong>Webhook event logs:</strong> Retained for up to 12 months for
            billing dispute resolution, then deleted.
          </li>
          <li>
            <strong>Rate limiting data:</strong> Stored temporarily in Redis and
            automatically expires within minutes.
          </li>
        </ul>
      </div>

      {/* 9. Your Rights */}
      <div className="space-y-3">
        <H2>
          9. Your Rights
        </H2>
        <P className="text-foreground/80">
          Depending on your location, you may have the following rights regarding
          your personal data:
        </P>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Access:</strong> View all personal data we hold about you
            through your account dashboard.
          </li>
          <li>
            <strong>Correction:</strong> Update your name, email, and profile
            information at any time.
          </li>
          <li>
            <strong>Deletion:</strong> Request complete account deletion by
            contacting us.
          </li>
          <li>
            <strong>Data export:</strong> Request a copy of your data in a
            portable format.
          </li>
          <li>
            <strong>Email preferences:</strong> Control which emails you receive
            through your settings.
          </li>
        </ul>
        <P className="text-foreground/80">
          If you are in the EEA (GDPR) or California (CCPA), you may have
          additional rights including data portability, right to object, and
          right to restriction. We do not sell your personal information.
        </P>
      </div>

      {/* 10. Business Transfers */}
      <div className="space-y-3">
        <H2>
          10. Business Transfers
        </H2>
        <P className="text-foreground/80">
          In the event of a merger, acquisition, or sale of assets, your
          personal data may be transferred to the successor entity. The
          successor will be bound by this Privacy Policy and the commitments made
          in our{" "}
          <Link
            href="/terms-of-service"
            className="text-primary hover:underline"
          >
            Terms of Service
          </Link>
          . We will notify you before your data is transferred.
        </P>
      </div>

      {/* 11. Children's Privacy */}
      <div className="space-y-3">
        <H2>
          11. Children&apos;s Privacy
        </H2>
        <P className="text-foreground/80">
          The Service is not intended for children under 13. We do not knowingly
          collect personal information from children under 13. If we learn that
          we have collected data from a child under 13, we will delete it
          promptly.
        </P>
      </div>

      {/* 12. Cookies and Tracking */}
      <div className="space-y-3">
        <H2>
          12. Cookies and Tracking Technologies
        </H2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80">
          <li>
            <strong>Authentication cookies:</strong> Essential cookies managed by
            Supabase to maintain your login session.
          </li>
          <li>
            <strong>Theme preference:</strong> A local storage value to remember
            your light/dark mode preference.
          </li>
          <li>
            <strong>Analytics:</strong> Vercel Analytics collects anonymized page
            view and performance data.
          </li>
        </ul>
        <P className="text-foreground/80">
          We do not use third-party advertising cookies or cross-site tracking
          technologies.
        </P>
      </div>

      {/* 13-15: Remaining sections condensed */}
      <div className="space-y-3">
        <H2>
          13. International Data Transfers
        </H2>
        <P className="text-foreground/80">
          Your data may be processed in the United States and other countries
          where our service providers operate. When data is transferred outside
          the EEA, we ensure appropriate safeguards are in place.
        </P>
      </div>

      <div className="space-y-3">
        <H2>
          14. Changes to This Policy
        </H2>
        <P className="text-foreground/80">
          We may update this Privacy Policy from time to time. We will notify you
          of material changes by posting the updated policy on this page and, for
          significant changes, by email. Your continued use of the Service
          constitutes acceptance.
        </P>
      </div>

      <div className="space-y-3">
        <H2>
          15. Contact Us
        </H2>
        <P className="text-foreground/80">
          If you have questions about this Privacy Policy, contact us at{" "}
          <Link
            href="mailto:sebastiansole@handicappin.com"
            className="text-primary hover:underline"
          >
            sebastiansole@handicappin.com
          </Link>
          . We aim to respond within 30 days.
        </P>
      </div>
    </div>
  );
}

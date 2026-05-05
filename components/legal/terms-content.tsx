import { H2, P } from "@/components/ui/typography";
import Link from "next/link";

const EFFECTIVE_DATE = "February 11, 2026";

export function TermsContent() {
  return (
    <div className="space-y-xl">
      <p className="text-sm text-muted-foreground">
        Effective Date: {EFFECTIVE_DATE}
      </p>

      {/* 1. Acceptance of Terms */}
      <div className="space-y-sm">
        <H2>
          1. Acceptance of Terms
        </H2>
        <P className="text-foreground/80">
          By accessing or using Handicappin&apos; (&quot;the Service&quot;),
          operated by SoleInnovations (&quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;), you agree to be bound by these Terms of Service
          (&quot;Terms&quot;). If you do not agree to these Terms, you may not
          use the Service.
        </P>
        <P className="text-foreground/80">
          We reserve the right to update these Terms at any time. We will notify
          you of material changes by posting the updated Terms on this page with
          a revised effective date. Your continued use of the Service after
          changes are posted constitutes your acceptance of the revised Terms.
        </P>
      </div>

      {/* 2. Description of Service */}
      <div className="space-y-sm">
        <H2>
          2. Description of Service
        </H2>
        <P className="text-foreground/80">
          Handicappin&apos; is a web-based golf handicap tracking application
          that provides USGA-compliant handicap calculations, round management,
          interactive scorecards, performance analytics, and related tools. The
          Service is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis.
        </P>
        <P className="text-foreground/80">
          While we strive for accuracy, Handicappin&apos; is not an official
          USGA handicap service. Handicap calculations are provided for
          informational and personal tracking purposes and should not be relied
          upon for official tournament play unless accepted by the governing body
          of that event.
        </P>
      </div>

      {/* 3. Account Registration */}
      <div className="space-y-sm">
        <H2>
          3. Account Registration and Security
        </H2>
        <P className="text-foreground/80">
          To use the Service, you must create an account with a valid email
          address. You are responsible for maintaining the confidentiality of
          your account credentials and for all activities that occur under your
          account. You agree to notify us immediately of any unauthorized use of
          your account.
        </P>
        <P className="text-foreground/80">
          You must be at least 13 years of age to use the Service. If you are
          under 18, you represent that you have your parent or guardian&apos;s
          consent to use the Service.
        </P>
      </div>

      {/* 4. Subscription Plans and Pricing */}
      <div className="space-y-sm">
        <H2>
          4. Subscription Plans and Pricing
        </H2>
        <P className="text-foreground/80">
          Handicappin&apos; offers the following subscription plans:
        </P>
        <ul className="list-disc pl-lg space-y-sm text-foreground/80">
          <li>
            <strong>Free</strong> &mdash; $0, limited to 25 rounds with basic
            handicap calculation.
          </li>
          <li>
            <strong>Premium</strong> &mdash; $19/year, unlimited round logging.
          </li>
          <li>
            <strong>Unlimited</strong> &mdash; $29/year, all features including
            advanced calculators and personal statistics.
          </li>
          <li>
            <strong>Lifetime</strong> &mdash; $149 one-time payment, all
            features for the lifetime of the Service (see Section 5).
          </li>
        </ul>
        <P className="text-foreground/80">
          We reserve the right to modify pricing for future subscriptions. Price
          changes will not affect active subscription periods. Promotional
          pricing (such as early-access discounts or promotional codes) is
          subject to availability and may be withdrawn at any time.
        </P>
      </div>

      {/* 5. Lifetime Plan */}
      <div className="space-y-sm">
        <H2>
          5. Lifetime Plan
        </H2>
        <P className="text-foreground/80">
          The &quot;Lifetime&quot; plan grants access to all Service features
          for the <strong>lifetime of the Service</strong>, not the lifetime of
          the account holder. &quot;Lifetime of the Service&quot; means the
          period during which Handicappin&apos; is actively operated and
          maintained.
        </P>
        <P className="text-foreground/80">
          If the Service is permanently discontinued, we will provide Lifetime
          plan holders with at least 90 days&apos; advance written notice. In
          the event of permanent discontinuation within the first 12 months of a
          Lifetime purchase, we will offer a prorated refund based on the
          remaining portion of that 12-month period.
        </P>
        <P className="text-foreground/80">
          The Lifetime plan does not guarantee that every future feature will be
          included at no additional cost, although we intend to include all
          standard features. Premium add-on services that fall outside the core
          functionality of the Service may be offered separately.
        </P>
      </div>

      {/* 6. Payment and Billing */}
      <div className="space-y-sm">
        <H2>
          6. Payment and Billing
        </H2>
        <P className="text-foreground/80">
          All payments are processed securely through Stripe. We do not store
          your credit card information on our servers. By providing payment
          information, you authorize us to charge the applicable fees to your
          payment method.
        </P>
        <P className="text-foreground/80">
          Annual subscriptions (Premium and Unlimited) automatically renew at
          the end of each billing period unless cancelled before the renewal
          date. You can manage your subscription, update payment methods, and
          cancel auto-renewal through the billing management portal accessible
          from your account.
        </P>
        <P className="text-foreground/80">
          If a payment fails, we may suspend access to paid features until the
          payment issue is resolved. We will notify you by email of any payment
          failures.
        </P>
      </div>

      {/* 7. Refund Policy */}
      <div className="space-y-sm">
        <H2>
          7. Refund Policy
        </H2>
        <P className="text-foreground/80">
          We offer a <strong>30-day money-back guarantee</strong> on all paid
          plans. If you are unsatisfied with the Service for any reason, you may
          request a full refund within 30 days of your initial purchase or most
          recent renewal by contacting us at{" "}
          <Link
            href="mailto:sebastiansole@handicappin.com"
            className="text-primary hover:underline"
          >
            sebastiansole@handicappin.com
          </Link>
          .
        </P>
        <P className="text-foreground/80">After the 30-day window:</P>
        <ul className="list-disc pl-lg space-y-sm text-foreground/80">
          <li>
            <strong>Annual plans (Premium, Unlimited):</strong> No refunds for
            the current billing period. You may cancel auto-renewal at any time
            and retain access until the end of your paid period.
          </li>
          <li>
            <strong>Lifetime plan:</strong> Non-refundable after 30 days, except
            in the case of Service discontinuation within the first 12 months
            (see Section 5).
          </li>
        </ul>
        <P className="text-foreground/80">
          Refunds are processed back to the original payment method and may take
          5&ndash;10 business days to appear on your statement.
        </P>
      </div>

      {/* 8. Service Modifications and Discontinuation */}
      <div className="space-y-sm">
        <H2>
          8. Service Modifications and Discontinuation
        </H2>
        <P className="text-foreground/80">
          We reserve the right to modify, suspend, or discontinue the Service
          (or any part of it) at any time, with or without notice. We will make
          reasonable efforts to provide advance notice of material changes that
          affect paid users.
        </P>
        <P className="text-foreground/80">
          In the event of permanent discontinuation of the Service:
        </P>
        <ul className="list-disc pl-lg space-y-sm text-foreground/80">
          <li>
            We will provide at least 90 days&apos; advance notice to all users.
          </li>
          <li>
            Users will have the opportunity to export their data (rounds,
            scores, and handicap history) before the Service shuts down.
          </li>
          <li>
            Active annual subscribers will receive a prorated refund for the
            unused portion of their current billing period.
          </li>
          <li>
            Lifetime plan holders will be treated as described in Section 5.
          </li>
        </ul>
      </div>

      {/* 9. Assignment and Transfer */}
      <div className="space-y-sm">
        <H2>
          9. Assignment and Transfer
        </H2>
        <P className="text-foreground/80">
          We may assign or transfer these Terms, and any rights and obligations
          hereunder, to a successor entity in connection with a merger,
          acquisition, sale of assets, or other business transfer. In the event
          of such a transfer, the successor entity will assume all obligations
          under these Terms, including any commitments to Lifetime plan holders.
          We will notify you of any such assignment.
        </P>
        <P className="text-foreground/80">
          You may not assign or transfer your account or any rights under these
          Terms to another person without our prior written consent.
        </P>
      </div>

      {/* 10. User Content and Data */}
      <div className="space-y-sm">
        <H2>
          10. User Content and Data
        </H2>
        <P className="text-foreground/80">
          You retain ownership of all data you submit to the Service, including
          round scores, course information, and profile details. By using the
          Service, you grant us a limited license to store, process, and display
          your data solely for the purpose of providing and improving the
          Service.
        </P>
        <P className="text-foreground/80">
          We may use anonymized, aggregated data (such as average handicap
          trends or total rounds logged) for analytical and marketing purposes.
          This data will never personally identify you.
        </P>
        <P className="text-foreground/80">
          You are responsible for the accuracy of the data you enter. Handicap
          calculations are only as accurate as the scores and course information
          you provide.
        </P>
      </div>

      {/* 11. Acceptable Use */}
      <div className="space-y-sm">
        <H2>
          11. Acceptable Use
        </H2>
        <P className="text-foreground/80">You agree not to:</P>
        <ul className="list-disc pl-lg space-y-sm text-foreground/80">
          <li>
            Use the Service for any unlawful purpose or in violation of any
            applicable laws.
          </li>
          <li>
            Attempt to gain unauthorized access to the Service, other accounts,
            or our systems.
          </li>
          <li>Interfere with or disrupt the Service or its infrastructure.</li>
          <li>
            Use automated tools, bots, or scripts to access the Service except
            through our published APIs.
          </li>
          <li>
            Intentionally submit false or misleading scores to manipulate
            handicap calculations.
          </li>
          <li>Resell, redistribute, or sublicense access to the Service.</li>
        </ul>
        <P className="text-foreground/80">
          We reserve the right to suspend or terminate accounts that violate
          these terms.
        </P>
      </div>

      {/* 12. Intellectual Property */}
      <div className="space-y-sm">
        <H2>
          12. Intellectual Property
        </H2>
        <P className="text-foreground/80">
          The Service, including its design, features, code, and content
          (excluding user-submitted data), is the intellectual property of
          SoleInnovations and is protected by applicable copyright and
          intellectual property laws. You may not copy, modify, distribute, or
          create derivative works of the Service without our prior written
          consent.
        </P>
        <P className="text-foreground/80">
          &quot;Handicappin&apos;&quot; and related branding are trademarks of
          SoleInnovations. You may not use our trademarks without prior written
          permission.
        </P>
      </div>

      {/* 13. Disclaimer of Warranties */}
      <div className="space-y-sm">
        <H2>
          13. Disclaimer of Warranties
        </H2>
        <P className="text-foreground/80 uppercase font-semibold text-sm">
          The Service is provided &quot;as is&quot; and &quot;as
          available&quot; without warranties of any kind, whether express or
          implied, including but not limited to implied warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement.
        </P>
        <P className="text-foreground/80">
          We do not warrant that the Service will be uninterrupted, error-free,
          or secure. We do not warrant the accuracy of handicap calculations
          beyond reasonable commercial efforts to follow USGA guidelines. We are
          not affiliated with, endorsed by, or officially connected to the USGA.
        </P>
      </div>

      {/* 14. Limitation of Liability */}
      <div className="space-y-sm">
        <H2>
          14. Limitation of Liability
        </H2>
        <P className="text-foreground/80 uppercase font-semibold text-sm">
          To the maximum extent permitted by applicable law, SoleInnovations and
          its officers, employees, and affiliates shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages,
          including but not limited to loss of data, loss of profits, or damages
          arising from your use of or inability to use the Service.
        </P>
        <P className="text-foreground/80">
          Our total liability for any claims arising from or related to these
          Terms or the Service shall not exceed the amount you paid to us in the
          12 months preceding the claim, or $149, whichever is greater.
        </P>
      </div>

      {/* 15. Privacy */}
      <div className="space-y-sm">
        <H2>15. Privacy</H2>
        <P className="text-foreground/80">
          Your use of the Service is also governed by our{" "}
          <Link
            href="/privacy-policy"
            className="text-primary hover:underline"
          >
            Privacy Policy
          </Link>
          . By using the Service, you consent to the collection, use, and
          disclosure of your information as described in our Privacy Policy. We
          are committed to protecting your personal data in accordance with
          applicable data protection laws, including GDPR where applicable.
        </P>
      </div>

      {/* 16. Termination */}
      <div className="space-y-sm">
        <H2>
          16. Termination
        </H2>
        <P className="text-foreground/80">
          You may close your account at any time by contacting us at{" "}
          <Link
            href="mailto:sebastiansole@handicappin.com"
            className="text-primary hover:underline"
          >
            sebastiansole@handicappin.com
          </Link>
          . Upon account closure, your personal data will be deleted in
          accordance with our Privacy Policy, subject to any legal retention
          requirements.
        </P>
        <P className="text-foreground/80">
          We may suspend or terminate your account if you violate these Terms,
          engage in fraudulent activity, or if required by law. In the case of
          termination for cause, no refund will be provided.
        </P>
      </div>

      {/* 17. Governing Law and Dispute Resolution */}
      <div className="space-y-sm">
        <H2>
          17. Governing Law and Dispute Resolution
        </H2>
        <P className="text-foreground/80">
          These Terms are governed by and construed in accordance with the laws
          of the United States and the state in which SoleInnovations is
          registered, without regard to conflict of law principles.
        </P>
        <P className="text-foreground/80">
          Any disputes arising from these Terms or your use of the Service shall
          first be resolved through good-faith negotiation. If a resolution
          cannot be reached within 30 days, either party may pursue binding
          arbitration under the rules of the American Arbitration Association.
          Class action lawsuits and class-wide arbitration are waived by both
          parties.
        </P>
      </div>

      {/* 18. Indemnification */}
      <div className="space-y-sm">
        <H2>
          18. Indemnification
        </H2>
        <P className="text-foreground/80">
          You agree to indemnify and hold harmless SoleInnovations, its
          officers, employees, and affiliates from any claims, damages, losses,
          or expenses (including reasonable legal fees) arising from your use of
          the Service, your violation of these Terms, or your violation of any
          third-party rights.
        </P>
      </div>

      {/* 19. Severability */}
      <div className="space-y-sm">
        <H2>
          19. Severability
        </H2>
        <P className="text-foreground/80">
          If any provision of these Terms is found to be unenforceable or
          invalid by a court of competent jurisdiction, that provision will be
          limited or eliminated to the minimum extent necessary so that the
          remaining provisions remain in full force and effect.
        </P>
      </div>

      {/* 20. Entire Agreement */}
      <div className="space-y-sm">
        <H2>
          20. Entire Agreement
        </H2>
        <P className="text-foreground/80">
          These Terms, together with our Privacy Policy, constitute the entire
          agreement between you and SoleInnovations regarding your use of the
          Service and supersede any prior agreements or understandings.
        </P>
      </div>

      {/* 21. Contact */}
      <div className="space-y-sm">
        <H2>
          21. Contact Us
        </H2>
        <P className="text-foreground/80">
          If you have questions about these Terms, please contact us at{" "}
          <Link
            href="mailto:sebastiansole@handicappin.com"
            className="text-primary hover:underline"
          >
            sebastiansole@handicappin.com
          </Link>
          .
        </P>
      </div>
    </div>
  );
}

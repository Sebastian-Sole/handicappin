import AboutSkeleton from "@/components/loading/about-skeleton";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { H2, H3, P } from "@/components/ui/typography";
import { createClient } from "@supabase/supabase-js";
import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { env } from "@/env";
import type { Database } from "@/types/supabase";

import {
  Logs,
  LineChart,
  BookOpenText,
  Calculator,
  Scale,
  Earth,
  Gauge,
  Trophy,
} from "lucide-react";

// Create a simple Supabase client for public data that doesn't use cookies
// This is safe for unstable_cache since it doesn't depend on dynamic request data
function createPublicSupabaseClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Cache the about page stats for 24 hours (86400 seconds)
// These numbers don't need to be real-time
const getCachedAboutStats = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient();

    // Fetch both counts in parallel
    const [roundResult, courseResult] = await Promise.all([
      supabase.from("round").select("id", { count: "exact", head: true }),
      supabase.from("course").select("id", { count: "exact", head: true }),
    ]);

    return {
      totalRounds: roundResult.count ?? 0,
      totalCourses: courseResult.count ?? 0,
    };
  },
  ["about-page-stats"],
  { revalidate: 86400 } // 24 hours
);

export const metadata: Metadata = {
  title: "About Us - Why Handicappin' Exists",
  description:
    "Learn why we built Handicappin' - a golf handicap tracker that puts user experience first. USGA compliant calculations, detailed round tracking, and transparent statistics.",
  alternates: {
    canonical: "https://handicappin.com/about",
  },
  openGraph: {
    title: "About Handicappin' - Our Mission",
    description:
      "We built Handicappin' because other golf services overcomplicated everything. Simple handicap tracking with transparent calculations.",
    url: "https://handicappin.com/about",
  },
};

export default async function AboutPage() {
  // Use cached stats for better performance
  const { totalRounds, totalCourses } = await getCachedAboutStats();

  return (
    <Suspense fallback={<AboutSkeleton />}>
      <div className="min-h-screen bg-background">
        {/* Mission Section */}
        <section className="w-full py-2xl md:py-4xl lg:py-5xl hero-gradient">
          <div className="sm:container px-md md:px-lg mx-auto">
            <div className="mx-auto grid max-w-5xl items-start gap-lg py-2xl xl:grid-cols-2 lg:gap-2xl">
              <div className="flex flex-col justify-start space-y-md">
                <div className="space-y-sm">
                  <Badge>Our Mission</Badge>
                  <H2 className="lg:leading-tighter text-3xl tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem] pb-0">
                    Why Does Handicappin&apos; Even Exist?
                  </H2>
                  <P className="text-foreground/80 md:text-xl/relaxed">
                    We found that other golf services overcomplicated golfing,
                    whether it be keeping scores, or hiding the calculations
                    behind confusing UI&apos;s. We put user experience first,
                    and aim to make keeping track of your golf game effortless,
                    all while helping golfers understand the calculations behind
                    the scenes.
                  </P>
                </div>
              </div>
              <div className="grid gap-lg sm:grid-cols-2 h-fit">
                <div className="flex items-start space-x-md">
                  <div className="icon-chip-primary">
                    <Logs className="h-7 w-7" />
                  </div>
                  <div>
                    <H3 className="text-lg">
                      Detailed Round Tracking
                    </H3>
                    <P className="text-foreground/80">
                      Log your rounds and get detailed insights into how you
                      played and see your progression in real-time.
                    </P>
                  </div>
                </div>
                <div className="flex items-start space-x-md">
                  <div className="icon-chip-primary">
                    <LineChart className="h-7 w-7" />
                  </div>
                  <div>
                    <H3 className="text-lg">
                      Interactive Statistics
                    </H3>
                    <P className="text-foreground/80">
                      We provide a wide range of ways to view statistics, from
                      high-level round summaries to detailed hole-by-hole
                      breakdowns.
                    </P>
                  </div>
                </div>
                <div className="flex items-start space-x-md">
                  <div className="icon-chip-primary">
                    <BookOpenText className="h-7 w-7" />
                  </div>
                  <div>
                    <H3 className="text-lg">
                      Detailed explanations
                    </H3>
                    <P className="text-foreground/80">
                      Understand how your played rounds affected your handicap
                      and get detailed explanations of the calculations behind
                      the scenes.
                    </P>
                  </div>
                </div>
                <div className="flex items-start space-x-md">
                  <div className="icon-chip-primary">
                    <Calculator className="h-7 w-7" />
                  </div>
                  <div>
                    <H3 className="text-lg">Calculators</H3>
                    <P className="text-foreground/80">
                      Our interactive calculators let you know how stats are
                      calculated step-by-step. See the calculations behind your
                      rounds and how slight changes affect the overall scores.
                    </P>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="w-full py-2xl md:py-4xl lg:py-5xl">
          <div className="sm:container px-md md:px-lg mx-auto">
            <div className="flex flex-col items-center justify-center space-y-md text-center">
              <div className="space-y-sm">
                <Badge>Why Choose Us</Badge>
                <H2 className="lg:leading-tighter text-3xl tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem] pb-0">
                  What Makes Us Different?
                </H2>
                <p className="mx-auto max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  We value your time. We know that golf statistics and round
                  calculations are complicated, and that other services
                  don&apos;t show you everything. That&apos;s why we made
                  Handicappin&apos;. As golfers, we made something that we would
                  use ourselves, filling the gaps that other services left
                  behind. Handicappin&apos; is designed to be simple and
                  intuitive. Just log your rounds, and we&apos;ll handle the
                  rest.
                </p>
              </div>
            </div>

            <div className="mx-auto grid max-w-5xl items-center gap-lg py-2xl lg:gap-2xl">
              <div className="flex flex-col justify-center space-y-lg">
                <div className="grid gap-lg xl:grid-cols-2">
                  <div className="flex items-start space-x-md">
                    <div className="icon-chip-primary">
                      <Scale className="h-6 w-6" />
                    </div>
                    <div className="space-y-xs">
                      <H3 className="text-xl">
                        USGA Compliant Calculations
                      </H3>
                      <p className="text-muted-foreground">
                        Our app provides real-time, accurate handicap index
                        updates according to the latest USGA rules. And we
                        update them faster than other services.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-md">
                    <div className="icon-chip-primary">
                      <Earth className="h-6 w-6" />
                    </div>
                    <div className="space-y-xs">
                      <H3 className="text-xl">
                        International Flexibility
                      </H3>
                      <p className="text-muted-foreground">
                        Log rounds from any USGA compliant course in the world.
                        Handicappin&apos; is designed to work with any course,
                        anywhere, with no extra hurdles.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-md">
                    <div className="icon-chip-primary">
                      <Gauge className="h-6 w-6" />
                    </div>
                    <div className="space-y-xs">
                      <H3 className="text-xl">Dashboard</H3>
                      <p className="text-muted-foreground">
                        We provide a dashboard that gives you a high-level view
                        of your rounds and statistics. See your progress at a
                        glance.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-md">
                    <div className="icon-chip-primary">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div className="space-y-xs">
                      <H3 className="text-xl">
                        Detailed Insights
                      </H3>
                      <p className="text-muted-foreground">
                        We are working on providing detailed insights into your
                        game, such as course breakdowns, club usage, and more.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto max-w-5xl flex flex-col items-center justify-center">
              <div className="flex flex-col gap-md w-full sm:grid xl:grid-cols-4 sm:grid-cols-2 xl:gap-md">
                <div className="surface p-lg w-full">
                  <StatTile
                    value={<span className="text-primary">{totalRounds}</span>}
                    label="Total Rounds Logged"
                  />
                </div>
                <div className="surface p-lg w-full">
                  <StatTile
                    value={<span className="text-primary">USGA</span>}
                    label="Ruling Compliant"
                  />
                </div>
                <div className="surface p-lg w-full">
                  <StatTile
                    value={<span className="text-primary">{totalCourses}</span>}
                    label="Courses Supported"
                  />
                </div>
                <div className="surface p-lg w-full">
                  <StatTile
                    value={<span className="text-primary">GDPR</span>}
                    label="Compliant"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Suspense>
  );
}

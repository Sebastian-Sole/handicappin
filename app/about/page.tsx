import AboutSkeleton from "@/components/loading/about-skeleton";
import { Badge } from "@/components/ui/badge";
import { P } from "@/components/ui/typography";
import { createServerComponentClient } from "@/utils/supabase/server";

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

export default async function AboutPage() {
  // return <AboutSkeleton />;

  const supabase = await createServerComponentClient();
  const { count } = await supabase
    .from("round")
    .select("id", { count: "exact", head: true });
  const totalRounds = count ?? 0;

  const { count: courseCount } = await supabase
    .from("course")
    .select("id", { count: "exact", head: true });
  const totalCourses = courseCount ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Mission Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 to-primary/20 dark:from-primary/5 dark:to-primary/35">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="mx-auto grid max-w-5xl items-start gap-6 py-12 xl:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-start space-y-4">
              <div className="space-y-2">
                <Badge>Our Mission</Badge>
                <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
                  Why Does Handicappin&apos; Even Exist?
                </h2>
                <P className="text-foreground/80 md:text-xl/relaxed">
                  We found that other golf services overcomplicated golfing,
                  whether it be keeping scores, or hiding the calculations
                  behind confusing UI&apos;s. We put user experience first, and
                  aim to make keeping track of your golf game effortless, all
                  while helping golfers understand the calculations behind the
                  scenes.
                </P>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 h-fit">
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <Logs className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Detailed Round Tracking
                  </h3>
                  <P className="text-foreground/80">
                    Log your rounds and get detailed insights into how you
                    played and see your progression in real-time.
                  </P>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <LineChart className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Interactive Statistics
                  </h3>
                  <P className="text-foreground/80">
                    We provide a wide range of ways to view statistics, from
                    high-level round summaries to detailed hole-by-hole
                    breakdowns.
                  </P>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <BookOpenText className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Detailed explanations
                  </h3>
                  <P className="text-foreground/80">
                    Understand how your played rounds affected your handicap and
                    get detailed explanations of the calculations behind the
                    scenes.
                  </P>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <Calculator className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Calculators</h3>
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
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <Badge>Why Choose Us</Badge>
              <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
                What Makes Us Different?
              </h2>
              <p className="mx-auto max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                We value your time. We know that golf statistics and round
                calculations are complicated, and that other services don&apos;t
                show you everything. That&apos;s why we made Handicappin&apos;.
                As golfers, we made something that we would use ourselves,
                filling the gaps that other services left behind.
                Handicappin&apos; is designed to be simple and intuitive. Just
                log your rounds, and we&apos;ll handle the rest.
              </p>
            </div>
          </div>

          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:gap-12">
            <div className="flex flex-col justify-center space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Scale className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">
                      USGA Compliant Calculations
                    </h3>
                    <p className="text-muted-foreground">
                      Our app provides real-time, accurate handicap index
                      updates according to the latest USGA rules. And we update
                      them faster than other services.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Earth className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">
                      International Flexibility
                    </h3>
                    <p className="text-muted-foreground">
                      Log rounds from any USGA compliant course in the world.
                      Handicappin&apos; is designed to work with any course,
                      anywhere, with no extra hurdles.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Gauge className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">Dashboard</h3>
                    <p className="text-muted-foreground">
                      We provide a dashboard that gives you a high-level view of
                      your rounds and statistics. See your progress at a glance.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">Detailed Insights</h3>
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
            <div className="flex flex-col gap-4 w-full sm:grid xl:grid-cols-4 sm:grid-cols-2 xl:gap-4">
              <div className="flex flex-col items-center space-y-2 rounded-lg border bg-card p-6 text-center w-full">
                <div className="text-2xl font-bold text-primary">
                  {totalRounds}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Rounds Logged
                </div>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border bg-card p-6 text-center w-full">
                <div className="text-2xl font-bold text-primary">USGA</div>
                <div className="text-sm text-muted-foreground">
                  Ruling Compliant
                </div>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border bg-card p-6 text-center w-full">
                <div className="text-2xl font-bold text-primary">
                  {courseCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  Courses Supported
                </div>
              </div>
              <div className="flex flex-col items-center space-y-2 rounded-lg border bg-card p-6 text-center w-full">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">
                  GDPR Compliant
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

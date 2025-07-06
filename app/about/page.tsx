import { Badge } from "@/components/ui/badge";
import { Small } from "@/components/ui/typography";
import {
  Logs,
  LineChart,
  BookOpenText,
  Scale,
  Earth,
  Gauge,
  Calculator,
  Trophy,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <Badge>Our Mission</Badge>
          <div className="grid gap-10 pt-8 md:gap-20 md:grid-cols-2">
            <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
              Why Does Handicappin&apos; Even Exist?
            </h2>
            <p className="mx-auto max-w-[700px] text-muted md:text-xl/relaxed">
              We found that other golf services overcomplicated golfing, whether
              it be keeping scores, or hiding the calculations behind *cough*
              ugly *cough* UI&apos;s. We put user experience first, and aim to
              make keeping track of your golf game effortless, all while helping
              golfers understand the calculations behind the scenes.
            </p>
            <div>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md bg-primary p-2 text-primary-foreground">
                    <Logs className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Detailed Round Tracking
                    </h3>
                    <p className="text-muted">
                      Log your rounds and get detailed insights into how you
                      played and see your progression in real-time.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md bg-primary p-2 text-primary-foreground">
                    <LineChart className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Interactive Statistics
                    </h3>
                    <p className="text-muted">
                      We provide a wide range of ways to view statistics, from
                      high-level round summaries to detailed hole-by-hole
                      breakdowns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start space-y-8">
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md bg-primary p-2 text-primary-foreground">
                    <BookOpenText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Detailed explanations
                    </h3>
                    <p className="text-muted">
                      Understand how your played rounds affected your handicap
                      and get detailed explanations of the calculations behind
                      the scenes.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md bg-primary p-2 text-primary-foreground">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Calculators</h3>
                    <p className="text-muted">
                      Our interactive calculators let you know how stats are
                      calculated step-by-step. See the calculations behind your
                      rounds and how slight changes affect the overall scores.
                    </p>
                  </div>
                </div>
              </div>
              <p className="mx-auto max-w-[700px] text-muted md:text-xl/relaxed">
                Our golf round tracking app is designed to be simple and
                intuitive. Just log your rounds, and we&apos;ll do the rest.
                While you shoot for the green, we&apos;ll be here to land it in
                the hole.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32 bg-primary-alternate">
        <div className="container px-4 md:px-6">
          <Badge className="dark:bg-background dark:text-muted-foreground bg-black text-white">
            Why Choose Us?
          </Badge>
          <div className="grid gap-10 pt-8 md:gap-20 md:grid-cols-2">
            <p className="mx-auto max-w-[700px] text-accent-foreground dark:text-foreground md:text-xl/relaxed">
              We value your time. We know that golf statistics and round
              calculations are complicated, we know that other services
              don&apos;t show you everything, and that you want something
              easy to use. That&apos;s why we made Handicappin&apos;. As
              golfers, we made something that we would use ourselves, filling the gaps
              that other services left behind.
            </p>
            <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
              What Makes Us Different?
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-start gap-3">
                <div className="rounded-md p-2 dark:bg-background dark:text-muted-foreground bg-black text-white">
                  <Scale className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    USGA Compliant Calculations
                  </h3>
                  <p className="text-accent-foreground dark:text-foreground">
                    Our app provides real-time, accurate handicap index updates
                    according to the latest USGA rules. And we update them
                    faster than other services.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3">
                <div className="rounded-md p-2 dark:bg-background dark:text-muted-foreground bg-black text-white">
                  <Earth className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    International Flexibility
                  </h3>
                  <p className="text-accent-foreground dark:text-foreground">
                    Log rounds from any USGA compliant course in the world.
                    Handicappin&apos; is designed to work with any course,
                    anywhere, with no extra hurdles.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start space-y-8">
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md p-2 dark:bg-background dark:text-muted-foreground bg-black text-white">
                    <Gauge className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Dashboard</h3>
                    <p className="text-accent-foreground dark:text-foreground">
                      We provide a dashboard that gives you a high-level view of
                      your rounds and statistics. See your progress at a glance.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3">
                  <div className="rounded-md p-2 dark:bg-background dark:text-muted-foreground bg-black text-white">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Detailed Insights</h3>
                    <Small>(Coming Soon!)</Small>
                    <p className="text-accent-foreground dark:text-foreground">
                      We are working on providing detailed insights into your
                      game, such as course breakdowns, club usage, and more.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

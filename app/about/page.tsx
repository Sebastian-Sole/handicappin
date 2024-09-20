import { Badge } from "@/components/ui/badge";
import { Muted, Small } from "@/components/ui/typography";
import { Logs, LineChart, BookOpenText, Scale, Earth } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* <section className="w-full py-12 md:py-24 lg:py-32 bg-primary-alternate dark:bg-primary/80">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-card">
                  Handicappin&apos;
                </h1>
                <div className="w-full py-4 lg:py-8 xl:py-8">
                  <div className="container px-0 grid gap-10 mx-auto max-w-[800px]">
                    <div className="bg-card/90 rounded-3xl p-6">
                      <p className="space-y-4 text-secondary-/90 dark:text-muted-foreground/90">
                        We found that other golf services overcomplicated
                        golfing, whether it be keeping scores, or hiding the
                        calculations behind *cough* ugly *cough* UI&apos;s. We
                        put user experience first, and aim to make keeping track
                        of your golf game effortless, all while helping golfers
                        understand the calculations behind the scenes.
                      </p>
                    </div>
                    <div className="space-y-4 text-card">
                      <h3 className="text-2xl font-bold tracking-tighter">
                        Key Features
                      </h3>
                      <ul className="list-disc list-inside space-y-2 text-secondary-card">
                        <li>Round-tracking</li>
                        <li>
                          Real-time, <b>accurate</b> handicap index updates
                          according to <b>2024 USGA rules</b>
                        </li>
                        <li>
                          Interactive statistic <b>calculators</b>
                        </li>
                        <li>
                          Detailed <b>explanations</b> of how your played rounds
                          affected your handicap
                        </li>
                        <li>
                          Frivolities - Find virtually any statistic you could
                          want <b>(Coming Soon)</b>
                        </li>
                        <li>
                          Guaranteed the <b>easiest</b> golf application to use
                          on the market
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/calculators" prefetch={false}>
                  <Button className="bg-card/90 text-secondary/90 dark:text-muted-foreground/90">
                    Calculators
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section> */}
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
                    <InfoIcon className="h-6 w-6" />
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
          <Badge className="bg-background text-muted-foreground">
            Why Choose Us?
          </Badge>
          <div className="grid gap-10 pt-8 md:gap-20 md:grid-cols-2">
            <p className="mx-auto max-w-[700px] text-accent-foreground dark:text-foreground md:text-xl/relaxed">
              We value your time. We know that golf statistics and round
              calculations are complicated, we konw that other services
              don&apos;t show you everything, and we know you want something
              easy to use. That&apos;s why we made Handicappin&apos;. As
              golfers, we made something that we would use, filling in the gaps
              that other services left behind.
            </p>
            <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
              What Makes Us Different?
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-start gap-3">
                <div className="rounded-md bg-background p-2 text-muted-foreground">
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
                <div className="rounded-md bg-background p-2 text-muted-foreground">
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
                  <div className="rounded-md bg-background p-2 text-muted-foreground">
                    <GaugeIcon className="h-6 w-6" />
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
                  <div className="rounded-md bg-background p-2 text-muted-foreground">
                    <TrophyIcon className="h-6 w-6" />
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

function BarChartIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function GaugeIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

function InfoIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function LightbulbIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function PlusIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function TrophyIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function UsersIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

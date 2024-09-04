import { Button } from "@/components/ui/button";
import { Tables } from "@/types/supabase";
import {
  ChevronRight,
  BarChart2,
  TrendingDown,
  Award,
  Target,
  Clock,
  Calendar,
  Info,
} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { P } from "./ui/typography";

interface HeroProps {
  profile: Tables<"Profile">;
  previousScores: number[];
}

const Hero = ({ profile, previousScores }: HeroProps) => {
  return (
    <section className="w-full py-4 md:py-8 lg:py-12 xl:py-24 bg-cover bg-center">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-between space-y-4 bg-background/90 backdrop-blur-sm p-8 rounded-xl shadow-lg h-full">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none text-primary">
                Welcome back, {profile.name}!
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                {/* TODO: Update this */}
                Here&apos;s a quick overview of your golf performance. Keep up
                the good work!
              </p>
              <div className="flex flex-col gap-2 min-[460px]:flex-row">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Log New Round
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  View Full Stats
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
              <div className="flex flex-col items-center space-y-2 bg-primary/10 p-4 rounded-lg">
                <BarChart2 className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-center">
                  <P className="text-primary">Handicap Index</P>
                </span>
                <P className="text-primary">{profile.handicapIndex}</P>
              </div>
              <div className="flex flex-col items-center space-y-2 bg-primary/10 p-4 rounded-lg">
                <TrendingDown className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-center">
                  <P className="text-primary">Avg. Score (Last 10)</P>
                </span>
                <p className="text-2xl font-bold text-primary">
                  {previousScores.reduce((a, b) => a + b, 0) /
                    previousScores.length}
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 bg-primary/10 p-4 rounded-lg">
                <Award className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-center">
                  <P className="text-primary">Best Round</P>
                </span>
                {/* TODO: Query best round */}
                <p className="text-2xl font-bold text-primary">N/A</p>
              </div>
            </div>
            {/* <div className="pt-6 border-t border-zinc-200">
              <h3 className="text-lg font-semibold mb-2">Upcoming Events</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <li className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">Local Tournament - June 15</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Skills Challenge - June 22</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm">
                    Tee Time - Pebble Creek, June 18
                  </span>
                </li>
                <li className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  <span className="text-sm">Club Championship - July 1-2</span>
                </li>
              </ul>
            </div> */}
          </div>
          {/* <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full h-full max-w-[500px] max-h-[600px]">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-foreground rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative w-full h-full bg-white bg-opacity-50 backdrop-blur-md rounded-3xl shadow-2xl p-8 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-zinc-800">
                    Performance Breakdown
                  </h3>
                  <p className="text-zinc-600">Last 5 Rounds</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Driving Accuracy</span>
                      <span className="font-medium">68%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "68%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Greens in Regulation</span>
                      <span className="font-medium">52%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "52%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Putts per Round</span>
                      <span className="font-medium">31.2</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "70%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sand Saves</span>
                      <span className="font-medium">40%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "40%" }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-zinc-200">
                  <h4 className="text-lg font-semibold mb-2">Focus Areas</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-red-500" />
                      <span className="text-sm">
                        Improve sand play technique
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm">
                        Work on approach shots accuracy
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div> */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full h-full max-w-[500px] max-h-[600px]">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-foreground rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative w-full h-full bg-background/50 bg-opacity-50 backdrop-blur-md rounded-3xl shadow-2xl p-8 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Performance Breakdown</h3>
                  <P>Last 5 Rounds</P>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Driving Accuracy</span>
                      <span className="font-medium">68%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "68%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Greens in Regulation</span>
                      <span className="font-medium">52%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "52%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Putts per Round</span>
                      <span className="font-medium">31.2</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "70%" }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sand Saves</span>
                      <span className="font-medium">40%</span>
                    </div>
                    <div className="h-2 bg-primary/20 rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "40%" }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="text-lg font-semibold mb-2">Focus Areas</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-red-500" />
                      <span className="text-sm">
                        Improve sand play technique
                      </span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm">
                        Work on approach shots accuracy
                      </span>
                    </li>
                  </ul>
                </div>
                {/* TODO: Add a "hover card" for "What's this?" */}
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
                  <p className="text-2xl font-bold text-primary mb-2">
                    Coming Soon
                  </p>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                      >
                        <Info className="h-4 w-4 mr-2" />
                        <div>What&apos;s this?</div>
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex justify-between space-x-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold">
                            Advanced Stats
                          </h4>
                          <p className="text-sm">
                            We are working on providing advanced statistics of
                            your rounds to provide insights on your performance.
                            Stay tuned!
                          </p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <div className="mt-12 text-center">
          <Link
            href="/training-plan"
            className="text-sm text-white hover:underline bg-primary/80 px-4 py-2 rounded-full backdrop-blur-sm"
          >
            View Personalized Training Plan
          </Link>
        </div> */}
      </div>
    </section>
  );
};

export default Hero;

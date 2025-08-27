import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Target,
  TrendingUp,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { createServerComponentClient } from "@/utils/supabase/server";
import ThemeImage from "@/components/homepage/theme-image";
import Link from "next/link";

export default async function Landing() {
  const supabase = await createServerComponentClient();

  const { data: users } = await supabase.from("profile").select("id");
  if (!users) {
    throw new Error("Failed to fetch number of users");
  }
  const numberOfUsers = Math.round(users.length / 10) * 10;

  const { data: rounds } = await supabase.from("round").select("id");
  if (!rounds) {
    throw new Error("Failed to fetch number of rounds");
  }
  const numberOfRounds = Math.round(rounds.length / 10) * 10;

  const { data: courses } = await supabase.from("course").select("id");
  if (!courses) {
    throw new Error("Failed to fetch number of courses");
  }
  const numberOfCourses = Math.round(courses.length / 10) * 10;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-10 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <Badge
              variant="secondary"
              className="mb-6 dark:bg-primary dark:text-primary-foreground"
            >
              Trusted by golfers worldwide
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-balance mb-6">
              Elevate Your Game with{" "}
              <span className="text-primary">Data-Driven</span> Insights
            </h1>
            <p className="text-xl text-muted-foreground text-pretty mb-8 max-w-2xl mx-auto">
              Track every round, calculate your handicap automatically, and
              understand the calculations behind the scenes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="text-lg px-8">
                  Start Free Forever
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>

              <Link href="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 bg-transparent"
                >
                  Why Handicappin&apos;?
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required • free <strong>forever</strong> for first
              100 users
            </p>
          </div>
        </div>

        {/* Hero Image Placeholder */}
        <div className="mt-16 container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative max-w-5xl mx-auto">
            <ThemeImage />
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Professional-Grade Tools Made Accessible
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to improve your game, all in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg dark:bg-primary/10">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Round Logging</CardTitle>
                <CardDescription>
                  Effortlessly log every round with detailed hole-by-hole
                  scoring with course and tee data in our cutting-edge
                  scorecard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Verified course data
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Scorecard created with user experience in mind
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Contribute to the community with updated course data
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg dark:bg-primary/10">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Handicap Calculation</CardTitle>
                <CardDescription>
                  USGA-compliant handicap calculation that updates automatically
                  and instantly with every round you play.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    USGA compliance
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Automatic updates
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Historical tracking
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg dark:bg-primary/10">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Calculators</CardTitle>
                <CardDescription>
                  We provide calculators for everything from handicap
                  calculation to round scores, allowing users to learn what
                  other companies keep hidden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Handicap calculation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Course rating and slope rating
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Round scores
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                {numberOfUsers}+
              </div>
              <div className="text-muted-foreground">Active Golfers</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                {numberOfRounds}+
              </div>
              <div className="text-muted-foreground">Rounds Logged</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                {numberOfCourses}+
              </div>
              <div className="text-muted-foreground">Courses supported</div>
            </div>
          </div>
        </div>
      </section>
      {/* Testimonials */}
      {/* <section id="testimonials" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Loved by golfers everywhere
            </h2>
            <p className="text-xl text-muted-foreground">
              See how GolfTracker Pro is helping golfers improve their game
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  &quot;Finally dropped below a 10 handicap! The analytics
                  showed me exactly where I was losing strokes. Game
                  changer.&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">Mike Johnson</div>
                    <div className="text-sm text-muted-foreground">
                      Handicap: 9.2
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  &quot;The course mapping and shot tracking are incredibly
                  accurate. Love seeing my improvement over time.&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">Sarah Chen</div>
                    <div className="text-sm text-muted-foreground">
                      Handicap: 12.8
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  &quot;Best golf app I&apos;ve used. The handicap calculation
                  is spot-on and the insights are incredibly helpful.&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">David Rodriguez</div>
                    <div className="text-sm text-muted-foreground">
                      Handicap: 6.4
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section> */}
      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Choose the plan that fits your golfing needs. First 100 users get
              a lifetime free base-plan subscription.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-2 border-primary shadow-lg relative dark:bg-primary/10">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap min-h-6 flex items-center">
                Launch Offer!
              </Badge>
              <CardHeader>
                <CardTitle>
                  Free
                  <p className="text-xs text-muted-foreground">
                    First 100 users, forever
                  </p>
                </CardTitle>
                <CardDescription>
                  Perfect for casual golfers who want to try it out.
                </CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">0$</span>
                  <span className="text-muted-foreground">/forever</span>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/signup">
                  <Button className="w-full mb-6">Sign Up</Button>
                </Link>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Round logging
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Basic handicap calculation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Score history
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Up to 20 rounds
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg dark:bg-primary/10">
              <CardHeader>
                <CardTitle>
                  Premium
                  <p className="text-xs text-muted-foreground invisible">
                    Hidden
                  </p>
                </CardTitle>

                <CardDescription>
                  Expanded features to provide detailed insights
                </CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$9</span>
                  <span className="text-muted-foreground">/year</span>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/signup">
                  <Button className="w-full mb-6">Sign Up</Button>
                </Link>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Everything in Starter
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Up to 100 rounds
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Round calculation insights
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Personal statistics
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg dark:bg-primary/10">
              <CardHeader>
                <CardTitle>
                  Unlimited
                  <p className="text-xs text-muted-foreground invisible">
                    Hidden
                  </p>
                </CardTitle>
                <CardDescription>
                  Unlock your full potential with unlimited usage.
                </CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$19</span>
                  <span className="text-muted-foreground">/year</span>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/signup">
                  <Button className="w-full mb-6">Sign Up</Button>
                </Link>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Unlimited rounds
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Exclusive access to new features
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Priority support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 min-h-4 min-w-4 flex-shrink-0 text-primary" />
                    Access to advanced calculators
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-primary/5 to-primary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to improve your golf game?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join a community of golfers who are already using data to lower
            their scores and improve their game.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="default" className="text-lg px-8">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm mt-4 opacity-75">
            Free <strong>forever</strong> for first 100 users • No credit card
            required • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}

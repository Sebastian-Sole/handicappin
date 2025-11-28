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
import { PricingCard } from "@/components/billing/pricing-card";
import {
  PLAN_FEATURES,
  PLAN_DETAILS,
} from "@/components/billing/plan-features";
import { getPromotionCodeDetails } from "@/lib/stripe";

export default async function Landing() {
  const supabase = await createServerComponentClient();

  const { data: numberOfUsers, error: usersError } = await supabase.rpc(
    "get_public_user_count"
  );

  const { data: numberOfRounds, error: roundsError } = await supabase.rpc(
    "get_public_round_count"
  );

  const { data: numberOfCourses, error: coursesError } = await supabase.rpc(
    "get_public_course_count"
  );

  // Fetch promo code details for launch offer
  const promoDetails = await getPromotionCodeDetails("EARLY100");

  const usersCount =
    usersError || numberOfUsers === null ? 10 : numberOfUsers || 10;
  const roundsCount =
    roundsError || numberOfRounds === null ? 0 : numberOfRounds || 0;
  const coursesCount =
    coursesError || numberOfCourses === null ? 0 : numberOfCourses || 0;

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
            <div className="flex flex-col md:flex-row gap-4 justify-center">
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
                {usersCount > 0 ? usersCount : "10"}+
              </div>
              <div className="text-muted-foreground">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                {roundsCount}+
              </div>
              <div className="text-muted-foreground">Rounds Logged</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">
                {coursesCount}+
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

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <Link href="/signup" className="block">
              <PricingCard
                plan="free"
                price={PLAN_DETAILS.free.price}
                interval={PLAN_DETAILS.free.interval}
                title={PLAN_DETAILS.free.title}
                description={PLAN_DETAILS.free.description}
                features={PLAN_FEATURES.free}
                // badge={{ text: "Launch Offer!", variant: "primary" }}
                buttonText="Sign Up"
                buttonDisabled={false}
              />
            </Link>

            <Link href="/signup" className="block">
              <PricingCard
                plan="premium"
                price={PLAN_DETAILS.premium.price}
                interval={PLAN_DETAILS.premium.interval}
                title={PLAN_DETAILS.premium.title}
                description={PLAN_DETAILS.premium.description}
                features={PLAN_FEATURES.premium}
                buttonText="Sign Up"
                buttonDisabled={false}
                costComparison={PLAN_DETAILS.premium.costComparison}
              />
            </Link>

            <Link href="/signup" className="block">
              <PricingCard
                plan="unlimited"
                price={PLAN_DETAILS.unlimited.price}
                interval={PLAN_DETAILS.unlimited.interval}
                title={PLAN_DETAILS.unlimited.title}
                description={PLAN_DETAILS.unlimited.description}
                features={PLAN_FEATURES.unlimited}
                badge={{ text: "Best Value", variant: "value" }}
                buttonText="Sign Up"
                buttonDisabled={false}
                costComparison={PLAN_DETAILS.unlimited.costComparison}
                highlighted
              />
            </Link>

            <Link href="/signup" className="block">
              <PricingCard
                plan="lifetime"
                price="FREE"
                originalPrice={PLAN_DETAILS.lifetime.price}
                interval={PLAN_DETAILS.lifetime.interval}
                title={PLAN_DETAILS.lifetime.title}
                description={PLAN_DETAILS.lifetime.description}
                features={PLAN_FEATURES.lifetime}
                badge={{ text: "Launch Offer!", variant: "launch" }}
                buttonText="Claim Free Lifetime"
                highlighted
                buttonDisabled={false}
                costComparison={PLAN_DETAILS.lifetime.costComparison}
                slotsRemaining={promoDetails?.remaining}
              />
            </Link>
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

/**
 * Native Hero — mirror of apps/web/components/homepage/hero.tsx (welcome
 * header, handicap display + CTAs, 2×2 stat grid) on the gradient backdrop
 * web builds from primary/accent alphas (hero-gradient is out of the token
 * contract; expo-linear-gradient derives the same stops from tokens —
 * handoff §4).
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Award,
  BarChart2,
  ChevronRight,
  Target,
  TrendingDown,
} from "lucide-react-native";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { tokens } from "@handicappin/tokens/tokens";
import type { RoundRow, TeeInfoRow } from "@/lib/api/schemas/round";
import type { Profile } from "@/lib/api/schemas/profile";
import { useColorMode } from "@/lib/color-mode";
import {
  calculateAverageScore,
  calculateAverageScoreChange,
  calculatePlusMinusScore,
  getAverageScoreChangeDescription,
  getChangeType,
  getHandicapChangeDescription,
} from "@/lib/golf-stats";
import { HandicapDisplay } from "@/components/homepage/handicap-display";
import { StatBox } from "@/components/homepage/stat-box";

const STAT_ICON_SIZE = 32; // allow-hardcoded lucide icon prop mirrors web's fixed h-8 w-8 icon box
const CTA_ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

/** Hex + alpha-byte composition for gradient stops (web: primary/8 → accent/20 → primary/20). */
function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${byte}`;
}

interface HeroProps {
  profile: Profile;
  previousScores: number[];
  initialHandicapIndex: number | null;
  bestRound: RoundRow | null;
  bestRoundTee: TeeInfoRow | null;
  bestRoundCourseName: string | undefined;
  handicapPercentageChange: number;
}

export function Hero({
  profile,
  previousScores,
  initialHandicapIndex,
  bestRound,
  bestRoundTee,
  bestRoundCourseName,
  handicapPercentageChange,
}: HeroProps) {
  const mode = useColorMode();
  const hasPlayedAnyRounds = previousScores.length > 0;

  let averageScoreChangeType: string;
  let averageScoreChangeDescription: string;
  let handicapChangeType: string;
  let handicapChangeDescription: string;
  let bestRoundDescription: string;
  let roundsPlayedDescription: string;
  let bestRoundType: string;
  let roundsPlayedType: string;

  if (!hasPlayedAnyRounds) {
    averageScoreChangeType = "neutral";
    averageScoreChangeDescription = "Log a round to start your progression";
    handicapChangeType = "neutral";
    handicapChangeDescription = "Log a round to start your progression";
    bestRoundType = "neutral";
    bestRoundDescription = "Log a round to start your progression";
    roundsPlayedType = "neutral";
    roundsPlayedDescription = "Log a round to start your progression";
  } else {
    const avgChange = calculateAverageScoreChange(previousScores);
    averageScoreChangeType = getChangeType(avgChange);
    averageScoreChangeDescription =
      getAverageScoreChangeDescription(avgChange);
    handicapChangeType = getChangeType(handicapPercentageChange);
    handicapChangeDescription = getHandicapChangeDescription(
      handicapPercentageChange,
    );
    bestRoundDescription = bestRoundCourseName
      ? `Best round at ${bestRoundCourseName}`
      : "Best round";
    roundsPlayedDescription =
      previousScores.length < 20
        ? "Psst! 20 rounds gives you a complete handicap index!"
        : "You've played a lot of rounds!";
    bestRoundType = "achievement";
    roundsPlayedType = "achievement";
  }

  const primary = tokens.colors[mode].primary;
  const accent = tokens.colors[mode].accent;
  const iconColor = primary;

  return (
    <LinearGradient
      colors={[withAlpha(primary, 0.08), withAlpha(accent, 0.2), withAlpha(primary, 0.2)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.lg,
        }}
      >
        {/* Welcome header */}
        <View className="mb-xl">
          <H1 className="text-heading-4 text-foreground">
            Welcome back, {profile.name?.split(" ")[0] || "Golfer"}
          </H1>
          <Text className="text-body-sm text-muted-foreground mt-xs">
            Member since {new Date(profile.createdAt).getFullYear()}
          </Text>
        </View>

        {/* Handicap display + CTAs */}
        <View className="items-center gap-lg mb-lg">
          <HandicapDisplay
            handicapIndex={profile.handicapIndex}
            previousHandicapIndex={initialHandicapIndex ?? undefined}
            className="py-lg"
          />
          {/* Web stacks these below the sm breakpoint (flex-col sm:flex-row). */}
          <View className="gap-sm w-full">
            <Button
              testID="hero-log-round"
              size="lg"
              className="w-full"
              onPress={() => router.push("/rounds/add" as Href)} // typed-routes-forward-cast
            >
              <View className="flex-row items-center gap-sm">
                <Text className="text-label-sm text-primary-foreground">
                  Log Round
                </Text>
                <ChevronRight
                  size={CTA_ICON_SIZE}
                  color={tokens.colors[mode]["primary-foreground"]}
                />
              </View>
            </Button>
            <Button
              testID="hero-dashboard"
              size="lg"
              variant="outline"
              className="w-full"
              // typed-routes-forward-cast: target lands next cluster
              onPress={() => router.push(`/dashboard/${profile.id}` as Href)}
            >
              Dashboard
            </Button>
          </View>
        </View>

        {/* 2×2 stat grid */}
        <View className="flex-row flex-wrap gap-md">
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatBox
              title="Handicap Index"
              value={profile.handicapIndex.toString()}
              change={handicapChangeType}
              description={handicapChangeDescription}
              icon={<BarChart2 size={STAT_ICON_SIZE} color={iconColor} />}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatBox
              title="Avg. Last 10"
              value={calculateAverageScore(previousScores)}
              change={averageScoreChangeType}
              description={averageScoreChangeDescription}
              icon={<TrendingDown size={STAT_ICON_SIZE} color={iconColor} />}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatBox
              title="Best Round"
              value={calculatePlusMinusScore(
                bestRound?.adjustedGrossScore,
                bestRoundTee?.totalPar,
              )}
              change={bestRoundType}
              description={bestRoundDescription}
              icon={<Award size={STAT_ICON_SIZE} color={iconColor} />}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatBox
              title="Rounds Played"
              value={previousScores.length.toString()}
              change={roundsPlayedType}
              description={roundsPlayedDescription}
              icon={<Target size={STAT_ICON_SIZE} color={iconColor} />}
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

/**
 * Shared statistics primitives — native mirrors of
 * apps/web/components/statistics/shared/statistics-section.tsx,
 * overview/stat-card.tsx, hero/player-identity-card.tsx and the inner Tabs.
 */
import { ChevronDown } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Card, CardContent } from "@/components/ui/card";
import { StatDelta } from "@/components/ui/stat-delta";
import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { formatGolfAge } from "@/lib/statistics/format-utils";
import type { PlayerTypeResult } from "@/lib/statistics/types";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

export function StatisticsSection({
  icon,
  title,
  description,
  learnMoreContent,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  learnMoreContent?: ReactNode;
  children: ReactNode;
}) {
  const mode = useColorMode();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="gap-md">
      <View className="flex-row items-start gap-md">
        <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
          <Text className="text-body">{icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-heading-3 text-foreground">{title}</Text>
          {description ? (
            <Text className="text-body-sm text-muted-foreground mt-xs">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View>{children}</View>
      {learnMoreContent ? (
        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsOpen((open) => !open)}
            className="flex-row items-center gap-sm"
          >
            <View className={cn(isOpen && "rotate-180")}>
              <ChevronDown
                size={ICON_SIZE}
                color={tokens.colors[mode]["muted-foreground"]}
              />
            </View>
            <Text className="text-body-sm text-muted-foreground">
              {isOpen ? "Hide" : "Learn more"}
            </Text>
          </Pressable>
          {isOpen ? (
            <View className="mt-md surface-muted p-md rounded-lg">
              {typeof learnMoreContent === "string" ? (
                <Text className="text-body-sm text-muted-foreground">
                  {learnMoreContent}
                </Text>
              ) : (
                learnMoreContent
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  className,
  valueClassName,
  centered,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
  centered?: boolean;
}) {
  return (
    <Card className={className}>
      <CardContent className={cn("p-md pt-md", centered && "items-center")}>
        <Text className="text-body-sm text-muted-foreground">{title}</Text>
        <Text className={cn("text-figure text-foreground", valueClassName)}>
          {value}
        </Text>
        {subtitle ? (
          <Text
            className={cn(
              "text-meta text-muted-foreground",
              centered && "text-center",
            )}
          >
            {subtitle}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Simple segmented tabs matching web's TabsList grid. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-lg bg-muted p-xs mb-lg">
      {tabs.map((tab) => (
        <Pressable
          key={tab.value}
          testID={`stats-tab-${tab.value}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.value }}
          onPress={() => onChange(tab.value)}
          className={cn(
            "flex-1 items-center justify-center rounded-md py-sm",
            value === tab.value && "bg-background",
          )}
        >
          <Text
            className={cn(
              "text-label-sm",
              value === tab.value
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PlayerIdentityCard({
  playerType,
  currentHandicap,
  handicapChange,
  totalRounds,
  golfAgeDays,
  daysSinceLastRound,
}: {
  playerType: PlayerTypeResult;
  currentHandicap: number;
  handicapChange: number;
  totalRounds: number;
  golfAgeDays: number;
  daysSinceLastRound: number;
}) {
  const formatHandicap = (handicap: number) =>
    Number.isFinite(handicap) ? handicap.toFixed(1) : "N/A";

  const handicapChangeText =
    handicapChange === 0
      ? "No change"
      : `${handicapChange < 0 ? "Down" : "Up"} ${Math.abs(handicapChange).toFixed(1)} since starting`;

  const playNudge =
    daysSinceLastRound === 0
      ? { text: "Played today!", urgent: false }
      : daysSinceLastRound === 1
        ? { text: "Yesterday", urgent: false }
        : daysSinceLastRound <= 14
          ? { text: `${daysSinceLastRound} days ago`, urgent: false }
          : { text: `${daysSinceLastRound} days - time to play!`, urgent: true };

  return (
    <Card className="mb-xl tint-primary overflow-hidden" testID="player-identity-card">
      <CardContent className="p-lg pt-lg">
        <View className="items-center mb-lg">
          <Text className="text-figure-3xl mb-sm">{playerType.emoji}</Text>
          <Text className="text-figure text-foreground mb-sm">
            {playerType.name}
          </Text>
          <Text className="text-body text-muted-foreground text-center">
            {playerType.description}
          </Text>
          <View className="mt-sm chip-primary rounded-full px-sm py-xs">
            <Text className="text-meta text-muted-foreground">
              {Math.round(playerType.confidence * 100)}% match
            </Text>
          </View>
        </View>

        <View className="gap-md mt-xl">
          <View className="items-center p-md surface-raised rounded-lg">
            <View className="flex-row items-center justify-center gap-sm">
              <Text className="text-figure-xl text-foreground">
                {formatHandicap(currentHandicap)}
              </Text>
              {handicapChange !== 0 ? (
                <StatDelta value={handicapChange} invert iconOnly />
              ) : null}
            </View>
            <Text className="text-body-sm text-muted-foreground mt-xs">
              Handicap Index
            </Text>
            <Text className="text-meta text-muted-foreground">
              {handicapChangeText}
            </Text>
          </View>
          <View className="flex-row gap-md">
            <View className="flex-1 items-center p-md surface-raised rounded-lg">
              <Text className="text-figure-xl text-foreground">
                {totalRounds}
              </Text>
              <Text className="text-body-sm text-muted-foreground mt-xs">
                Total Rounds
              </Text>
              <Text className="text-meta text-muted-foreground">
                over {formatGolfAge(golfAgeDays)}
              </Text>
            </View>
            <View className="flex-1 items-center p-md surface-raised rounded-lg">
              <Text
                className={cn(
                  "text-figure-xl",
                  playNudge.urgent ? "text-warning" : "text-foreground",
                )}
              >
                {daysSinceLastRound > 0 ? daysSinceLastRound : "0"}
              </Text>
              <Text className="text-body-sm text-muted-foreground mt-xs">
                Days Since Round
              </Text>
              <Text
                className={cn(
                  "text-meta",
                  playNudge.urgent
                    ? "text-warning font-medium"
                    : "text-muted-foreground",
                )}
              >
                {playNudge.text}
              </Text>
            </View>
          </View>
        </View>
      </CardContent>
    </Card>
  );
}

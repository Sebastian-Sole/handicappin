/**
 * Dashboard — native twin of apps/web/app/dashboard/[id]/page.tsx +
 * components/dashboard/* (the Rounds tab, D5). Handicap info card,
 * Recent Rounds header card (web hides the score chart below the sm
 * breakpoint, so the phone surfaces carry no chart), and the full
 * rounds-history table. Requires unlimited/lifetime (the tRPC procedure
 * enforces it; free users get the upgrade prompt, mirroring web's
 * middleware redirect).
 */
import { useQuery } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { RoundsTable } from "@/components/dashboard/rounds-table";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { H2, H4, P } from "@/components/ui/typography";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { scorecardsQueryOptions } from "@/lib/api/procedures/scorecard";
import { useSession } from "@/lib/auth/session-provider";
import { getRandomHeader } from "@/lib/frivolities";
import { useDataSettled } from "@/lib/query/settle";

export default function DashboardScreen() {
  const { session, initializing } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [header] = useState(getRandomHeader);

  const routeId = typeof params.id === "string" ? params.id : null;
  const userId = session?.user.id ?? null;

  const scorecardsQuery = useQuery({
    ...scorecardsQueryOptions(userId ?? ""),
    enabled: userId != null && routeId === userId,
  });
  const profileQuery = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const settled = useDataSettled([scorecardsQuery, profileQuery]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  // Web: "Invalid user, this is not your profile" for other ids.
  if (routeId && userId && routeId !== userId) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-lg">
        <Text className="text-body text-muted-foreground">
          Invalid user, this is not your profile
        </Text>
      </View>
    );
  }

  const scorecards = scorecardsQuery.data ?? [];
  const profile = profileQuery.data;

  // The procedure rejects non-unlimited plans — mirror web's gate with the
  // upgrade message instead of a dead screen.
  if (scorecardsQuery.isError) {
    return (
      <View
        testID="dashboard-screen"
        className="flex-1 bg-background items-center justify-center p-lg gap-md"
      >
        <DataSettledMarker settled={settled} />
        <H2 className="text-center">Unlimited plan required</H2>
        <Text className="text-body text-muted-foreground text-center">
          {scorecardsQuery.error instanceof Error
            ? scorecardsQuery.error.message
            : "This page requires an Unlimited or Lifetime plan."}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          Go back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      testID="dashboard-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.xl,
      }}
    >
      <DataSettledMarker settled={settled} />

      {/* Handicap info card (web's DashboardInfo) */}
      <View className="surface p-lg rounded-lg">
        <H2 className="mb-md">Handicap</H2>
        <Text className="text-figure-3xl text-primary">
          {profile?.handicapIndex ?? "—"}
        </Text>
        <Text className="text-body text-muted-foreground">
          Current Handicap
        </Text>
        <Button
          variant="link"
          className="self-start px-0 mb-md"
          // typed-routes-forward-cast: target lands later this cluster
          onPress={() => router.push("/calculators" as Href)}
        >
          How is my handicap calculated?
        </Button>
        <H4 className="mb-sm">{header}</H4>
        <P className="mt-md">
          Handicappin&apos; believes in transparency and making golf
          accessible. It can be difficult to find accurate and consistent
          information on the calculations of scores, handicaps and the rules
          of golf online. We aim to be a reliable source of information and
          aim to ease the unnecessary confusion around golf.
        </P>
        <P className="mt-md">
          An easy, interactive way to understand the calculations behind
          handicaps and scoring can be viewed by clicking the button below,
          or by viewing a specific round&apos;s calculation.
        </P>
        <Button
          variant="link"
          className="self-start px-0"
          // typed-routes-forward-cast: target lands later this cluster
          onPress={() => router.push("/calculators" as Href)}
        >
          Click here to learn more
        </Button>
      </View>

      {/* Recent Rounds header card — web hides the chart below sm. */}
      <View className="surface p-lg rounded-lg">
        <View className="flex-row items-center justify-between mb-md">
          <H2 className="pb-0">Recent Rounds</H2>
          <Button variant="link" onPress={() => router.push("/rounds/add")}>
            Add a round
          </Button>
        </View>
      </View>

      <RoundsTable scorecards={scorecards} />
    </ScrollView>
  );
}

/**
 * Calculators — native twin of apps/web/app/calculators (header, category
 * tabs, linked values). The four CORE calculators are fully interactive
 * with values linking between them, all math from @handicappin/handicap-core
 * or the same WHS formulas web uses. Advanced + Educational calculators are
 * listed with a visible pointer to the website (logged deferral — they're
 * exploratory widgets, not data surfaces).
 */
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import {
  calculateHandicapIndex,
  getRelevantDifferentials,
} from "@handicappin/handicap-core";
import { tokens } from "@handicappin/tokens/tokens";

import { DataSettledMarker } from "@/components/data-settled";
import { SegmentedTabs } from "@/components/statistics/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { H1, H3 } from "@/components/ui/typography";
import { useSession } from "@/lib/auth/session-provider";
import { SITE_URL } from "@/lib/legal";
import { cn } from "@/lib/utils";

type Category = "core" | "advanced" | "educational";

interface LinkedValues {
  handicapIndex: number | null;
  slopeRating: number | null;
  courseRating: number | null;
  par: number | null;
  adjustedGrossScore: number | null;
  courseHandicap: number | null;
}

const WEB_ONLY_CALCULATORS: Record<
  Exclude<Category, "core">,
  { name: string; description: string }[]
> = {
  advanced: [
    { name: "Playing Handicap", description: "Competition allowances applied to your course handicap" },
    { name: "What-If Scenario", description: "How would a given round change your index?" },
    { name: "Exceptional Score Reduction", description: "ESR triggers and their effect" },
    { name: "Target Score", description: "What you need to shoot to hit a goal index" },
  ],
  educational: [
    { name: "Soft & Hard Cap Visualizer", description: "How the WHS caps rapid increases" },
    { name: "9-Hole Equivalency", description: "How 9-hole rounds become 18-hole differentials" },
    { name: "Strokes Received", description: "Where your handicap strokes land hole-by-hole" },
    { name: "Maximum Hole Score", description: "Net double bogey, visualized" },
  ],
};

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  testID?: string;
}) {
  return (
    <View className="gap-xs flex-1" style={{ minWidth: "45%" }}>
      <Label className="text-meta">{label}</Label>
      <Input
        testID={testID}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        value={value === null ? "" : String(value)}
        onChangeText={(text) => {
          if (text.trim() === "") {
            onChange(null);
            return;
          }
          const parsed = Number.parseFloat(text);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
        className="h-9"
      />
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-body font-medium text-foreground">{label}</Text>
      <Text className="text-figure-lg text-primary">{value}</Text>
    </View>
  );
}

export default function CalculatorsScreen() {
  const { session, initializing } = useSession();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<Category>("core");
  const [values, setValues] = useState<LinkedValues>({
    handicapIndex: null,
    slopeRating: 113,
    courseRating: null,
    par: null,
    adjustedGrossScore: null,
    courseHandicap: null,
  });
  const [differentials, setDifferentials] = useState<number[]>([]);
  const [newDifferential, setNewDifferential] = useState("");

  const setValue = <K extends keyof LinkedValues>(
    key: K,
    value: LinkedValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  // Course Handicap (WHS 6.1a) — links into net score below.
  const courseHandicap = useMemo(() => {
    const { handicapIndex, slopeRating, courseRating, par } = values;
    if (
      handicapIndex === null ||
      slopeRating === null ||
      courseRating === null ||
      par === null
    ) {
      return null;
    }
    return Math.round(
      handicapIndex * (slopeRating / 113) + (courseRating - par),
    );
  }, [values]);

  const scoreDifferential = useMemo(() => {
    const { adjustedGrossScore, courseRating, slopeRating } = values;
    if (
      adjustedGrossScore === null ||
      courseRating === null ||
      slopeRating === null ||
      slopeRating === 0
    ) {
      return null;
    }
    return (
      Math.round(((adjustedGrossScore - courseRating) * 113 * 10) / slopeRating) /
      10
    );
  }, [values]);

  const handicapIndexResult = useMemo(() => {
    if (differentials.length < 3) return null;
    return calculateHandicapIndex(differentials);
  }, [differentials]);

  const relevantDifferentials = useMemo(() => {
    if (differentials.length === 0) return [];
    const sorted = [...differentials].sort((a, b) => a - b);
    return getRelevantDifferentials(sorted);
  }, [differentials]);

  const netScore = useMemo(() => {
    if (values.adjustedGrossScore === null || courseHandicap === null) {
      return null;
    }
    return values.adjustedGrossScore - courseHandicap;
  }, [values.adjustedGrossScore, courseHandicap]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <ScrollView
      testID="calculators-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
        gap: tokens.spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <DataSettledMarker settled />

      <View className="items-center gap-md">
        <H1 className="text-center">Golf Calculators</H1>
        <Text className="text-body text-muted-foreground text-center">
          WHS-compliant calculators to help you understand your handicap.
          Values automatically link between calculators.
        </Text>
      </View>

      <SegmentedTabs
        tabs={[
          { value: "core", label: "Core" },
          { value: "advanced", label: "Advanced" },
          { value: "educational", label: "Educational" },
        ]}
        value={category}
        onChange={setCategory}
      />

      {category === "core" ? (
        <View className="gap-lg" testID="calculators-core">
          {/* Course Handicap */}
          <Card>
            <CardHeader className="pb-sm gap-xs">
              <H3>Course Handicap</H3>
              <Text className="text-body-sm text-muted-foreground">
                Strokes you receive on this course and tee
              </Text>
            </CardHeader>
            <CardContent className="gap-md">
              <View className="flex-row flex-wrap gap-md">
                <NumberInput
                  testID="calc-handicap-index"
                  label="Handicap Index"
                  value={values.handicapIndex}
                  onChange={(v) => setValue("handicapIndex", v)}
                  placeholder="14.2"
                />
                <NumberInput
                  label="Slope Rating"
                  value={values.slopeRating}
                  onChange={(v) => setValue("slopeRating", v)}
                  placeholder="113"
                />
                <NumberInput
                  label="Course Rating"
                  value={values.courseRating}
                  onChange={(v) => setValue("courseRating", v)}
                  placeholder="72.3"
                />
                <NumberInput
                  label="Par"
                  value={values.par}
                  onChange={(v) => setValue("par", v)}
                  placeholder="72"
                />
              </View>
              <View className="formula-box rounded-lg p-md">
                <ResultRow
                  label="Course Handicap:"
                  value={courseHandicap !== null ? String(courseHandicap) : "—"}
                />
                <Text className="text-meta text-muted-foreground mt-xs">
                  Handicap Index × (Slope ÷ 113) + (Course Rating − Par)
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Score Differential */}
          <Card>
            <CardHeader className="pb-sm gap-xs">
              <H3>Score Differential</H3>
              <Text className="text-body-sm text-muted-foreground">
                Your performance normalized for course difficulty
              </Text>
            </CardHeader>
            <CardContent className="gap-md">
              <View className="flex-row flex-wrap gap-md">
                <NumberInput
                  testID="calc-ags"
                  label="Adjusted Gross Score"
                  value={values.adjustedGrossScore}
                  onChange={(v) => setValue("adjustedGrossScore", v)}
                  placeholder="85"
                />
                <NumberInput
                  label="Course Rating"
                  value={values.courseRating}
                  onChange={(v) => setValue("courseRating", v)}
                  placeholder="72.3"
                />
                <NumberInput
                  label="Slope Rating"
                  value={values.slopeRating}
                  onChange={(v) => setValue("slopeRating", v)}
                  placeholder="113"
                />
              </View>
              <View className="formula-box rounded-lg p-md">
                <ResultRow
                  label="Score Differential:"
                  value={
                    scoreDifferential !== null
                      ? scoreDifferential.toFixed(1)
                      : "—"
                  }
                />
                <Text className="text-meta text-muted-foreground mt-xs">
                  (Adjusted Gross − Course Rating) × 113 ÷ Slope
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Handicap Index */}
          <Card>
            <CardHeader className="pb-sm gap-xs">
              <H3>Handicap Index</H3>
              <Text className="text-body-sm text-muted-foreground">
                From your score differentials (best of recent, per WHS 5.2)
              </Text>
            </CardHeader>
            <CardContent className="gap-md">
              <View className="flex-row gap-sm items-end">
                <View className="flex-1">
                  <NumberInput
                    testID="calc-differential-entry"
                    label="Add a differential"
                    value={
                      newDifferential === ""
                        ? null
                        : Number.parseFloat(newDifferential)
                    }
                    onChange={(v) =>
                      setNewDifferential(v === null ? "" : String(v))
                    }
                    placeholder="12.4"
                  />
                </View>
                <Button
                  testID="calc-add-differential"
                  variant="outline"
                  onPress={() => {
                    const value = Number.parseFloat(newDifferential);
                    if (!Number.isNaN(value)) {
                      setDifferentials((prev) => [...prev, value]);
                      setNewDifferential("");
                    }
                  }}
                >
                  Add
                </Button>
              </View>
              {differentials.length > 0 ? (
                <View className="flex-row flex-wrap gap-sm">
                  {differentials.map((diff, index) => {
                    const used = relevantDifferentials.includes(diff);
                    return (
                      <Pressable
                        key={`${diff}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove differential ${diff}`}
                        onPress={() =>
                          setDifferentials((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                        className={cn(
                          "rounded-full px-sm py-xs border",
                          used ? "chip-primary" : "bg-muted border-muted",
                        )}
                      >
                        <Text
                          className={cn(
                            "text-meta",
                            used ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {diff.toFixed(1)} ✕
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <View className="formula-box rounded-lg p-md">
                <ResultRow
                  label="Handicap Index:"
                  value={
                    handicapIndexResult !== null
                      ? handicapIndexResult.toFixed(1)
                      : differentials.length < 3
                        ? "3+ needed"
                        : "—"
                  }
                />
                <Text className="text-meta text-muted-foreground mt-xs">
                  Average of your best recent differentials (highlighted)
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Net Score */}
          <Card>
            <CardHeader className="pb-sm gap-xs">
              <H3>Net Score</H3>
              <Text className="text-body-sm text-muted-foreground">
                Gross score adjusted by your course handicap
              </Text>
            </CardHeader>
            <CardContent className="gap-md">
              <Text className="text-meta text-muted-foreground">
                Links from the calculators above: gross score{" "}
                {values.adjustedGrossScore ?? "—"}, course handicap{" "}
                {courseHandicap ?? "—"}.
              </Text>
              <View className="formula-box rounded-lg p-md">
                <ResultRow
                  label="Net Score:"
                  value={netScore !== null ? String(netScore) : "—"}
                />
                <Text className="text-meta text-muted-foreground mt-xs">
                  Gross Score − Course Handicap
                </Text>
              </View>
            </CardContent>
          </Card>
        </View>
      ) : (
        <View className="gap-md" testID={`calculators-${category}`}>
          {WEB_ONLY_CALCULATORS[category].map((calc) => (
            <Card key={calc.name}>
              <CardContent className="pt-md gap-xs">
                <Text className="text-heading-5 text-foreground">
                  {calc.name}
                </Text>
                <Text className="text-body-sm text-muted-foreground">
                  {calc.description}
                </Text>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            onPress={() => {
              void WebBrowser.openBrowserAsync(`${SITE_URL}/calculators`);
            }}
          >
            Open interactive versions on handicappin.com
          </Button>
        </View>
      )}

      <Button variant="link" onPress={() => router.back()}>
        Back
      </Button>
    </ScrollView>
  );
}

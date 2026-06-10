/**
 * Courses tab — native mirror of apps/web/components/statistics/courses/
 * courses-section.tsx (overview cards, highlight cards, all-courses table
 * linking to the per-course detail).
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { getFlagEmoji } from "@/lib/frivolities";
import {
  formatDecimal,
  formatDifferential,
  formatScore,
} from "@/lib/statistics/format-utils";
import type { CoursePerformance } from "@/lib/statistics/types";

import { StatCard, StatisticsSection } from "./shared";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface CoursesTabProps {
  courses: CoursePerformance[];
  uniqueCourses: number;
  totalRounds: number;
}

function HighlightCard({
  tint,
  title,
  course,
  detail,
  detailClass,
}: {
  tint: string;
  title: string;
  course: CoursePerformance;
  detail: string;
  detailClass: string;
}) {
  return (
    <Card className={tint}>
      <CardHeader className="pb-sm">
        <Text className="text-body-sm text-muted-foreground">{title}</Text>
      </CardHeader>
      <CardContent>
        <Text className="text-body font-semibold text-foreground">
          {getFlagEmoji(course.country)} {course.courseName}
        </Text>
        <Text className="text-body-sm text-muted-foreground">
          {course.roundCount} round{course.roundCount !== 1 ? "s" : ""}
        </Text>
        <Text className={`text-meta-strong mt-xs ${detailClass}`}>
          {detail}
        </Text>
      </CardContent>
    </Card>
  );
}

export function CoursesTab({
  courses,
  uniqueCourses,
  totalRounds,
}: CoursesTabProps) {
  const mode = useColorMode();

  if (courses.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No course data yet"
            description="Play more rounds to see course analytics"
          />
        </CardContent>
      </Card>
    );
  }

  const bestCourse = [...courses].sort(
    (a, b) => a.avgDifferential - b.avgDifferential,
  )[0]!;
  const worstCourse = [...courses].sort(
    (a, b) => b.avgDifferential - a.avgDifferential,
  )[0]!;
  const mostPlayed = courses.reduce((max, course) =>
    course.roundCount > max.roundCount ? course : max,
  );
  const varietyScore =
    totalRounds > 0 ? Math.round((uniqueCourses / totalRounds) * 100) : 0;
  const uniqueCountries = new Set(courses.map((c) => c.country)).size;
  const homeCourse = mostPlayed.roundCount >= 3 ? mostPlayed : null;

  const getVarietyLabel = (score: number): string => {
    if (score >= 70) return "Explorer";
    if (score >= 50) return "Adventurous";
    if (score >= 30) return "Balanced";
    return "Home Course Hero";
  };

  return (
    <View className="gap-xl" testID="courses-tab">
      <StatisticsSection
        icon="⛳"
        title="Course Overview"
        description="Your golfing journey across different courses"
      >
        <View className="flex-row flex-wrap gap-md">
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Courses Played"
              value={uniqueCourses}
              subtitle="unique courses"
              valueClassName="text-figure-lg"
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Countries"
              value={uniqueCountries}
              subtitle={`countr${uniqueCountries !== 1 ? "ies" : "y"} visited`}
              valueClassName="text-figure-lg"
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Variety Score"
              value={`${varietyScore}%`}
              subtitle={getVarietyLabel(varietyScore)}
              valueClassName="text-figure-lg"
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Avg Rounds/Course"
              value={
                uniqueCourses > 0
                  ? formatDecimal(totalRounds / uniqueCourses, 1)
                  : "—"
              }
              subtitle="rounds per course"
              valueClassName="text-figure-lg"
            />
          </View>
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="🏆"
        title="Course Highlights"
        description="Your most played and best performing courses"
      >
        <View className="gap-md">
          {homeCourse ? (
            <HighlightCard
              tint="tint-info"
              title="🏠 Home Course"
              course={homeCourse}
              detail={`Avg diff: ${formatDifferential(homeCourse.avgDifferential)}`}
              detailClass="text-info"
            />
          ) : null}
          <HighlightCard
            tint="tint-success"
            title="✅ Best Performance"
            course={bestCourse}
            detail={`${formatDifferential(bestCourse.avgDifferential)} avg diff`}
            detailClass="text-success"
          />
          <HighlightCard
            tint="tint-warning"
            title="💪 Challenging Course"
            course={worstCourse}
            detail={`${formatDifferential(worstCourse.avgDifferential)} avg diff`}
            detailClass="text-warning"
          />
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="📋"
        title="All Courses"
        description={`Performance data across ${courses.length} course${courses.length !== 1 ? "s" : ""}`}
        learnMoreContent="The Avg Diff column is your average score differential at that course — lower is better."
      >
        <Card>
          <CardContent className="p-0 pt-0">
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row border-b border-border">
                  <Text
                    className="text-label-sm text-foreground px-md py-sm"
                    style={{ width: 220 }}
                  >
                    Course
                  </Text>
                  <Text
                    className="text-label-sm text-foreground px-md py-sm text-right"
                    style={{ width: 80 }}
                  >
                    Rounds
                  </Text>
                  <Text
                    className="text-label-sm text-foreground px-md py-sm text-right"
                    style={{ width: 90 }}
                  >
                    Avg Diff
                  </Text>
                  <Text
                    className="text-label-sm text-foreground px-md py-sm text-right"
                    style={{ width: 80 }}
                  >
                    Best
                  </Text>
                  <Text
                    className="text-label-sm text-foreground px-md py-sm text-right"
                    style={{ width: 90 }}
                  >
                    Avg Score
                  </Text>
                </View>
                {courses.map((course) => (
                  <Pressable
                    key={course.courseId}
                    accessibilityRole="link"
                    accessibilityLabel={`View detail for ${course.courseName}`}
                    onPress={() =>
                      router.push(
                        `/statistics/courses/${course.courseId}` as Href,
                      )
                    }
                    className="flex-row border-b border-border items-center active:opacity-70"
                  >
                    <View
                      className="flex-row items-center gap-xs px-md py-sm"
                      style={{ width: 220 }}
                    >
                      <Text className="text-body-sm text-foreground" numberOfLines={1}>
                        {getFlagEmoji(course.country)} {course.courseName}
                      </Text>
                      <ChevronRight
                        size={ICON_SIZE}
                        color={tokens.colors[mode]["muted-foreground"]}
                      />
                    </View>
                    <Text
                      className="text-body-sm text-foreground px-md py-sm text-right"
                      style={{ width: 80 }}
                    >
                      {course.roundCount}
                    </Text>
                    <Text
                      className="text-body-sm text-foreground px-md py-sm text-right"
                      style={{ width: 90 }}
                    >
                      {formatDifferential(course.avgDifferential)}
                    </Text>
                    <Text
                      className="text-body-sm text-foreground px-md py-sm text-right"
                      style={{ width: 80 }}
                    >
                      {formatDifferential(course.bestDifferential)}
                    </Text>
                    <Text
                      className="text-body-sm text-foreground px-md py-sm text-right"
                      style={{ width: 90 }}
                    >
                      {formatScore(course.avgScore)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </CardContent>
        </Card>
      </StatisticsSection>
    </View>
  );
}

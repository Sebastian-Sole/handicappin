/**
 * Native RoundsTable — mirror of apps/web/components/dashboard/
 * roundsTable.tsx: surface card with title, search, sortable column
 * headers (tap to toggle ↑↓), 20-per-page rows, View Calculation links,
 * empty states. The web table overflows horizontally at phone width; the
 * native twin scrolls horizontally the same way.
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import { ListChecks } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { tokens } from "@handicappin/tokens/tokens";
import type { ScorecardWithRound } from "@/lib/api/schemas/scorecard";
import { useColorMode } from "@/lib/color-mode";

const ICON_SIZE = 20; // allow-hardcoded lucide icon prop mirrors web's fixed h-5 w-5 icon box
const PAGE_SIZE = 20;

type SortColumn =
  | "teeTime"
  | "course.name"
  | "round.adjustedGrossScore"
  | "round.parPlayed"
  | "round.scoreDifferential"
  | "round.exceptionalScoreAdjustment";

// Date column shows the day only (web shows date+time): mobile density —
// the tighter column was an owner ask (D20). Tap the row for full detail.
const COLUMNS: { column: SortColumn; label: string; width: number }[] = [
  { column: "teeTime", label: "Date", width: 110 },
  { column: "course.name", label: "Course", width: 180 },
  { column: "round.adjustedGrossScore", label: "Score", width: 80 },
  { column: "round.parPlayed", label: "Par", width: 70 },
  { column: "round.scoreDifferential", label: "Differential", width: 110 },
  { column: "round.exceptionalScoreAdjustment", label: "Adjustment", width: 110 },
];

function sortValue(scorecard: ScorecardWithRound, column: SortColumn) {
  switch (column) {
    case "course.name":
      return scorecard.course.name;
    case "round.adjustedGrossScore":
      return scorecard.round.adjustedGrossScore;
    case "round.parPlayed":
      return scorecard.round.parPlayed;
    case "round.scoreDifferential":
      return scorecard.round.scoreDifferential;
    case "round.exceptionalScoreAdjustment":
      return scorecard.round.exceptionalScoreAdjustment;
    default:
      return scorecard.teeTime;
  }
}

interface RoundsTableProps {
  scorecards: ScorecardWithRound[];
  title?: string;
  showSearch?: boolean;
  showPagination?: boolean;
}

export function RoundsTable({
  scorecards,
  title = "Rounds History",
  showSearch = true,
  showPagination = true,
}: RoundsTableProps) {
  const mode = useColorMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("teeTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filteredAndSorted = useMemo(() => {
    const filtered = scorecards
      .filter((scorecard) => {
        const term = searchTerm.toLowerCase();
        return (
          scorecard.teeTime.toLowerCase().includes(term) ||
          scorecard.course.name.toLowerCase().includes(term) ||
          scorecard.round.adjustedGrossScore.toString().includes(searchTerm) ||
          scorecard.round.parPlayed.toString().includes(searchTerm)
        );
      })
      .sort((a, b) => {
        const columnA = sortValue(a, sortColumn);
        const columnB = sortValue(b, sortColumn);
        if (columnA == null || columnB == null) return 0;
        if (columnA < columnB) return sortDirection === "asc" ? -1 : 1;
        if (columnA > columnB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    return filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  }, [scorecards, searchTerm, sortColumn, sortDirection, page]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const totalPages = Math.ceil(scorecards.length / PAGE_SIZE);

  return (
    <View className="surface p-lg rounded-lg" testID="rounds-table">
      <Text className="text-heading-2 text-foreground pb-sm mb-md">
        {title}
      </Text>

      {showSearch ? (
        <View className="mb-md">
          <Input
            testID="rounds-search"
            placeholder="Search rounds..."
            value={searchTerm}
            onChangeText={(value) => {
              setSearchTerm(value);
              setPage(0);
            }}
          />
        </View>
      ) : null}

      {filteredAndSorted.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
            <View className="flex-row border-b border-border">
              {COLUMNS.map(({ column, label, width }) => (
                <Pressable
                  key={column}
                  accessibilityRole="button"
                  onPress={() => handleSort(column)}
                  className="flex-row items-center gap-xs px-md py-sm"
                  style={{ width }}
                >
                  <Text className="text-label-sm text-primary font-bold">
                    {label}
                  </Text>
                  {sortColumn === column ? (
                    <Text className="text-label-sm text-primary">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {/* Data rows — the WHOLE row navigates (owner ask, D20); the
                web-only "View Calculation" link column is folded into it.
                The row is WIDER than the scroll viewport, so it must NOT be
                the accessibility element: a flattened row's activation
                point is its unclipped center, which sits OUTSIDE the
                viewport where taps die. The narrow date cell carries the
                button semantics instead — its center is always visible, and
                its activation falls through to the row Pressable. */}
            {filteredAndSorted.map((scorecard) => (
              <Pressable
                key={scorecard.round.id}
                accessible={false}
                onPress={() =>
                  router.push(
                    // typed-routes-forward-cast: target lands this cluster
                    `/rounds/${scorecard.round.id}/calculation` as Href,
                  )
                }
                className="flex-row border-b border-border items-center active:bg-muted"
              >
                <Text
                  accessibilityRole="button"
                  accessibilityLabel={`View calculation for ${scorecard.course.name}, ${new Date(scorecard.teeTime).toLocaleDateString()}`}
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 110 }}
                >
                  {new Date(scorecard.teeTime).toLocaleDateString()}
                </Text>
                <Text
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 180 }}
                  numberOfLines={1}
                >
                  {scorecard.course.name}
                </Text>
                <Text
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 80 }}
                >
                  {scorecard.round.adjustedGrossScore}
                </Text>
                <Text
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 70 }}
                >
                  {scorecard.round.parPlayed}
                </Text>
                <Text
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 110 }}
                >
                  {Math.round(scorecard.round.scoreDifferential * 10) / 10}
                </Text>
                <Text
                  className="text-body-sm text-foreground px-md py-sm"
                  style={{ width: 110 }}
                >
                  {scorecard.round.exceptionalScoreAdjustment
                    ? Math.round(
                        scorecard.round.exceptionalScoreAdjustment * 10,
                      ) / 10
                    : 0}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : scorecards.length === 0 ? (
        <EmptyState
          icon={
            <ListChecks
              size={ICON_SIZE}
              color={tokens.colors[mode]["muted-foreground"]}
            />
          }
          title="No rounds logged yet"
          description="Start tracking your handicap by adding your first round."
          action={
            <Button onPress={() => router.push("/rounds/add")}>
              Add Your First Round
            </Button>
          }
        />
      ) : (
        <View className="mt-md items-center">
          <Text className="text-body text-muted-foreground">
            No rounds found for search: &quot;{searchTerm}&quot;
          </Text>
        </View>
      )}

      {showPagination && scorecards.length > PAGE_SIZE ? (
        <View className="flex-row items-center justify-center gap-md mt-md">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Text className="text-body-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </Text>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </View>
      ) : null}
    </View>
  );
}

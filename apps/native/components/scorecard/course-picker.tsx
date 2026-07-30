/**
 * Course picker — native equivalent of web's course combobox (Popover +
 * Command search). A modal sheet with a search field over the REAL
 * course.searchCourses query; before any term is typed it lists the user's
 * recently played courses (course.getRecentCourses), mirroring web's
 * "Recent courses" group. Adding new courses is deferred to web
 * (implementation log), mirroring the dialog web opens from this spot.
 */
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tokens } from "@handicappin/tokens/tokens";
import {
  courseSearchQueryOptions,
  recentCoursesQueryOptions,
  type RecentCourse,
} from "@/lib/api/procedures/scorecard";
import { useColorMode } from "@/lib/color-mode";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface CoursePickerProps {
  selectedLabel: string;
  /** Receives the wider RecentCourse shape (approvalStatus may be
      "pending"); plain search results are a subtype of it. */
  onSelect: (course: RecentCourse) => void;
  disabled?: boolean;
  /** Opens the add-course dialog, prefilled with the search term (D21). */
  onRequestAddCourse?: (initialName: string) => void;
}

export function CoursePicker({
  selectedLabel,
  onSelect,
  disabled,
  onRequestAddCourse,
}: CoursePickerProps) {
  const mode = useColorMode();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debounced = useDebouncedValue(searchTerm, 600);

  const search = useQuery({
    ...courseSearchQueryOptions(debounced),
    enabled: open && debounced.length > 0,
  });

  // Fetched eagerly (screen mount, not sheet open) so recently played
  // courses are already listed the instant the sheet opens — mirrors web.
  const recent = useQuery(recentCoursesQueryOptions());
  const recentCourses = recent.data ?? [];

  return (
    <>
      <Button
        testID="course-picker-trigger"
        variant="outline"
        className="w-full"
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <View className="flex-row items-center justify-between w-full">
          <Text
            className="text-label-sm text-foreground flex-1"
            numberOfLines={1}
          >
            {selectedLabel}
          </Text>
          <ChevronsUpDown
            size={ICON_SIZE}
            color={tokens.colors[mode]["muted-foreground"]}
          />
        </View>
      </Button>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-background p-lg gap-md">
          <Text className="text-heading-4 text-foreground">Select course</Text>
          <Input
            testID="course-search-input"
            placeholder="Search course..."
            autoFocus
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {search.isLoading && debounced ? (
            <View className="flex-row items-center justify-center py-md gap-sm">
              <Loader2
                size={ICON_SIZE}
                color={tokens.colors[mode]["muted-foreground"]}
              />
              <Text className="text-body text-muted-foreground">
                Loading courses...
              </Text>
            </View>
          ) : null}
          {!debounced && recentCourses.length > 0 ? (
            <Text className="text-label-sm text-muted-foreground">
              Recent courses
            </Text>
          ) : null}
          {/* Deferred until the eager recent-courses query settles so the
              empty prompt doesn't flash before recents load (PR 163
              follow-up). */}
          {!debounced && !recent.isLoading && recentCourses.length === 0 ? (
            <Text className="text-body text-muted-foreground text-center py-md">
              Search for a course...
            </Text>
          ) : null}
          {debounced && !search.isLoading && search.data?.length === 0 ? (
            <View className="items-center gap-sm py-md">
              <Text className="text-body text-muted-foreground">
                No courses found
              </Text>
              {onRequestAddCourse ? (
                <Button
                  testID="add-course-from-search"
                  variant="outline"
                  onPress={() => {
                    setOpen(false);
                    onRequestAddCourse(searchTerm);
                    setSearchTerm("");
                  }}
                >
                  {`Add "${searchTerm}" as a new course`}
                </Button>
              ) : null}
            </View>
          ) : null}
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={debounced ? (search.data ?? []) : recentCourses}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                className="py-md px-sm rounded-md active:opacity-70"
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                  setSearchTerm("");
                }}
              >
                <Text className="text-body text-foreground">
                  {item.name} – {item.city}, {item.country}
                </Text>
              </Pressable>
            )}
          />
          <Button variant="outline" onPress={() => setOpen(false)}>
            Cancel
          </Button>
        </View>
      </Modal>
    </>
  );
}

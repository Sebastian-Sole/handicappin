/**
 * Course picker — native equivalent of web's course combobox (Popover +
 * Command search). A modal sheet with a search field over the REAL
 * course.searchCourses query. Adding new courses is deferred to web
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
  type SearchedCourse,
} from "@/lib/api/procedures/scorecard";
import { useColorMode } from "@/lib/color-mode";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface CoursePickerProps {
  selectedLabel: string;
  onSelect: (course: SearchedCourse) => void;
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
          {!debounced ? (
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
            data={search.data ?? []}
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

/**
 * Native AddCourseModal — mirror of apps/web/components/scorecard/
 * add-course-dialog.tsx (MultiPageDialog): page 0 is course info, pages
 * 1..N one per tee, the same per-page Next gating and whole-form Save
 * gate, plus Add Another Tee / Remove Tee on tee pages. The web country
 * combobox becomes an in-modal searchable list (same COUNTRIES data).
 */
import { Check, Plus, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { Tee } from "@handicappin/handicap-core";
import { tokens } from "@handicappin/tokens/tokens";

import { TeeFormSection } from "@/components/scorecard/tee-form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import type { CourseForm } from "@/lib/scorecard-form";
import { blankTee, courseFormSchema, isTeeValid } from "@/lib/scorecard-form";
import { useColorMode } from "@/lib/color-mode";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface AddCourseModalProps {
  open: boolean;
  initialCourseName?: string;
  onClose: () => void;
  onAdd: (course: CourseForm) => void;
}

export function AddCourseModal({
  open,
  initialCourseName,
  onClose,
  onAdd,
}: AddCourseModalProps) {
  const mode = useColorMode();
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [tees, setTees] = useState<Tee[]>([blankTee()]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset the draft each time the sheet opens (web resets on close).
  useEffect(() => {
    if (open) {
      setPage(0);
      setName(initialCourseName ?? "");
      setCountry("");
      setCity("");
      setWebsite("");
      setTees([blankTee()]);
      setCountrySearch("");
      setCountryPickerOpen(false);
      setErrorMessage(null);
    }
  }, [open, initialCourseName]);

  const draft: CourseForm = useMemo(
    () => ({
      id: -1,
      name,
      country,
      city,
      website,
      approvalStatus: "pending",
      tees: tees.map((tee) => ({ ...tee, approvalStatus: "pending" })),
    }),
    [name, country, city, website, tees],
  );

  // Web's isNextDisabled: page 0 gates on the course fields, tee pages on
  // that tee's schema.
  const courseInfoValid =
    name.length >= 3 && country.length > 0 && city.length > 0;
  const currentTee = page > 0 ? tees[page - 1] : undefined;
  const nextDisabled =
    page === 0 ? !courseInfoValid : !currentTee || !isTeeValid(currentTee);

  const parsed = courseFormSchema.safeParse(draft);
  const lastPage = tees.length; // page index of the final tee
  const isLastPage = page >= lastPage;

  const filteredCountries = countrySearch
    ? COUNTRIES.filter((option) =>
        option.label.toLowerCase().includes(countrySearch.toLowerCase()),
      )
    : COUNTRIES;
  const selectedCountryLabel =
    COUNTRIES.find((option) => option.value === country)?.label ??
    "Select a country...";

  const updateTee = (index: number, updated: Tee) => {
    setTees((prev) => prev.map((tee, i) => (i === index ? updated : tee)));
  };

  const handleAddTee = () => {
    setTees((prev) => [...prev, blankTee()]);
    setPage(tees.length + 1);
  };

  const handleRemoveTee = (index: number) => {
    if (tees.length <= 1) return;
    setTees((prev) => prev.filter((_, i) => i !== index));
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleSave = () => {
    if (!parsed.success) {
      setErrorMessage(
        "Please check the form for errors/missing data, or contact support",
      );
      return;
    }
    setErrorMessage(null);
    onAdd(parsed.data);
    onClose();
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" testID="add-course-modal">
        <View className="p-lg pb-md border-b border-border">
          <Text className="text-heading-4 text-foreground">
            {page === 0
              ? "Add New Course"
              : `Tee ${page} of ${tees.length}${
                  tees[page - 1]?.name ? ` — ${tees[page - 1]?.name}` : ""
                }`}
          </Text>
        </View>

        {countryPickerOpen ? (
          <View className="flex-1 p-lg gap-md">
            <Input
              testID="country-search-input"
              placeholder="Search country..."
              autoFocus
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredCountries}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  testID={`country-option-${item.value}`}
                  accessibilityRole="button"
                  className="py-md px-sm rounded-md active:opacity-70 flex-row items-center justify-between"
                  onPress={() => {
                    setCountry(item.value);
                    setCountryPickerOpen(false);
                    setCountrySearch("");
                  }}
                >
                  <Text className="text-body text-foreground">
                    {item.label}
                  </Text>
                  {country === item.value ? (
                    <Check
                      size={ICON_SIZE}
                      color={tokens.colors[mode].primary}
                    />
                  ) : null}
                </Pressable>
              )}
            />
            <Button
              variant="outline"
              onPress={() => setCountryPickerOpen(false)}
            >
              Cancel
            </Button>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: tokens.spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {errorMessage ? (
              <View className="tint-destructive p-md rounded-lg mb-md">
                <Text className="text-body-sm text-destructive">
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {page === 0 ? (
              <View className="gap-md">
                <View className="gap-sm">
                  <Label>Course Name</Label>
                  <Input
                    testID="course-name-input"
                    placeholder="Enter course name"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View className="gap-sm">
                  <Label>Country</Label>
                  <Button
                    testID="country-picker-trigger"
                    variant="outline"
                    className="w-full"
                    onPress={() => setCountryPickerOpen(true)}
                  >
                    <Text
                      className="text-label-sm text-foreground"
                      numberOfLines={1}
                    >
                      {selectedCountryLabel}
                    </Text>
                  </Button>
                </View>
                <View className="gap-sm">
                  <Label>City</Label>
                  <Input
                    testID="course-city-input"
                    placeholder="Enter city"
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
                <View className="gap-sm">
                  <Label>Website (optional)</Label>
                  <Input
                    testID="course-website-input"
                    placeholder="https://example.com"
                    autoCapitalize="none"
                    keyboardType="url"
                    value={website}
                    onChangeText={setWebsite}
                  />
                </View>
              </View>
            ) : currentTee ? (
              <TeeFormSection
                tee={currentTee}
                onTeeChange={(updated) => updateTee(page - 1, updated)}
              />
            ) : null}
          </ScrollView>
        )}

        {!countryPickerOpen ? (
          <View className="p-lg pt-md border-t border-border gap-sm">
            {page > 0 ? (
              <View className="flex-row items-center justify-between gap-sm">
                {tees.length > 1 ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => handleRemoveTee(page - 1)}
                  >
                    <View className="flex-row items-center gap-xs">
                      <Trash2
                        size={ICON_SIZE}
                        color={tokens.colors[mode]["destructive-foreground"]}
                      />
                      <Text className="text-label-sm text-destructive-foreground">
                        Remove Tee
                      </Text>
                    </View>
                  </Button>
                ) : (
                  <View />
                )}
                <Button
                  testID="add-another-tee"
                  variant="outline"
                  size="sm"
                  disabled={!currentTee || !isTeeValid(currentTee)}
                  onPress={handleAddTee}
                >
                  <View className="flex-row items-center gap-xs">
                    <Plus
                      size={ICON_SIZE}
                      color={tokens.colors[mode].foreground}
                    />
                    <Text className="text-label-sm text-foreground">
                      Add Another Tee
                    </Text>
                  </View>
                </Button>
              </View>
            ) : null}
            <View className="flex-row gap-sm">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  if (page === 0) {
                    onClose();
                  } else {
                    setPage((prev) => prev - 1);
                  }
                }}
              >
                {page === 0 ? "Cancel" : "Back"}
              </Button>
              {isLastPage ? (
                <Button
                  testID="save-course"
                  className="flex-1"
                  disabled={!parsed.success}
                  onPress={handleSave}
                >
                  Save Course
                </Button>
              ) : (
                <Button
                  testID="next-page"
                  className="flex-1"
                  disabled={nextDisabled}
                  onPress={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

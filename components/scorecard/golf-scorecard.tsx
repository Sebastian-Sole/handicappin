"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { clientLogger } from "@/lib/client-logger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tables } from "@/types/supabase";
import { Button } from "../ui/button";
import { SaveStateButton, type SaveState } from "@/components/ui/save-state-button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { AddCourseDialog } from "./add-course-dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { api } from "@/trpc/react";
import { useDebounce } from "use-debounce";
import { Course, Scorecard, scorecardSchema, Tee } from "@/types/scorecard-input";
import { Textarea } from "../ui/textarea";
import { TeeDialog } from "./tee-dialog";
import { FormFeedback } from "../ui/form-feedback";
import { getTeeKey, useTeeManagement } from "@/hooks/useTeeManagement";
import { ScorecardTable } from "./scorecard-table";
import {
  getDisplayedHoles,
  roundToNearestMinute,
} from "@/utils/scorecard/scorecardUtils";
import { Lead, P } from "../ui/typography";
import { Badge } from "../ui/badge";
import DatePicker from "../ui/datepicker";
import useMounted from "@/hooks/useMounted";
import { Skeleton } from "../ui/skeleton";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";
import { FeatureAccess } from "@/types/billing";
import type { FeedbackState } from "@/types/feedback";

interface GolfScorecardProps {
  profile: Tables<"profile">;
  access: FeatureAccess;
}

type SubmitState = "idle" | "loading" | "success" | "error";

const toSaveState = (state: SubmitState): SaveState =>
  state === "loading" ? "saving" : state === "success" ? "saved" : state;

export default function GolfScorecard({ profile, access }: GolfScorecardProps) {
  const isMounted = useMounted();
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  // Use the tee management hook
  const {
    modifications,
    selectedTeeKey,
    selectedCourseId,
    selectedTee,
    getCompleteEditTee,
    getEffectiveTees,
    updateFetchedTees,
    addCourse,
    addTee,
    editTee,
    selectCourse,
    selectTee,
  } = useTeeManagement();

  // Core state
  const [fetchedCourses, setFetchedCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 600);
  const [openCourseSelect, setOpenCourseSelect] = useState(false);
  const [holeCount, setHoleCount] = useState<number>(18);
  // For 9-hole rounds: which section was played. Defaults to "front" so existing
  // 9-hole flows behave unchanged.
  const [nineHoleSection, setNineHoleSection] = useState<"front" | "back">(
    "front"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addCourseDialogOpen, setAddCourseDialogOpen] = useState(false);

  // Form setup
  const form = useForm<Scorecard>({
    resolver: zodResolver(scorecardSchema),
    defaultValues: {
      userId: profile.id,
      approvalStatus: "pending",
      scores: Array(18).fill({
        id: undefined,
        roundId: undefined,
        holeId: undefined,
        strokes: 0,
        hcpStrokes: 0,
      }),
      teeTime: roundToNearestMinute(new Date()).toISOString(),
      notes: "",
    },
  });

  const scoresValue = useWatch({ control: form.control, name: "scores" });

  // Fetch data queries
  const { data: searchedCourses, isLoading: isSearchLoading } =
    api.course.searchCourses.useQuery(
      { query: debouncedSearchTerm },
      { enabled: !!debouncedSearchTerm }
    );

  const { data: courseTees, isLoading: isTeesLoading } =
    api.tee.fetchTees.useQuery(
      { courseId: selectedCourseId || 0 },
      {
        enabled:
          selectedCourseId !== undefined &&
          selectedCourseId > 0 &&
          !modifications.courses[selectedCourseId],
      }
    );

  // Loading state derived from query states
  const isLoading = isSearchLoading || isTeesLoading;

  // Update fetched data when queries return results
  // This accumulator pattern is intentional - we want to cache previous search results
  useEffect(() => {
    if (searchedCourses) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Accumulator pattern for search result caching
      setFetchedCourses((prev) => {
        const newCourses = searchedCourses.filter(
          (course) => !prev.some((p) => p.id === course.id)
        );
        // Convert search results to Course type by adding undefined tees
        const coursesWithTees: Course[] = newCourses.map((course) => ({
          ...course,
          tees: undefined,
        }));
        return [...prev, ...coursesWithTees];
      });
    }
  }, [searchedCourses]);

  // Update fetched tees when they arrive
  useEffect(() => {
    if (courseTees && selectedCourseId && selectedCourseId > 0) {
      updateFetchedTees(selectedCourseId, courseTees);
    }
  }, [courseTees, selectedCourseId, updateFetchedTees]);

  // Select first tee when course changes and tees are available
  useEffect(() => {
    if (selectedCourseId && !selectedTeeKey) {
      const tees = getEffectiveTees(selectedCourseId);
      if (tees && tees.length > 0) {
        const firstTee = tees[0];
        const teeKey = getTeeKey(
          selectedCourseId,
          firstTee.name,
          firstTee.gender
        );
        selectTee(teeKey);
        form.setValue("teePlayed", firstTee);
      }
    }
  }, [selectedCourseId, selectedTeeKey, getEffectiveTees, form, selectTee]);

  const effectiveCourses = useMemo(() => {
    const unmodifiedCourses = fetchedCourses.filter(
      (course) =>
        course.id !== undefined &&
        course.id !== null &&
        !modifications.courses[course.id]
    );

    const allCourses = [
      ...unmodifiedCourses,
      ...Object.values(modifications.courses),
    ];

    // Move the selected course to the first position
    return allCourses.sort((a, b) =>
      a.id === selectedCourseId ? -1 : b.id === selectedCourseId ? 1 : 0
    );
  }, [fetchedCourses, modifications.courses, selectedCourseId]);

  const handleCourseSearch = (searchString: string) => {
    setSearchTerm(searchString);
  };

  const handleAddCourse = (course: Course) => {
    setOpenCourseSelect(false);
    setFeedback(null);

    try {
      const { course: newCourse, tee: firstTee, teeKey } = addCourse(course);
      selectCourse(newCourse.id);
      selectTee(teeKey);

      // Update form values
      form.setValue("course", { ...newCourse });
      form.setValue("teePlayed", {
        ...firstTee,
        id: undefined,
        courseId: undefined,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to add course",
      });
    }
  };

  const handleAddTee = (newTee: Tee) => {
    if (selectedCourseId === undefined) return;

    const { tee: teeWithId, teeKey } = addTee(selectedCourseId, newTee);
    selectTee(teeKey);
    form.setValue("teePlayed", {
      ...teeWithId,
      id: undefined,
      courseId: undefined,
    });
  };

  const handleEditTee = (updatedTee: Tee) => {
    if (selectedCourseId === undefined) return;

    const { tee: editedTee, teeKey } = editTee(
      selectedCourseId,
      selectedTeeKey,
      updatedTee
    );

    // Update form value with the edited tee (excluding id and courseId as they're managed internally)
    form.setValue("teePlayed", {
      ...editedTee,
      id: undefined,
      courseId: undefined,
    });

    // Update form's course tees to include the edited tee
    form.setValue("course.tees", getEffectiveTees(selectedCourseId));

    // Set the selected tee key to the new tee key
    // We need to do this after the state updates to ensure proper rendering
    setTimeout(() => {
      selectTee(teeKey);
    }, 0);
  };

  const handleScoreChange = (holeIndex: number, score: number) => {
    const currentScores = form.getValues("scores");
    const newScores = [...currentScores];
    newScores[holeIndex] = {
      id: undefined,
      roundId: undefined,
      holeId: undefined,
      strokes: score,
      hcpStrokes: 0,
    };
    form.setValue("scores", newScores);
  };

  const displayedHoles = useMemo(() => {
    return getDisplayedHoles(selectedTee, holeCount, nineHoleSection);
  }, [selectedTee, holeCount, nineHoleSection]);

  const submitScorecardMutation = api.round.submitScorecard.useMutation();

  const onSubmit = async (data: Scorecard) => {
    setSubmitState("loading");
    setFeedback(null);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      // Create a new data object with only the played holes' scores
      const isAutoApproved =
        data.course.approvalStatus === "approved" &&
        data.teePlayed.approvalStatus === "approved";

      // Determine parPlayed based on holeCount and (for 9-hole) section played
      let parPlayed = 0;
      if (holeCount === 18) {
        parPlayed = selectedTee?.totalPar ?? 0;
      } else if (holeCount === 9) {
        parPlayed =
          nineHoleSection === "back"
            ? selectedTee?.inPar ?? 0
            : selectedTee?.outPar ?? 0;
      }
      // parPlayed is computed server-side too; this local value is informational.
      void parPlayed;

      const submissionData: Scorecard = {
        ...data,
        approvalStatus: isAutoApproved
          ? ("approved" as const)
          : ("pending" as const),
        teePlayed: {
          ...data.teePlayed,
        },
        scores: data.scores.slice(0, holeCount),
        // Only attach the 9-hole section for 9-hole rounds; 18-hole rounds must omit it.
        nineHoleSection: holeCount === 9 ? nineHoleSection : undefined,
      };

      // Inspect the played slice (always indices 0..holeCount) for missing scores.
      const playedScores = submissionData.scores;
      const anyZeros = playedScores.some((score) => score.strokes === 0);

      if (anyZeros) {
        setFeedback({
          type: "error",
          message:
            holeCount === 9
              ? "Please enter scores for all 9 holes"
              : "Please enter scores for all 18 holes",
        });
        setSubmitState("idle");
        return;
      }
      await submitScorecardMutation.mutateAsync(submissionData);

      // Show success state on button
      setSubmitState("success");

      // Small delay to show success state, then redirect
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to home page
      router.push(`/`);
    } catch (error) {
      clientLogger.error("Error submitting scorecard", error);
      setSubmitState("error");

      // Better error handling - check for specific error types
      let errorMessage = "Failed to submit scorecard";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Check if it's a TRPC error with a specific message
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        errorMessage = error.message;
      }

      setFeedback({
        type: "error",
        message: errorMessage,
      });

      // Reset to idle after showing error
      setTimeout(() => setSubmitState("idle"), 2000);

      // DO NOT redirect on error - let user see the error and try again
    }
  };

  const onError = (errors: unknown) => {
    clientLogger.error("Form validation errors", errors);
    setFeedback({
      type: "error",
      message: "Please check all required fields are filled correctly",
    });
  };

  // Update the course selection button display
  const getSelectedCourseName = useCallback(() => {
    if (!selectedCourseId) return "Select course...";

    // Check modifications first
    if (selectedCourseId < 0 && modifications.courses[selectedCourseId]) {
      return modifications.courses[selectedCourseId].name;
    }

    // Then check fetched courses
    const fetchedCourse = fetchedCourses.find(
      (course) => course.id === selectedCourseId
    );
    if (fetchedCourse) {
      return (
        fetchedCourse.name +
        " - " +
        (fetchedCourse.city ? fetchedCourse.city + ", " : "") +
        fetchedCourse.country +
        " " +
        getFlagEmoji(fetchedCourse.country)
      );
    }

    return "Select course...";
  }, [selectedCourseId, modifications.courses, fetchedCourses]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} role="form">
        <Card className="w-full mx-auto bg-background border-none shadow-none">
          <CardContent className="p-lg sm:w-[1325px] max-w-[450px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1325px] mx-auto">
            <div className="mb-lg grid grid-cols-1 lg:grid-cols-2 gap-md lg:gap-xl">
              <Card>
                <CardContent className="p-md">
                  {/* Left-align all labels */}
                  <div className="space-y-sm text-left">
                    <FormField
                      control={form.control}
                      name="course.name"
                      disabled={submitState === "loading" || submitState === "success"}
                      render={() => (
                        <FormItem>
                          <FormControl>
                            <div className="space-y-sm">
                              <Label htmlFor="course">Course</Label>
                              <div className="flex flex-col md:flex-row gap-sm">
                                <div className="flex-1 overflow-hidden">
                                  <Popover
                                    open={openCourseSelect}
                                    onOpenChange={(open) => {
                                      setOpenCourseSelect(open);
                                      if (!open) {
                                        setSearchTerm("");
                                      }
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCourseSelect}
                                        className="w-full justify-between"
                                      >
                                        {getSelectedCourseName()}
                                        <ChevronsUpDown className="ml-sm h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0">
                                      <Command>
                                        <CommandInput
                                          placeholder="Search course..."
                                          onValueChange={handleCourseSearch}
                                        />
                                        <CommandList>
                                          <CommandGroup className="py-lg">
                                            {effectiveCourses.length > 0 &&
                                              !isLoading &&
                                              effectiveCourses.map((course) => (
                                                <CommandItem
                                                  key={course.id || course.name}
                                                  onSelect={() => {
                                                    // Clear the selected tee first
                                                    selectTee(undefined);
                                                    // Then set the new course
                                                    selectCourse(course.id);
                                                    setOpenCourseSelect(false);
                                                    form.setValue(
                                                      "course",
                                                      course
                                                    );
                                                  }}
                                                >
                                                  {course.name +
                                                    " - " +
                                                    course.city +
                                                    ", " +
                                                    course.country +
                                                    " " +
                                                    getFlagEmoji(
                                                      course.country
                                                    )}
                                                </CommandItem>
                                              ))}
                                            {effectiveCourses.length === 0 &&
                                              !isLoading &&
                                              !debouncedSearchTerm && (
                                                <CommandEmpty>
                                                  <P>Search for a course...</P>
                                                </CommandEmpty>
                                              )}
                                          </CommandGroup>

                                          {(isLoading ||
                                            (!searchedCourses &&
                                              searchTerm !==
                                                debouncedSearchTerm) ||
                                            (searchedCourses &&
                                              effectiveCourses.length !== 0 &&
                                              searchTerm !==
                                                debouncedSearchTerm)) && (
                                            <CommandEmpty>
                                              <div
                                                className="flex items-center justify-center py-md"
                                                aria-live="polite"
                                              >
                                                <Loader2 className="h-4 w-4 animate-spin mr-sm" />
                                                <P className="!mt-0">
                                                  Loading courses...
                                                </P>
                                              </div>
                                            </CommandEmpty>
                                          )}

                                          {!isLoading &&
                                            searchedCourses &&
                                            searchedCourses.length === 0 &&
                                            searchTerm ===
                                              debouncedSearchTerm && (
                                              <CommandEmpty>
                                                <div className="flex flex-col items-center gap-sm py-sm">
                                                  <P>No courses found</P>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      setOpenCourseSelect(false);
                                                      setAddCourseDialogOpen(true);
                                                    }}
                                                    type="button"
                                                  >
                                                    Add course
                                                  </Button>
                                                </div>
                                              </CommandEmpty>
                                            )}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="flex gap-sm justify-between lg:justify-start w-full md:w-auto sm:flex-row flex-col">
                                  <AddCourseDialog
                                    onAdd={handleAddCourse}
                                    aria-label="Add new course"
                                    open={addCourseDialogOpen}
                                    onOpenChange={setAddCourseDialogOpen}
                                    initialCourseName={searchTerm}
                                    isPremium={access.hasPremiumAccess}
                                  />
                                </div>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="course.tees"
                      disabled={submitState === "loading" || submitState === "success"}
                      render={() => (
                        <FormItem>
                          <FormControl>
                            <div className="space-y-md mt-md">
                              <div className="space-y-sm">
                                <Label htmlFor="tee">Tee</Label>
                                <div className="flex flex-col md:flex-row gap-sm">
                                  <div className="flex-1">
                                    <Select
                                      value={selectedTeeKey}
                                      onValueChange={(value) => {
                                        const foundTee = getEffectiveTees(
                                          selectedCourseId
                                        )?.find(
                                          (tee) =>
                                            getTeeKey(
                                              selectedCourseId || 0,
                                              tee.name,
                                              tee.gender
                                            ) === value
                                        );
                                        if (!foundTee) {
                                          return;
                                        }
                                        selectTee(value);
                                        form.setValue("teePlayed", foundTee);
                                      }}
                                    >
                                      <SelectTrigger
                                        id="tee"
                                        disabled={
                                          !selectedCourseId ||
                                          getEffectiveTees(selectedCourseId)
                                            ?.length === 0
                                        }
                                      >
                                        {isTeesLoading ? (
                                          <div className="flex items-center">
                                            <Loader2 className="h-4 w-4 animate-spin mr-sm" />
                                            <span>Loading tees...</span>
                                          </div>
                                        ) : (
                                          <SelectValue placeholder="Select tee..." />
                                        )}
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getEffectiveTees(
                                          selectedCourseId
                                        )?.map((tee) => {
                                          const genderIndicator =
                                            tee.gender === "mens"
                                              ? "(M)"
                                              : "(F)";
                                          const pendingIndicator =
                                            tee.approvalStatus === "pending"
                                              ? " (Pending)"
                                              : "";
                                          const displayName = `${tee.name} ${genderIndicator}${pendingIndicator}`;
                                          return (
                                            <SelectItem
                                              key={`${tee.id ?? getTeeKey(selectedCourseId || 0, tee.name, tee.gender)}`}
                                              value={getTeeKey(
                                                selectedCourseId || 0,
                                                tee.name,
                                                tee.gender
                                              )}
                                            >
                                              {displayName}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex gap-sm justify-between lg:justify-start w-full md:w-auto sm:flex-row flex-col">
                                    <TeeDialog
                                      mode="edit"
                                      key={`${selectedCourseId}-${selectedTeeKey}`}
                                      existingTee={getCompleteEditTee}
                                      onSave={handleEditTee}
                                      onSaveAdditionalTees={(tees) =>
                                        tees.forEach(handleAddTee)
                                      }
                                      aria-label="Edit selected tee"
                                      isPremium={access.hasPremiumAccess}
                                      disabled={
                                        !selectedTeeKey &&
                                        getEffectiveTees(selectedCourseId) &&
                                        getEffectiveTees(selectedCourseId)
                                          ?.length === 0
                                      }
                                    />

                                    <TeeDialog
                                      key={`${selectedCourseId}-${selectedCourseId}-new`}
                                      mode="add"
                                      onSave={handleAddTee}
                                      onSaveAdditionalTees={(tees) =>
                                        tees.forEach(handleAddTee)
                                      }
                                      aria-label="Add new tee"
                                      isPremium={access.hasPremiumAccess}
                                      disabled={
                                        !selectedCourseId ||
                                        getEffectiveTees(selectedCourseId)
                                          ?.length === 0
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                              {selectedTeeKey && (
                                <div className="flex gap-sm justify-between w-full flex-wrap sm:flex-row flex-col">
                                  <Badge className="flex justify-center ">
                                    Course Rating: {selectedTee?.courseRating18}
                                  </Badge>
                                  <Badge className="flex justify-center">
                                    Slope Rating: {selectedTee?.slopeRating18}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-md">
                  <div className="space-y-md text-left">
                    <div className="space-y-sm">
                      <FormLabel>Tee Time</FormLabel>
                      <FormField
                        control={form.control}
                        name="teeTime"
                        disabled={submitState === "loading" || submitState === "success"}
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormControl>
                              {isMounted ? (
                                <DatePicker
                                  value={roundToNearestMinute(
                                    new Date(field.value)
                                  )}
                                  onChange={(date) => {
                                    field.onChange(
                                      roundToNearestMinute(date).toISOString()
                                    );
                                  }}
                                />
                              ) : (
                                <Skeleton className="h-10 w-full" />
                              )}
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-sm">
                      <Label htmlFor="holes">Holes</Label>
                      {isMounted ? (
                        <Select
                          value={holeCount.toString()}
                          onValueChange={(value) => {
                            const next = parseInt(value);
                            setHoleCount(next);
                            // Reset section to "front" when leaving 9-hole mode so
                            // the form state never reflects an inapplicable selection.
                            if (next !== 9) {
                              setNineHoleSection("front");
                            }
                          }}
                        >
                          <SelectTrigger id="holes">
                            <SelectValue placeholder="Select Holes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9">9 Holes</SelectItem>
                            <SelectItem value="18">18 Holes</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Skeleton className="h-10 w-full" />
                      )}
                    </div>
                    {holeCount === 9 && (
                      <div className="space-y-sm">
                        <Label htmlFor="nine-hole-section">9-hole section</Label>
                        {isMounted ? (
                          <RadioGroup
                            id="nine-hole-section"
                            value={nineHoleSection}
                            onValueChange={(value) =>
                              setNineHoleSection(value as "front" | "back")
                            }
                            className="flex flex-row gap-md"
                            aria-label="Which 9-hole section was played"
                          >
                            <div className="flex items-center gap-sm">
                              <RadioGroupItem
                                value="front"
                                id="nine-hole-section-front"
                              />
                              <Label htmlFor="nine-hole-section-front">
                                Front 9
                              </Label>
                            </div>
                            <div className="flex items-center gap-sm">
                              <RadioGroupItem
                                value="back"
                                id="nine-hole-section-back"
                              />
                              <Label htmlFor="nine-hole-section-back">
                                Back 9
                              </Label>
                            </div>
                          </RadioGroup>
                        ) : (
                          <Skeleton className="h-10 w-full" />
                        )}
                      </div>
                    )}
                    <div className="space-y-sm">
                      <Label htmlFor="notes">Notes</Label>
                      {isMounted ? (
                        <FormField
                          control={form.control}
                          name="notes"
                          disabled={submitState === "loading" || submitState === "success"}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  id="notes"
                                  placeholder="Enter any notes here..."
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      ) : (
                        <Skeleton className="h-20 w-full" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedTeeKey &&
              getEffectiveTees(selectedCourseId) &&
              displayedHoles && (
                <div className="w-full">
                  <ScorecardTable
                    selectedTee={selectedTee}
                    displayedHoles={displayedHoles}
                    holeCount={holeCount}
                    scores={scoresValue}
                    onScoreChange={handleScoreChange}
                    disabled={submitState === "loading" || submitState === "success"}
                  />
                </div>
              )}
            {!selectedTeeKey && (
              <div className="h-32 w-full">
                <div className="flex items-center justify-center h-full">
                  <Lead>Select a course and tee to submit your scorecard</Lead>
                </div>
              </div>
            )}
            {/* Feedback display */}
            {feedback && (
              <div className="mt-md">
                <FormFeedback
                  type={feedback.type}
                  message={feedback.message}
                />
              </div>
            )}
            {/* Submit button */}
            {selectedTeeKey && (
              <div className="mt-md justify-end flex">
                <SaveStateButton
                  type="submit"
                  state={toSaveState(submitState)}
                  idleLabel="Submit Scorecard"
                  savingLabel="Submitting..."
                  savedLabel="Submitted!"
                  errorLabel="Submit Scorecard"
                  className="transition-all duration-300"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

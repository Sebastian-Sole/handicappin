"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tables } from "@/types/supabase";
import { Button } from "../ui/button";
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
import { useForm } from "react-hook-form";
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
import { Course, Scorecard, scorecardSchema, Tee } from "@/types/scorecard";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/use-toast";
import { TeeDialog } from "./tee-dialog";
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

interface GolfScorecardProps {
  profile: Tables<"profile">;
  access: FeatureAccess;
}

export default function GolfScorecard({ profile, access }: GolfScorecardProps) {
  const isMounted = useMounted();
  const router = useRouter();
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  useEffect(() => {
    if (searchedCourses) {
      console.log("searchedCourses: ", searchedCourses);
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

    try {
      const { course: newCourse, tee: firstTee, teeKey } = addCourse(course);
      selectCourse(newCourse.id);
      selectTee(teeKey);

      // Update form values
      form.setValue("course", { ...newCourse, tees: undefined });
      form.setValue("teePlayed", {
        ...firstTee,
        id: undefined,
        courseId: undefined,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add course",
        variant: "destructive",
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
    return getDisplayedHoles(selectedTee, holeCount);
  }, [selectedTee, holeCount]);

  const submitScorecardMutation = api.round.submitScorecard.useMutation();

  const onSubmit = async (data: Scorecard) => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      // Create a new data object with only the played holes' scores
      const isAutoApproved =
        data.course.approvalStatus === "approved" &&
        data.teePlayed.approvalStatus === "approved";

      console.log("is auto approved: ", isAutoApproved);

      // Determine parPlayed based on holeCount
      let parPlayed = 0;
      if (holeCount === 18) {
        parPlayed = selectedTee?.totalPar ?? 0;
      } else if (holeCount === 9) {
        parPlayed = selectedTee?.outPar ?? 0;
      }

      const submissionData: Scorecard = {
        ...data,
        approvalStatus: isAutoApproved
          ? ("approved" as const)
          : ("pending" as const),
        teePlayed: {
          ...data.teePlayed,
        },
        scores: data.scores.slice(0, holeCount),
      };

      // Check if first 9 scores are all 0
      const first9Scores = submissionData.scores.slice(0, 9);
      const anyZeros = first9Scores.some((score) => score.strokes === 0);

      if (anyZeros) {
        toast({
          title: "Invalid Scores",
          description:
            "Please enter scores for the first 9 holes, or select 18 holes",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      console.log("submissionData: ", submissionData);
      await submitScorecardMutation.mutateAsync(submissionData);

      // Show success message
      toast({
        title: "Success",
        description: "Your scorecard has been submitted successfully",
      });

      // Small delay to ensure tRPC response is fully processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to home page
      router.push(`/`);
    } catch (error) {
      console.error("Error submitting scorecard:", error);
      setIsSubmitting(false);

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

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // DO NOT redirect on error - let user see the error and try again
    }
  };

  const onError = (errors: any) => {
    console.log(errors);
    console.error("Form validation errors:", errors);
    toast({
      title: "Validation Error",
      description: "Please check all required fields are filled correctly",
      variant: "destructive",
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
          <CardContent className="p-6 sm:w-[1325px] max-w-[450px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1325px] mx-auto">
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
              <Card>
                <CardContent className="p-4">
                  {/* Left-align all labels */}
                  <div className="space-y-2 text-left">
                    <FormField
                      control={form.control}
                      name="course.name"
                      disabled={isSubmitting}
                      render={() => (
                        <FormItem>
                          <FormControl>
                            <div className="space-y-2">
                              <Label htmlFor="course">Course</Label>
                              <div className="flex flex-col md:flex-row gap-2">
                                <div className="flex-1 overflow-hidden">
                                  <Popover
                                    open={openCourseSelect}
                                    onOpenChange={setOpenCourseSelect}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCourseSelect}
                                        className="w-full justify-between"
                                      >
                                        {getSelectedCourseName()}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0">
                                      <Command>
                                        <CommandInput
                                          placeholder="Search course..."
                                          onValueChange={handleCourseSearch}
                                        />
                                        <CommandList>
                                          <CommandGroup className="py-6">
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
                                              !isLoading && (
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
                                                className="flex items-center justify-center py-4"
                                                aria-live="polite"
                                              >
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
                                                <P>No courses found</P>
                                              </CommandEmpty>
                                            )}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="flex gap-2 justify-between lg:justify-start w-full md:w-auto sm:flex-row flex-col">
                                  <AddCourseDialog
                                    onAdd={handleAddCourse}
                                    aria-label="Add new course"
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
                      disabled={isSubmitting}
                      render={() => (
                        <FormItem>
                          <FormControl>
                            <div className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label htmlFor="tee">Tee</Label>
                                <div className="flex flex-col md:flex-row gap-2">
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
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
                                          const displayName = `${tee.name} ${genderIndicator}`;
                                          return (
                                            <SelectItem
                                              key={getTeeKey(
                                                selectedCourseId || 0,
                                                tee.name,
                                                tee.gender
                                              )}
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
                                  <div className="flex gap-2 justify-between lg:justify-start w-full md:w-auto sm:flex-row flex-col">
                                    <TeeDialog
                                      mode="edit"
                                      key={`${selectedCourseId}-${selectedTeeKey}`}
                                      existingTee={getCompleteEditTee}
                                      onSave={handleEditTee}
                                      aria-label="Edit selected tee"
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
                                      aria-label="Add new tee"
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
                                <div className="flex gap-2 justify-between w-full flex-wrap sm:flex-row flex-col">
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
                <CardContent className="p-4">
                  <div className="space-y-4 text-left">
                    <div className="space-y-2">
                      <FormLabel>Tee Time</FormLabel>
                      <FormField
                        control={form.control}
                        name="teeTime"
                        disabled={isSubmitting}
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
                    <div className="space-y-2">
                      <Label htmlFor="holes">Holes</Label>
                      {isMounted ? (
                        <Select
                          value={holeCount.toString()}
                          onValueChange={(value) =>
                            setHoleCount(parseInt(value))
                          }
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
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      {isMounted ? (
                        <FormField
                          control={form.control}
                          name="notes"
                          disabled={isSubmitting}
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
                    scores={form.watch("scores")}
                    onScoreChange={handleScoreChange}
                    disabled={isSubmitting}
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
            {/* Submit button */}
            {selectedTeeKey && (
              <div className="mt-4 justify-end flex">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Scorecard"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

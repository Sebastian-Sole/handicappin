"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { ChevronsUpDown } from "lucide-react";
import { AddCourseDialog } from "./add-course-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { api } from "@/trpc/react";
import { useDebounce } from "use-debounce";
import { Course, Scorecard, scorecardSchema, Tee } from "@/types/scorecard";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/use-toast";
import { TeeDialog } from "./tee-dialog";
import { getTeeKey, useTeeManagement } from "@/hooks/useTeeManagement";
import { ScorecardTable } from "./scorecard-table";
import { getDisplayedHoles } from "@/utils/scorecard/scorecardUtils";
import { Lead } from "../ui/typography";
import { Badge } from "../ui/badge";

interface GolfScorecardProps {
  profile: Tables<"Profile">;
}

export default function GolfScorecard({ profile }: GolfScorecardProps) {
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
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [openCourseSelect, setOpenCourseSelect] = useState(false);
  const [holeCount, setHoleCount] = useState<number>(18);

  // Form setup
  const form = useForm<Scorecard>({
    resolver: zodResolver(scorecardSchema),
    defaultValues: {
      userId: profile.id,
      teeTime: new Date().toISOString(),
      approvalStatus: "pending",
      scores: Array(18).fill(0),
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
      setFetchedCourses((prev) => {
        const newCourses = searchedCourses.filter(
          (course) => !prev.some((p) => p.id === course.id)
        );
        return [...prev, ...newCourses];
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
        const teeKey = getTeeKey(selectedCourseId, firstTee.name);
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
    return [...unmodifiedCourses, ...Object.values(modifications.courses)];
  }, [fetchedCourses, modifications.courses]);

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
    newScores[holeIndex] = score;
    form.setValue("scores", newScores);
  };

  const displayedHoles = useMemo(() => {
    return getDisplayedHoles(selectedTee, holeCount);
  }, [selectedTee, holeCount]);

  const onSubmit = (data: Scorecard) => {
    // Create a new data object with only the played holes' scores
    const submissionData = {
      ...data,
      scores: data.scores.slice(0, holeCount),
    };
    console.log("Form is being submitted with data:", submissionData);
  };

  const onError = (errors: any) => {
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
      return fetchedCourse.name;
    }

    return "Select course...";
  }, [selectedCourseId, modifications.courses, fetchedCourses]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)}>
        <Card className="w-full mx-auto">
          <CardContent className="p-6">
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <FormField
                    control={form.control}
                    name="course.name"
                    render={() => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-2">
                            <Label htmlFor="course">Course</Label>
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
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Search course..."
                                    onValueChange={handleCourseSearch}
                                  />
                                  <CommandList>
                                    {effectiveCourses.length === 0 &&
                                      !isLoading && (
                                        <CommandEmpty>
                                          <AddCourseDialog
                                            onAdd={handleAddCourse}
                                          />
                                        </CommandEmpty>
                                      )}
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
                                              form.setValue("course", course);
                                            }}
                                          >
                                            {course.name}
                                          </CommandItem>
                                        ))}
                                      <CommandItem>
                                        <AddCourseDialog
                                          onAdd={handleAddCourse}
                                        />
                                      </CommandItem>
                                    </CommandGroup>

                                    {isLoading && (
                                      <CommandEmpty>
                                        <span>Loading...</span>
                                      </CommandEmpty>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="course.tees"
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
                                            tee.name
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
                                      <SelectValue placeholder="Select Tee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getEffectiveTees(selectedCourseId)?.map(
                                        (tee) => (
                                          <SelectItem
                                            key={getTeeKey(
                                              selectedCourseId || 0,
                                              tee.name
                                            )}
                                            value={getTeeKey(
                                              selectedCourseId || 0,
                                              tee.name
                                            )}
                                          >
                                            {tee.name}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2 justify-between lg:justify-start w-full md:w-auto sm:flex-row flex-col">
                                  {selectedTeeKey &&
                                    getEffectiveTees(selectedCourseId) &&
                                    getEffectiveTees(selectedCourseId).length >
                                      0 && (
                                      <TeeDialog
                                        mode="edit"
                                        key={`${selectedCourseId}-${selectedTeeKey}`}
                                        existingTee={getCompleteEditTee}
                                        onSave={handleEditTee}
                                      />
                                    )}

                                  {selectedCourseId && (
                                    <TeeDialog
                                      key={`${selectedCourseId}-${selectedCourseId}-new`}
                                      mode="add"
                                      onSave={handleAddTee}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            {selectedTeeKey && (
                              <div className="flex gap-2 justify-between w-full flex-wrap sm:flex-row flex-col">
                                <Badge className="flex justify-center">
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
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <FormField
                        control={form.control}
                        name="teeTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                id="date"
                                type="date"
                                value={field.value.split("T")[0]}
                                onChange={(e) =>
                                  field.onChange(
                                    new Date(e.target.value).toISOString()
                                  )
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holes">Holes</Label>
                      <Select
                        value={holeCount.toString()}
                        onValueChange={(value) => setHoleCount(parseInt(value))}
                      >
                        <SelectTrigger id="holes">
                          <SelectValue placeholder="Select Holes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9">9 Holes</SelectItem>
                          <SelectItem value="18">18 Holes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <FormField
                        control={form.control}
                        name="notes"
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedTeeKey &&
              getEffectiveTees(selectedCourseId) &&
              displayedHoles && (
                <ScorecardTable
                  selectedTee={selectedTee}
                  displayedHoles={displayedHoles}
                  holeCount={holeCount}
                  scores={form.watch("scores")}
                  onScoreChange={handleScoreChange}
                />
              )}

            {!selectedTeeKey && (
              <div
                className={`h-32 sm:w-[270px] md:w-[600px] lg:w-[725px] xl:w-[975px] 2xl:w-[1225px] 3xl:w-[1325px]`}
              >
                <div className="flex items-center justify-center h-full">
                  <Lead>Select a course and tee to submit your scorecard</Lead>
                </div>
              </div>
            )}

            {selectedTeeKey && (
              <div className="mt-4 flex justify-end">
                <Button type="submit">Submit Scorecard</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

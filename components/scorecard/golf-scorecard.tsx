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
import {
  Course,
  Hole,
  Scorecard,
  scorecardSchema,
  Tee,
} from "@/types/scorecard";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "../ui/use-toast";
import { TeeDialog } from "./tee-dialog";
import { getTeeKey, useTeeManagement } from "@/hooks/useTeeManagement";

interface GolfScorecardProps {
  profile: Tables<"Profile">;
}

export default function GolfScorecard({ profile }: GolfScorecardProps) {
  // Use the tee management hook
  const {
    fetchedTees,
    modifications,
    getEffectiveTees,
    updateFetchedTees,
    addCourse,
    addTee,
    editTee,
  } = useTeeManagement();

  // Core state
  const [fetchedCourses, setFetchedCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>(
    undefined
  );
  const [selectedTeeKey, setSelectedTeeKey] = useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  // Additional state for the form
  const [date, setDate] = useState("");
  const [holeCount, setHoleCount] = useState<number>(18);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<number[]>(Array(18).fill(0));
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [openCourseSelect, setOpenCourseSelect] = useState(false);

  // Form setup
  const form = useForm<Scorecard>({
    resolver: zodResolver(scorecardSchema),
    defaultValues: {
      userId: profile.id,
      teeTime: new Date().toISOString(),
      approvalStatus: "pending",
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

  // Get the currently selected tee
  const selectedTee = useMemo(() => {
    if (!selectedTeeKey || !selectedCourseId) return undefined;
    return getEffectiveTees(selectedCourseId)?.find(
      (tee) => getTeeKey(selectedCourseId, tee.name) === selectedTeeKey
    );
  }, [selectedTeeKey, selectedCourseId, getEffectiveTees]);

  // Update loading state
  useEffect(() => {
    setIsLoading(isSearchLoading || isTeesLoading);
  }, [isSearchLoading, isTeesLoading]);

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
        setSelectedTeeKey(teeKey);
        form.setValue("teePlayed", firstTee);
      }
    }
  }, [selectedCourseId, getEffectiveTees, form]);

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
      setSelectedCourseId(newCourse.id);
      setSelectedTeeKey(teeKey);

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
    setSelectedTeeKey(teeKey);
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
      setSelectedTeeKey(teeKey);
    }, 0);
  };

  const handleScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...scores];
    newScores[holeIndex] = score;
    setScores(newScores);
    form.setValue("scores", newScores);
  };

  const calculateTotal = (scores: number[], start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score, 0);

  const normalizeHcpForNineHoles = (holes: Hole[] | undefined) => {
    if (!holes) return [];
    if (holes.length === 18) return holes;

    const uniqueHcps = holes.map((hole) => hole.hcp);
    uniqueHcps.sort((a, b) => a - b);
    const hcpMapping = new Map(uniqueHcps.map((hcp, idx) => [hcp, idx + 1]));

    return holes.map((hole) => ({
      ...hole,
      hcp: hcpMapping.get(hole.hcp) || hole.hcp,
    }));
  };

  const displayedHoles = useMemo(() => {
    if (!selectedTee?.holes) return [];
    return (
      normalizeHcpForNineHoles(selectedTee.holes)?.slice(0, holeCount) || []
    );
  }, [selectedTee?.holes, holeCount]);

  // Get the complete tee data for editing
  const getCompleteEditTee = useMemo(() => {
    if (!selectedTee || !selectedCourseId) return undefined;

    // For fetched tees
    if (selectedCourseId > 0) {
      // Get the tee with its holes from fetchedTees
      const fetchedTee = fetchedTees[selectedCourseId]?.find(
        (tee) => tee.name === selectedTee.name
      );

      // Check if this tee has been modified
      const teeKey = getTeeKey(selectedCourseId, selectedTee.name);
      const modifiedTee = modifications.tees[teeKey];

      // If the tee has been modified, use that data
      if (modifiedTee) {
        return modifiedTee;
      }

      // Otherwise use the fetched tee data
      if (fetchedTee) {
        return fetchedTee;
      }
    }

    // For user-created tees
    const teeKey = getTeeKey(selectedCourseId, selectedTee.name);
    const modifiedTee = modifications.tees[teeKey];
    if (modifiedTee) {
      return modifiedTee;
    }

    return undefined;
  }, [selectedTee, selectedCourseId, fetchedTees, modifications.tees]);

  const onSubmit = (data: Scorecard) => {
    console.log("Form is being submitted with data:", data);
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
                    render={({ field }) => (
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
                                              setSelectedTeeKey(undefined);
                                              // Then set the new course
                                              setSelectedCourseId(course.id);
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
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label htmlFor="tee">Tee</Label>
                              <div className="space-y-2">
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
                                    setSelectedTeeKey(value);
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
                            </div>
                            {selectedTeeKey && (
                              <div className="flex justify-between text-sm">
                                <span>
                                  Course Rating: {selectedTee?.courseRating18}
                                </span>
                                <span>
                                  Slope Rating: {selectedTee?.slopeRating18}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between">
                              {selectedCourseId && (
                                <TeeDialog
                                  key={`${selectedCourseId}-${selectedCourseId}-new`}
                                  mode="add"
                                  onSave={handleAddTee}
                                />
                              )}

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
                            </div>
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
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
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
                      <Textarea
                        id="notes"
                        placeholder="Enter any notes here..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {selectedTeeKey &&
            getEffectiveTees(selectedCourseId) &&
            displayedHoles ? (
              // Wrap the table in a container with overflow-x-auto + a fixed max-width
              <div className="rounded-lg border max-w-[270px] sm:max-w-[350px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1600px]">
                <div className="overflow-x-auto max-w-full">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-secondary dark:bg-accent text-primary-foreground dark:text-foreground w-20">
                          HOLE
                        </TableHead>
                        {[...Array(holeCount)].map((_, i) => (
                          <TableHead
                            key={i}
                            className="bg-secondary dark:bg-accent text-primary-foreground dark:text-foreground text-center min-w-[40px]"
                          >
                            {i + 1}
                          </TableHead>
                        ))}
                        {holeCount === 18 && (
                          <>
                            <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                              OUT
                            </TableHead>
                            <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                              IN
                            </TableHead>
                          </>
                        )}
                        <TableHead className="bg-secondary dark:bg-accent dark:text-foreground text-primary-foreground text-center min-w-[50px]">
                          TOT
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-inherit">
                        <TableCell className="font-medium bg-secondary dark:bg-accent truncate text-ellipsis whitespace-nowrap">
                          {selectedTee?.name.toUpperCase()} TEE
                        </TableCell>
                        {displayedHoles.map((hole, i) => (
                          <TableCell key={i} className="text-center">
                            {hole.distance}
                          </TableCell>
                        ))}
                        {holeCount === 18 && (
                          <>
                            <TableCell className="text-center font-medium bg-background">
                              {selectedTee?.outDistance}
                            </TableCell>
                            <TableCell className="text-center font-medium bg-background">
                              {selectedTee?.inDistance}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center font-medium bg-background">
                          {holeCount === 18
                            ? selectedTee?.totalDistance
                            : selectedTee?.outDistance}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-inherit">
                        <TableCell className="font-medium bg-secondary dark:bg-accent">
                          PAR
                        </TableCell>
                        {displayedHoles.map((hole, i) => (
                          <TableCell
                            key={i}
                            className="text-center bg-background-alternate dark:bg-bar"
                          >
                            {hole.par}
                          </TableCell>
                        ))}
                        {holeCount === 18 && (
                          <>
                            <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                              {selectedTee?.outPar}
                            </TableCell>
                            <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                              {selectedTee?.inPar}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                          {holeCount === 18
                            ? selectedTee?.totalPar
                            : selectedTee?.outPar}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-inherit">
                        <TableCell className="font-medium bg-secondary dark:bg-accent">
                          HANDICAP
                        </TableCell>
                        {displayedHoles.map((hole, i) => (
                          <TableCell key={i} className="text-center">
                            {hole.hcp}
                          </TableCell>
                        ))}
                        {holeCount === 18 ? (
                          <TableCell className="bg-background" colSpan={2} />
                        ) : (
                          <TableCell className="bg-background" />
                        )}
                        <TableCell className="bg-background" />
                      </TableRow>
                      <TableRow className="hover:bg-inherit">
                        <TableCell className="font-medium bg-secondary dark:bg-accent truncate text-ellipsis whitespace-nowrap">
                          SCORE
                        </TableCell>
                        {scores.slice(0, holeCount).map((score, i) => (
                          <TableCell
                            key={i}
                            className="p-2 bg-background-alternate dark:bg-bar"
                          >
                            <Input
                              className="border-0 h-full text-center w-full"
                              type="number"
                              value={score || ""}
                              onChange={(e) => {
                                if (e.target.value.length > 2) {
                                  return;
                                }
                                let parsed = parseInt(e.target.value) || 0;
                                if (parsed < 0) {
                                  parsed = 0;
                                  toast({
                                    title: "Invalid score",
                                    description: "Score cannot be negative",
                                    variant: "destructive",
                                  });
                                }
                                handleScoreChange(i, parsed);
                              }}
                            />
                          </TableCell>
                        ))}
                        {holeCount === 18 && (
                          <>
                            <TableCell className="text-center bg-background-alternate dark:bg-bar">
                              {calculateTotal(scores, 0, 9)}
                            </TableCell>
                            <TableCell className="text-center bg-background-alternate dark:bg-bar">
                              {calculateTotal(scores, 9, 18)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center bg-background-alternate dark:bg-bar">
                          {calculateTotal(scores, 0, holeCount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-48">
                <span className="text-2xl text-gray-400">Select a tee</span>
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

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AddTeeDialog } from "./add-tee-dialog";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { EditTeeDialog } from "./edit-tee-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "../ui/use-toast";

interface PlayerScore {
  name: string;
  scores: number[];
}

interface GolfScorecardProps {
  profile: Tables<"Profile">;
}

export default function GolfScorecard({ profile }: GolfScorecardProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course>();
  const [selectedTee, setSelectedTee] = useState<Tee>();
  const [date, setDate] = useState("");
  const [holeCount, setHoleCount] = useState<number>(18);
  const [notes, setNotes] = useState("");
  const [player, setPlayer] = useState<PlayerScore>({
    name: profile.name || "",
    scores: Array(18).fill(0),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300); // Debounce user input

  const [openCourseSelect, setOpenCourseSelect] = useState(false);

  const form = useForm<Scorecard>({
    resolver: zodResolver(scorecardSchema),
    // defaultValues: {
    //   teeTime: undefined,
    //   userId: profile.id,
    //   courseId: undefined,
    //   courseName: "",
    //   holes: Array.from({ length: 18 }).map(() => ({
    //     par: 0,
    //     hcp: 0,
    //     strokes: 0,
    //   })),
    //   scores: [],
    //   teeInfo: {
    //     courseRating18: 0,
    //     courseRatingBack9: 0,
    //     courseRatingFront9: 0,
    //     gender: "",

    //   }
    // },
  });

  const calculateTotal = (scores: number[], start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score, 0);

  const handleUpdateTee = () => {
    // const newCourses = courses.map((course) => {
    //   if (course.id === selectedCourseId) {
    //     return {
    //       ...course,
    //       tees: course.tees.map((tee) =>
    //         tee.name === updatedTee.name ? updatedTee : tee
    //       ),
    //     };
    //   }
    //   return course;
    // });
    // setCourses(newCourses);
    // TODO: Implement
    console.log("Update Tee");
  };

  const {
    data: searchedCourses,
    isLoading,
    error: searchedCoursesError,
  } = api.course.searchCourses.useQuery(
    { query: debouncedSearchTerm },
    { enabled: !!debouncedSearchTerm } // Only fetch if there's input
  );

  const { data: teesData, isLoading: isLoadingTeesData } =
    api.tee.fetchTees.useQuery(
      { courseId: selectedCourse?.id! },
      { enabled: !!selectedCourse }
    );

  const { data: holesData, isLoading: isLoadingHolesData } =
    api.hole.fetchHoles.useQuery(
      { teeId: selectedTee?.id! },
      { enabled: !!selectedTee }
    );

  const handleCourseSearch = (searchString: string) => {
    setSearchTerm(searchString);
  };

  const handleAddTee = () => {
    // const newCourses = courses.map((course) => {
    //   if (course.id === selectedCourseId) {
    //     return {
    //       ...course,
    //       tees: [...course.tees, newTee],
    //     };
    //   }
    //   return course;
    // });
    // setCourses(newCourses);
    console.log("Handle Add Tee");
  };

  const handlePlayerScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...player.scores];
    newScores[holeIndex] = score;
    setPlayer({ ...player, scores: newScores });
  };

  // const handleAddTee = (newTee: TeeInfo) => {
  //   // Add a tee to the tee's of the selected course
  //   // const newCourses = courses.map((course) => {
  //   //   if (course.id === selectedCourseId) {
  //   //     return {
  //   //       ...course,
  //   //       tees: [...course.tees, newTee],
  //   //     };
  //   //   }
  //   //   return course;
  //   // });
  //   // setCourses(newCourses);

  //   console.log("Add");
  // };

  const normalizeHcpForNineHoles = (holes: typeof holesData) => {
    if (holes === undefined) return [];
    if (holes.length === 18) return holes;

    const uniqueHcps = holes.map((hole) => hole.hcp);

    uniqueHcps.sort((a, b) => a - b);
    console.log(uniqueHcps);

    const hcpMapping = new Map(
      uniqueHcps.map((hcp, index) => [hcp, index + 1])
    );

    return holes.map((hole) => ({
      ...hole,
      hcp: hcpMapping.get(hole.hcp) || hole.hcp,
    }));
  };

  const displayedHoles = normalizeHcpForNineHoles(
    holesData?.slice(0, holeCount)
  );

  const onSubmit = () => {
    console.log("submit");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
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
                                  {selectedCourse
                                    ? selectedCourse.name
                                    : "Select course..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Search course..."
                                    onValueChange={(e) => handleCourseSearch(e)}
                                  />
                                  <CommandList
                                    key={searchedCourses?.length ?? 0}
                                  >
                                    {/* ✅ Forces re-render */}
                                    {searchedCourses?.length === 0 &&
                                      !isLoading && (
                                        <CommandEmpty>
                                          No courses found.
                                        </CommandEmpty>
                                      )}
                                    {searchedCourses?.length &&
                                      searchedCourses?.map((course) => (
                                        <CommandItem
                                          key={course.id}
                                          onSelect={() => {
                                            setSelectedCourse(course);
                                            setOpenCourseSelect(false);
                                            form.setValue("course", {
                                              id: course.id,
                                              name: course.name,
                                              approvalStatus:
                                                course.approvalStatus,
                                            });
                                          }}
                                        >
                                          {course.name}
                                        </CommandItem>
                                      ))}
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
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="tee">Tee</Label>
                          <Select
                            value={selectedTee?.name}
                            onValueChange={(value) => {
                              const selectedTee = teesData?.find(
                                (tee) => tee.name === value
                              );
                              if (!selectedTee) {
                                toast({
                                  title: "Error",
                                  description:
                                    "Invalid tee selected, contact support",
                                  variant: "destructive",
                                });
                                return;
                              }
                              setSelectedTee(selectedTee);
                              form.setValue("teePlayed", selectedTee);
                            }}
                          >
                            <SelectTrigger
                              id="tee"
                              disabled={!selectedCourse || !teesData}
                            >
                              <SelectValue placeholder="Select Tee" />
                            </SelectTrigger>
                            <SelectContent>
                              {teesData?.map((tee) => (
                                <SelectItem key={tee.name} value={tee.name}>
                                  {tee.name}
                                </SelectItem>
                              ))}
                              <AddTeeDialog onAdd={handleAddTee} />
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedTee && (
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
                          {/* <EditTeeDialog
                            tee={selectedTeeData}
                            onSave={handleUpdateTee}
                          /> */}
                        </div>
                      </div>
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
            {selectedTee && (
              <div className="overflow-x-auto rounded-lg border">
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
                        {selectedTee.name.toUpperCase()} TEE
                      </TableCell>
                      {displayedHoles &&
                        displayedHoles.slice(0, holeCount).map((hole, i) => (
                          <TableCell key={i} className="text-center">
                            {hole.distance}
                          </TableCell>
                        ))}
                      {holeCount === 18 && (
                        <>
                          <TableCell className="text-center font-medium bg-background">
                            {selectedTee.outDistance}
                          </TableCell>
                          <TableCell className="text-center font-medium bg-background">
                            {selectedTee.inDistance}
                          </TableCell>
                          <TableCell className="text-center font-medium bg-background">
                            {selectedTee.totalDistance}
                          </TableCell>
                        </>
                      )}
                      {holeCount === 9 && (
                        <TableCell className="text-center font-medium bg-background">
                          {selectedTee.outDistance}
                        </TableCell>
                      )}
                    </TableRow>
                    <TableRow className="hover:bg-inherit">
                      <TableCell className="font-medium bg-secondary dark:bg-accent">
                        PAR
                      </TableCell>
                      {displayedHoles &&
                        displayedHoles.slice(0, holeCount).map((hole, i) => (
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
                            {selectedTee.outPar}
                          </TableCell>
                          <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                            {selectedTee.inPar}
                          </TableCell>
                          <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                            {selectedTee.totalPar}
                          </TableCell>
                        </>
                      )}
                      {holeCount === 9 && (
                        <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                          {selectedTee.outPar}
                        </TableCell>
                      )}
                    </TableRow>
                    <TableRow className="hover:bg-inherit">
                      <TableCell className="font-medium bg-secondary dark:bg-accent">
                        HANDICAP
                      </TableCell>
                      {displayedHoles &&
                        displayedHoles.slice(0, holeCount).map((hole, i) => (
                          <TableCell key={i} className="text-center">
                            {hole.hcp}
                          </TableCell>
                        ))}
                      {holeCount === 18 ? (
                        <TableCell className="bg-background" colSpan={3} />
                      ) : (
                        <TableCell className="bg-background" />
                      )}
                    </TableRow>
                    <TableRow className="hover:bg-inherit">
                      <TableCell className="font-medium bg-secondary dark:bg-accent truncate text-ellipsis whitespace-nowrap">
                        {player.name.toUpperCase()}
                      </TableCell>
                      {player.scores.slice(0, holeCount).map((score, i) => (
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
                              if (parseInt(e.target.value) < 0) {
                                e.target.value = "0";
                                toast({
                                  title: "Invalid score",
                                  description: "Score cannot be negative",
                                  variant: "destructive",
                                });
                              }
                              handlePlayerScoreChange(
                                i,
                                parseInt(e.target.value) || 0
                              );
                            }}
                          />
                        </TableCell>
                      ))}
                      {holeCount === 18 && (
                        <>
                          <TableCell className="text-center bg-background-alternate dark:bg-bar">
                            {calculateTotal(player.scores, 0, 9)}
                          </TableCell>
                          <TableCell className="text-center bg-background-alternate dark:bg-bar">
                            {calculateTotal(player.scores, 9, 18)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-center bg-background-alternate dark:bg-bar">
                        {calculateTotal(player.scores, 0, holeCount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
            {!selectedTee && (
              <div className="flex justify-center items-center h-48">
                <span className="text-2xl text-gray-400">Select a tee</span>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

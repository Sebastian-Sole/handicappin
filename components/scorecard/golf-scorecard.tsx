"use client";

import { useEffect, useState, useMemo } from "react";
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
  const [userCourses, setUserCourses] = useState<Course[]>([]);
  const [userTees, setUserTees] = useState<Tee[]>([]);
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
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [openCourseSelect, setOpenCourseSelect] = useState(false);

  const form = useForm<Scorecard>({
    resolver: zodResolver(scorecardSchema),
    // defaultValues: { ... },
  });

  const {
    data: searchedCourses,
    isLoading,
    error: searchedCoursesError,
  } = api.course.searchCourses.useQuery(
    { query: debouncedSearchTerm },
    {
      enabled: !!debouncedSearchTerm,
    }
  );

  const { data: teesData, isLoading: isLoadingTeesData } =
    api.tee.fetchTees.useQuery(
      { courseId: selectedCourse?.id! },
      {
        enabled:
          !!selectedCourse?.id && selectedCourse.approvalStatus === "approved",
      }
    );

  const { data: holesData, isLoading: isLoadingHolesData } =
    api.hole.fetchHoles.useQuery(
      { teeId: selectedTee?.id! },
      {
        enabled: !!selectedTee?.id && selectedTee.approvalStatus === "approved",
      }
    );

  useEffect(() => {
    if (selectedTee && holesData) {
      setSelectedTee({ ...selectedTee, holes: holesData });
    }
  }, [holesData]);

  const combinedCourses = useMemo(() => {
    return [...(searchedCourses || []), ...userCourses];
  }, [searchedCourses, userCourses]);

  const combinedTees = useMemo(() => {
    if (!selectedCourse?.id) return [];
    const serverTees = teesData ?? [];
    const localTees = userTees.filter(
      (tee) => tee.courseId === selectedCourse.id
    );
    return [...serverTees, ...localTees];
  }, [teesData, userTees, selectedCourse?.id]);

  const handleCourseSearch = (searchString: string) => {
    setSearchTerm(searchString);
  };

  const handleAddCourse = (course: Course) => {
    setOpenCourseSelect(false);

    if (!course.tees || course.tees.length === 0) {
      toast({
        title: "Error",
        description: "Course must have at least one tee",
        variant: "destructive",
      });
      return;
    }
    setUserCourses((prev) => [...prev, course]);
    setUserTees((prevTees) => [...prevTees, ...course.tees!]);
    setSelectedCourse(course);
    setSelectedTee(course.tees![0]);
  };

  const handleAddTee = (newTee: Tee) => {
    console.log("Implement add tee");
  };

  const handleUpdateTee = () => {
    console.log("Update Tee");
  };

  const handlePlayerScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...player.scores];
    newScores[holeIndex] = score;
    setPlayer({ ...player, scores: newScores });
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

  const displayedHoles = normalizeHcpForNineHoles(
    selectedTee?.holes?.slice(0, holeCount)
  );

  const onSubmit = () => {
    console.log("Form is being submitted with data:");
    console.log(form.getValues());
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
                                    onValueChange={handleCourseSearch}
                                  />
                                  <CommandList>
                                    {combinedCourses.length === 0 &&
                                      !isLoading && (
                                        <CommandEmpty>
                                          <AddCourseDialog
                                            onAdd={handleAddCourse}
                                          />
                                        </CommandEmpty>
                                      )}
                                    <CommandGroup className="py-6">
                                      {combinedCourses.length > 0 &&
                                        !isLoading &&
                                        combinedCourses.map((course) => (
                                          <>
                                            <CommandItem
                                              key={course.id || course.name}
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
                                            <CommandItem>
                                              <AddCourseDialog
                                                onAdd={handleAddCourse}
                                              />
                                            </CommandItem>
                                          </>
                                        ))}
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
                              <Select
                                value={selectedTee?.name}
                                onValueChange={(value) => {
                                  const foundTee = combinedTees.find(
                                    (tee) => tee.name === value
                                  );
                                  if (!foundTee) {
                                    return;
                                  }
                                  setSelectedTee(foundTee);
                                  form.setValue("teePlayed", foundTee);
                                }}
                              >
                                <SelectTrigger
                                  id="tee"
                                  disabled={
                                    !selectedCourse || combinedTees.length === 0
                                  }
                                >
                                  <SelectValue placeholder="Select Tee" />
                                </SelectTrigger>
                                <SelectContent>
                                  {combinedTees.map((tee) => (
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
                                tee={selectedTee}
                                onSave={handleUpdateTee}
                              /> */}
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
            {selectedTee ? (
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
                          {selectedTee.name.toUpperCase()} TEE
                        </TableCell>
                        {displayedHoles.map((hole, i) => (
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
                          </>
                        )}
                        <TableCell className="text-center font-medium bg-background">
                          {holeCount === 18
                            ? selectedTee.totalDistance
                            : selectedTee.outDistance}
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
                              {selectedTee.outPar}
                            </TableCell>
                            <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                              {selectedTee.inPar}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center font-medium bg-background-alternate dark:bg-bar">
                          {holeCount === 18
                            ? selectedTee.totalPar
                            : selectedTee.outPar}
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
                                let parsed = parseInt(e.target.value) || 0;
                                if (parsed < 0) {
                                  parsed = 0;
                                  toast({
                                    title: "Invalid score",
                                    description: "Score cannot be negative",
                                    variant: "destructive",
                                  });
                                }
                                handlePlayerScoreChange(i, parsed);
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
              </div>
            ) : (
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

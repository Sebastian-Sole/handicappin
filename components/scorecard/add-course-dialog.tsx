"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TriangleAlert } from "lucide-react";
import { DialogPage, MultiPageDialog } from "../ui/multi-page-dialog";
import { Course, courseSchema } from "@/types/scorecard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Separator } from "../ui/separator";
import { Large } from "../ui/typography";
import { defaultTee, validCourse } from "@/utils/scorecard/tee";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
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
import { toast } from "../ui/use-toast";
import { useState } from "react";

interface AddCourseDialogProps {
  onAdd: (newCourse: Course) => void;
}

export function AddCourseDialog({ onAdd }: AddCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<Course>({
    resolver: zodResolver(courseSchema),
    // defaultValues: {
    //   name: "",
    //   approvalStatus: "pending",
    //   id: "-1",
    //   tees: [{ ...defaultTee }],
    // },
    defaultValues: validCourse,
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = form;

  const watchName = watch("name");
  const watchTees = watch("tees");

  const onSubmit = (values: Course) => {
    onAdd(values);
    setOpen(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <MultiPageDialog
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Course
            </Button>
          }
          isNextButtonDisabled={!watchName}
          handleSave={handleSubmit(onSubmit, (errors) => {
            console.log(errors);
            toast({
              title: "Failed to add course",
              description:
                "Please check the form for errors/missing data, or contact support",
              variant: "destructive",
            });
          })}
          open={open}
          setOpen={setOpen}
        >
          <DialogPage title="Add New Course">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <div className="space-y-2 py-4">
                  <FormLabel htmlFor="courseName">Course Name</FormLabel>
                  <FormItem>
                    <FormControl>
                      <Input {...field} placeholder="Enter course name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              )}
            />
          </DialogPage>

          <DialogPage
            title="Add New Tee"
            className="max-w-[250px] sm:max-w-[350px] md:max-w-[550px]"
          >
            <>
              <Alert>
                <TriangleAlert className="h-4 w-4" />{" "}
                <AlertTitle>Heads up!</AlertTitle>
                <AlertDescription>
                  Enter <strong>18 hole values</strong> for the new tee even if
                  you are adding a tee for a 9-hole course. You can choose to
                  enter a 9-hole round on this tee when you submit your
                  scorecard. The course pro shop can help you find the correct
                  information.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 py-4">
                {/* Tee Information */}
                <div className="space-y-4 pb-4">
                  <Separator />
                  <Large>Tee Information</Large>
                  <FormField
                    control={control}
                    name="tees.0.name"
                    render={({ field }) => (
                      <div className="space-y-2">
                        <FormLabel htmlFor="newTeeName">Name</FormLabel>
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="e.g., RED" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </div>
                    )}
                  />

                  <FormField
                    control={control}
                    name="tees.0.distanceMeasurement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance Measurement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            defaultValue="meters"
                            className="mt-2"
                            onValueChange={field.onChange}
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="meters" />
                              </FormControl>
                              <FormLabel className="!mt-0">meters</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="yards" />
                              </FormControl>
                              <FormLabel className="!mt-0">yards</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="tees.0.gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Men&apos;s/Ladies</FormLabel>
                        <FormControl>
                          <RadioGroup
                            defaultValue="mens"
                            onValueChange={field.onChange}
                            className="mt-2"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="mens" />
                              </FormControl>
                              <FormLabel className="!mt-0">mens</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="ladies" />
                              </FormControl>
                              <FormLabel className="!mt-0">ladies</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Course Rating */}
                <div className="space-y-4 pb-4">
                  <Separator />
                  <Large>Course Rating</Large>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={control}
                      name="tees.0.courseRatingFront9"
                      render={({ field }) => {
                        const back9 = watch("tees.0.courseRatingBack9") || 0;
                        return (
                          <div className="space-y-2">
                            <FormItem>
                              <FormLabel htmlFor="courseRatingFrontNine">
                                Front 9
                              </FormLabel>
                              <FormControl>
                                <Input
                                  id="courseRatingFrontNine"
                                  type="number"
                                  step="0.1"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value =
                                      parseFloat(e.target.value) || 0;
                                    setValue(
                                      "tees.0.courseRatingFront9",
                                      value
                                    );
                                    // Recompute total
                                    const total = value + back9;
                                    setValue("tees.0.courseRating18", total);
                                  }}
                                  placeholder="e.g., 39.5"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </div>
                        );
                      }}
                    />

                    <FormField
                      control={control}
                      name="tees.0.courseRatingBack9"
                      render={({ field }) => {
                        const front9 = watch("tees.0.courseRatingFront9") || 0;
                        return (
                          <div className="space-y-2">
                            <FormLabel htmlFor="courseRatingBack9">
                              Back 9
                            </FormLabel>
                            <FormItem>
                              <FormControl>
                                <Input
                                  id="courseRatingBack9"
                                  type="number"
                                  step="0.1"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value =
                                      parseFloat(e.target.value) || 0;
                                    setValue("tees.0.courseRatingBack9", value);
                                    const total = front9 + value;
                                    setValue("tees.0.courseRating18", total);
                                  }}
                                  placeholder="e.g., 40.3"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </div>
                        );
                      }}
                    />

                    <FormField
                      control={control}
                      name="tees.0.courseRating18"
                      render={({ field }) => {
                        return (
                          <div className="space-y-2">
                            <FormLabel htmlFor="courseRating18">
                              Total
                            </FormLabel>
                            <FormItem>
                              <FormControl>
                                <Input
                                  id="courseRating18"
                                  type="number"
                                  step="0.1"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value =
                                      parseFloat(e.target.value) || 0;
                                    setValue("tees.0.courseRating18", value);
                                    const half = value / 2;
                                    setValue("tees.0.courseRatingFront9", half);
                                    setValue("tees.0.courseRatingBack9", half);
                                  }}
                                  placeholder="e.g., 79.8"
                                />
                              </FormControl>
                            </FormItem>
                          </div>
                        );
                      }}
                    />
                  </div>

                  <Large>Slope Rating</Large>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={control}
                      name="tees.0.slopeRatingFront9"
                      render={({ field }) => {
                        const back9 = watch("tees.0.slopeRatingBack9") || 0;
                        return (
                          <div className="space-y-2">
                            <FormLabel htmlFor="slopeRatingFront9">
                              Front 9
                            </FormLabel>
                            <FormItem>
                              <FormControl>
                                <Input
                                  id="slopeRatingFront9"
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setValue("tees.0.slopeRatingFront9", value);
                                    const total = Math.ceil(
                                      (value + back9) / 2
                                    );
                                    setValue("tees.0.slopeRating18", total);
                                  }}
                                  placeholder="e.g., 147"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </div>
                        );
                      }}
                    />
                    <FormField
                      control={control}
                      name="tees.0.slopeRatingBack9"
                      render={({ field }) => {
                        const front9 = watch("tees.0.slopeRatingFront9") || 0;
                        return (
                          <div className="space-y-2">
                            <FormLabel htmlFor="slopeRatingBack9">
                              Back 9
                            </FormLabel>
                            <FormItem>
                              <FormControl>
                                <Input
                                  id="slopeRatingBack9"
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setValue("tees.0.slopeRatingBack9", value);
                                    const total = Math.ceil(
                                      (front9 + value) / 2
                                    );
                                    setValue("tees.0.slopeRating18", total);
                                  }}
                                  placeholder="e.g., 149"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </div>
                        );
                      }}
                    />

                    <FormField
                      control={control}
                      name="tees.0.slopeRating18"
                      render={({ field }) => {
                        const front9 = watch("tees.0.slopeRatingFront9") || 0;
                        const back9 = watch("tees.0.slopeRatingBack9") || 0;
                        return (
                          <div className="space-y-2">
                            <FormLabel htmlFor="slopeRating18">Total</FormLabel>
                            <FormItem>
                              <FormControl>
                                <Input
                                  id="slopeRating18"
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    setValue("tees.0.slopeRating18", value);
                                    const halfFront = Math.floor(value / 2);
                                    const halfBack = Math.ceil(value / 2);
                                    setValue(
                                      "tees.0.slopeRatingFront9",
                                      halfFront
                                    );
                                    setValue(
                                      "tees.0.slopeRatingBack9",
                                      halfBack
                                    );
                                  }}
                                  placeholder="e.g., 148"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          </div>
                        );
                      }}
                    />
                  </div>
                </div>

                {/* Hole Information */}
                <div className="space-y-4">
                  <Separator />
                  <Large>Hole Information</Large>
                  <div className="rounded-lg border max-w-[270px] sm:max-w-[350px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1600px]">
                    <div className="overflow-x-auto max-w-full">
                      <Table className="max-w-[200px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Hole</TableHead>
                            {Array.from({ length: 18 }, (_, i) => (
                              <TableHead key={i} className="text-center">
                                {i + 1}
                              </TableHead>
                            ))}
                            <TableHead>Out</TableHead>
                            <TableHead className="text-center">In</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              Distance
                            </TableCell>
                            {watchTees?.[0]?.holes?.map(
                              ({ distance }, index) => (
                                <TableCell
                                  key={index}
                                  className="p-0 min-w-[50px]"
                                >
                                  <FormField
                                    control={control}
                                    name={`tees.0.holes.${index}.distance`}
                                    render={({ field }) => {
                                      return (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              value={field.value || ""}
                                              onChange={(e) => {
                                                const newValue =
                                                  parseInt(e.target.value) || 0;
                                                const newHoles = [
                                                  ...(watchTees?.[0]?.holes ||
                                                    []),
                                                ];
                                                newHoles[index] = {
                                                  ...newHoles[index],
                                                  distance: newValue,
                                                };

                                                const outDistance = newHoles
                                                  .slice(0, 9)
                                                  .reduce(
                                                    (acc, h) =>
                                                      acc + (h.distance || 0),
                                                    0
                                                  );
                                                const inDistance = newHoles
                                                  .slice(9, 18)
                                                  .reduce(
                                                    (acc, h) =>
                                                      acc + (h.distance || 0),
                                                    0
                                                  );
                                                const totalDistance =
                                                  outDistance + inDistance;

                                                setValue(
                                                  "tees.0.holes",
                                                  newHoles
                                                );
                                                setValue(
                                                  "tees.0.outDistance",
                                                  outDistance
                                                );
                                                setValue(
                                                  "tees.0.inDistance",
                                                  inDistance
                                                );
                                                setValue(
                                                  "tees.0.totalDistance",
                                                  totalDistance
                                                );
                                              }}
                                              className="border-0 text-center w-16 mx-1"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      );
                                    }}
                                  />
                                </TableCell>
                              )
                            )}
                            <TableCell>
                              {watch("tees.0.outDistance") || 0}
                            </TableCell>
                            <TableCell>
                              {watch("tees.0.inDistance") || 0}
                            </TableCell>
                            <TableCell>
                              {watch("tees.0.totalDistance") || 0}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">Par</TableCell>
                            {watchTees?.[0]?.holes?.map(({ par }, index) => (
                              <TableCell key={index} className="p-0">
                                <FormField
                                  control={control}
                                  name={`tees.0.holes.${index}.par`}
                                  render={({ field }) => {
                                    return (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            value={field.value || ""}
                                            onChange={(e) => {
                                              const newValue =
                                                parseInt(e.target.value) || 0;
                                              const newHoles = [
                                                ...(watchTees?.[0]?.holes ||
                                                  []),
                                              ];
                                              newHoles[index] = {
                                                ...newHoles[index],
                                                par: newValue,
                                              };

                                              const outPar = newHoles
                                                .slice(0, 9)
                                                .reduce(
                                                  (acc, h) =>
                                                    acc + (h.par || 0),
                                                  0
                                                );
                                              const inPar = newHoles
                                                .slice(9, 18)
                                                .reduce(
                                                  (acc, h) =>
                                                    acc + (h.par || 0),
                                                  0
                                                );
                                              const totalPar = outPar + inPar;

                                              setValue(
                                                "tees.0.holes",
                                                newHoles
                                              );
                                              setValue("tees.0.outPar", outPar);
                                              setValue("tees.0.inPar", inPar);
                                              setValue(
                                                "tees.0.totalPar",
                                                totalPar
                                              );
                                            }}
                                            className="border-0 text-center w-16 mx-1"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
                                />
                              </TableCell>
                            ))}
                            <TableCell>{watch("tees.0.outPar") || 0}</TableCell>
                            <TableCell>{watch("tees.0.inPar") || 0}</TableCell>
                            <TableCell>
                              {watch("tees.0.totalPar") || 0}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              Handicap
                            </TableCell>
                            {watchTees?.[0]?.holes?.map(({ hcp }, index) => (
                              <TableCell key={index} className="p-0">
                                <FormField
                                  control={control}
                                  name={`tees.0.holes.${index}.hcp`}
                                  render={({ field }) => {
                                    return (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            value={field.value || ""}
                                            onChange={(e) => {
                                              const newValue =
                                                parseInt(e.target.value) || 0;
                                              const newHoles = [
                                                ...(watchTees?.[0]?.holes ||
                                                  []),
                                              ];
                                              newHoles[index] = {
                                                ...newHoles[index],
                                                hcp: newValue,
                                              };
                                              setValue(
                                                "tees.0.holes",
                                                newHoles
                                              );
                                            }}
                                            className="border-0 text-center w-16 mx-1"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    );
                                  }}
                                />
                              </TableCell>
                            ))}
                            <TableCell>N/A</TableCell>
                            <TableCell>N/A</TableCell>
                            <TableCell>N/A</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            </>
          </DialogPage>
        </MultiPageDialog>
      </form>
    </Form>
  );
}

"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { TriangleAlert } from "lucide-react";
import { Course } from "@/types/scorecard";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Separator } from "../ui/separator";
import { Large } from "../ui/typography";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "../ui/form";
import { Input } from "@/components/ui/input";

export function TeeFormContent() {
  const { control, watch, setValue } = useFormContext<Course>();
  const watchTees = watch("tees");

  return (
    <>
      <Alert>
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          Enter <strong>18 hole values</strong> for the new tee...
        </AlertDescription>
      </Alert>

      <div className="space-y-2 py-4">
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
                            const value = parseFloat(e.target.value) || 0;
                            setValue("tees.0.courseRatingFront9", value);
                            setValue("tees.0.courseRating18", value + back9);
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
                    <FormLabel htmlFor="courseRatingBack9">Back 9</FormLabel>
                    <FormItem>
                      <FormControl>
                        <Input
                          id="courseRatingBack9"
                          type="number"
                          step="0.1"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setValue("tees.0.courseRatingBack9", value);
                            setValue("tees.0.courseRating18", front9 + value);
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
                    <FormLabel htmlFor="courseRating18">Total</FormLabel>
                    <FormItem>
                      <FormControl>
                        <Input
                          id="courseRating18"
                          type="number"
                          step="0.1"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setValue("tees.0.courseRating18", value);
                            // This is your existing “split it in half” logic
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
                    <FormLabel htmlFor="slopeRatingFront9">Front 9</FormLabel>
                    <FormItem>
                      <FormControl>
                        <Input
                          id="slopeRatingFront9"
                          type="number"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setValue("tees.0.slopeRatingFront9", value);
                            const total = Math.ceil((value + back9) / 2);
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
                    <FormLabel htmlFor="slopeRatingBack9">Back 9</FormLabel>
                    <FormItem>
                      <FormControl>
                        <Input
                          id="slopeRatingBack9"
                          type="number"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setValue("tees.0.slopeRatingBack9", value);
                            const total = Math.ceil((front9 + value) / 2);
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
                            setValue("tees.0.slopeRatingFront9", halfFront);
                            setValue("tees.0.slopeRatingBack9", halfBack);
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
                    <TableCell className="font-medium">Distance</TableCell>
                    {watchTees?.[0]?.holes?.map(({ distance }, index) => (
                      <TableCell key={index} className="p-0 min-w-[50px]">
                        <FormField
                          control={control}
                          name={`tees.0.holes.${index}.distance`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const newValue =
                                      parseInt(e.target.value) || 0;
                                    // Update that hole's distance
                                    const newHoles = [
                                      ...(watchTees?.[0]?.holes || []),
                                    ];
                                    newHoles[index] = {
                                      ...newHoles[index],
                                      distance: newValue,
                                    };

                                    // Recompute outDistance, inDistance, totalDistance
                                    const outDistance = newHoles
                                      .slice(0, 9)
                                      .reduce(
                                        (acc, h) => acc + (h.distance || 0),
                                        0
                                      );
                                    const inDistance = newHoles
                                      .slice(9, 18)
                                      .reduce(
                                        (acc, h) => acc + (h.distance || 0),
                                        0
                                      );
                                    const totalDistance =
                                      outDistance + inDistance;

                                    // Set the entire holes array with updated hole
                                    setValue("tees.0.holes", newHoles);
                                    setValue("tees.0.outDistance", outDistance);
                                    setValue("tees.0.inDistance", inDistance);
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
                          )}
                        />
                      </TableCell>
                    ))}
                    <TableCell>{watch("tees.0.outDistance") || 0}</TableCell>
                    <TableCell>{watch("tees.0.inDistance") || 0}</TableCell>
                    <TableCell>{watch("tees.0.totalDistance") || 0}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">Par</TableCell>
                    {watchTees?.[0]?.holes?.map(({ par }, index) => (
                      <TableCell key={index} className="p-0">
                        <FormField
                          control={control}
                          name={`tees.0.holes.${index}.par`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const newValue =
                                      parseInt(e.target.value) || 0;
                                    const newHoles = [
                                      ...(watchTees?.[0]?.holes || []),
                                    ];
                                    newHoles[index] = {
                                      ...newHoles[index],
                                      par: newValue,
                                    };

                                    const outPar = newHoles
                                      .slice(0, 9)
                                      .reduce(
                                        (acc, h) => acc + (h.par || 0),
                                        0
                                      );
                                    const inPar = newHoles
                                      .slice(9, 18)
                                      .reduce(
                                        (acc, h) => acc + (h.par || 0),
                                        0
                                      );
                                    const totalPar = outPar + inPar;

                                    setValue("tees.0.holes", newHoles);
                                    setValue("tees.0.outPar", outPar);
                                    setValue("tees.0.inPar", inPar);
                                    setValue("tees.0.totalPar", totalPar);
                                  }}
                                  className="border-0 text-center w-16 mx-1"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                    ))}
                    <TableCell>{watch("tees.0.outPar") || 0}</TableCell>
                    <TableCell>{watch("tees.0.inPar") || 0}</TableCell>
                    <TableCell>{watch("tees.0.totalPar") || 0}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">Handicap</TableCell>
                    {watchTees?.[0]?.holes?.map(({ hcp }, index) => (
                      <TableCell key={index} className="p-0">
                        <FormField
                          control={control}
                          name={`tees.0.holes.${index}.hcp`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const newValue =
                                      parseInt(e.target.value) || 0;
                                    const newHoles = [
                                      ...(watchTees?.[0]?.holes || []),
                                    ];
                                    newHoles[index] = {
                                      ...newHoles[index],
                                      hcp: newValue,
                                    };
                                    setValue("tees.0.holes", newHoles);
                                  }}
                                  className="border-0 text-center w-16 mx-1"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
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
  );
}

"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { roundSchema } from "@/types/round";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Large, Small } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";
import React from "react";
import {
  calculateAdjustedGrossScore,
  calculateScoreDifferential,
} from "@/utils/calculations/handicap";

const AddRoundForm = () => {
  const [numberOfHoles, setNumberOfHoles] = useState(9); // Default to 9 holes

  const form = useForm<z.infer<typeof roundSchema>>({
    resolver: zodResolver(roundSchema),
  });

  const { mutate } = api.round.create.useMutation({
    onSuccess: () => {
      console.log("Round created successfully");
    },
    onError: (e) => {
      const errorMessage = e.data?.zodError?.fieldErrors.content;
      console.error("Error creating investment:", errorMessage);
    },
  });

  function onSubmit(values: z.infer<typeof roundSchema>) {
    console.log(values);

    const adjustedGrossScore = calculateAdjustedGrossScore(values.holes);

    const dataValues = {
      ...values,
      score: adjustedGrossScore,
    };

    mutate(dataValues);
  }

  return (
    <Card className="md:w-[70%] w-full">
      <CardHeader>
        <CardTitle>Add Round</CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Large>Course Info</Large>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tee Time</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date: any) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormDescription>
                    This is the date you played the round
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Where did you play the round?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-4 items-center">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="courseInfo.par"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sm:block">Par</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="courseInfo.courseRating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hidden sm:block">
                        Course Rating
                      </FormLabel>
                      <FormLabel className="flex sm:hidden">CR</FormLabel>
                      {/* <FormLabel>Course Rating</FormLabel> */}

                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="courseInfo.slope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sm:block">Slope</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="numberOfHoles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Holes</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(Number(value));
                        setNumberOfHoles(Number(value)); // Update the number of holes
                      }}
                      defaultValue={
                        (field.value && field.value.toString()) || "9"
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={9} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="9">9 holes</SelectItem>
                        <SelectItem value="18">18 holes</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-0" />

            {/* For each hole, add a form field to register the attributes of the hole (an input for hole number, par, hcp and strokes) */}
            {Array.from({ length: numberOfHoles }).map((_, index) => (
              <React.Fragment key={index}>
                <div className="space-y-1">
                  <Small className="text-xl font-bold">Hole {index + 1}</Small>
                  <div className="flex space-x-4 items-start">
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`holes.${index}.par`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Par</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="3" />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`holes.${index}.hcp`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HCP</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`holes.${index}.strokes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Strokes</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <Separator />
              </React.Fragment>
            ))}

            <Button type="submit">Save Round</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AddRoundForm;

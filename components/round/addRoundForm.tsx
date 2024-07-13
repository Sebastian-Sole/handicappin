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
import { Large, Small } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";
import React, { useState } from "react";
import { calculateAdjustedGrossScore } from "@/utils/calculations/handicap";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";

interface AddRoundFormProps {
  userId: string | undefined;
}

const AddRoundForm = ({ userId }: AddRoundFormProps) => {
  const router = useRouter();
  const { toast } = useToast();

  if (!userId) {
    router.push("/login");
  }

  const [numberOfHoles, setNumberOfHoles] = useState(9);

  const form = useForm<z.infer<typeof roundSchema>>({
    resolver: zodResolver(roundSchema),
    defaultValues: {
      numberOfHoles: 9,
      holes: Array.from({ length: 9 }).map((value, index) => ({
        par: 3,
        hcp: 1,
        strokes: 3,
        holeNumber: index + 1,
      })),
      date: new Date(),
      courseInfo: {
        par: 27,
        courseRating: 50.3,
        slope: 82,
      },
      location: "",
      score: 1,
      userId: userId,
    },
  });

  const { mutate } = api.round.create.useMutation({
    onSuccess: () => {
      console.log("Round created successfully");
      toast({
        title: "✅ Round created successfully",
        description: "Your round has been added to your profile!",
      });
      router.push("/");
    },
    onError: (e) => {
      const errorMessage = e.data?.zodError?.fieldErrors.content;
      console.error("Error creating round:");
      console.log(e);
      console.log(errorMessage);
      toast({
        title: "❌ Error creating round",
        description: `${errorMessage}`,
      });
    },
  });

  function onSubmit(values: z.infer<typeof roundSchema>) {
    console.log("SUBMITTING FORM");
    console.log(values);

    const adjustedGrossScore = calculateAdjustedGrossScore(values.holes);

    const dataValues = {
      ...values,
      score: adjustedGrossScore,
    };

    mutate(dataValues);
  }

  function handleNumericChange(field: any) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      field.onChange(value === "" ? null : Number(value));
    };
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
                        <Input
                          {...field}
                          type="number"
                          onChange={handleNumericChange(field)}
                        />
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
                        <Input
                          type="number"
                          {...field}
                          onChange={handleNumericChange(field)}
                        />
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
                        <Input
                          type="number"
                          {...field}
                          onChange={handleNumericChange(field)}
                        />
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
                              <Input
                                type="number"
                                {...field}
                                onChange={handleNumericChange(field)}
                              />
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
                              <Input
                                type="number"
                                {...field}
                                onChange={handleNumericChange(field)}
                              />
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
                              <Input
                                type="number"
                                {...field}
                                onChange={handleNumericChange(field)}
                              />
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

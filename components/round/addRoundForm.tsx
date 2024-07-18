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
import { addRoundFormSchema } from "@/types/round";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";
import { Tables } from "@/types/supabase";
import type { FormRound, RoundMutation } from "@/types/round";
import { DateTimePicker } from "../ui/datepicker";
import useMounted from "@/hooks/useMounted";
import FormSkeleton from "../formSkeleton";
import { translateRound } from "@/utils/round/addUtils";
import { rounds, roundZero } from "@/utils/populateDb";

interface AddRoundFormProps {
  profile: Tables<"Profile">;
}

const AddRoundForm = ({ profile }: AddRoundFormProps) => {
  const isMounted = useMounted();

  const router = useRouter();
  const { toast } = useToast();

  if (!profile) {
    router.push("/login");
  }

  const [numberOfHoles, setNumberOfHoles] = useState(9);

  const form = useForm<z.infer<typeof addRoundFormSchema>>({
    resolver: zodResolver(addRoundFormSchema),
    defaultValues: {
      numberOfHoles: 9,
      holes: Array.from({ length: 9 }).map((value, index) => ({
        par: 3,
        hcp: 1,
        strokes: 3,
        holeNumber: index + 1,
      })),
      date: undefined,
      courseInfo: {
        par: 27,
        courseRating: 50.3,
        slope: 82,
      },
      userId: profile.id,
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

  function onSubmit(values: z.infer<typeof addRoundFormSchema>) {
    const dataValues: RoundMutation | null = translateRound(values, profile);
    if (!dataValues) {
      return;
    }
    mutate(dataValues);
  }

  function handleNumericChange(field: any) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      field.onChange(value === "" ? null : Number(value));
    };
  }

  const handlePopulateDb = async () => {
    const holeZero: RoundMutation = {
      adjustedGrossScore: 128,
      adjustedPlayedScore: 128,
      courseInfo: {
        courseRating: 72,
        location: "Artificial",
        par: 72,
        slope: 113,
      },
      courseRating: 72,
      eighteenHolePar: 72,
      nineHolePar: 36,
      existingHandicapIndex: 54,
      holes: roundZero.holes,
      parPlayed: 72,
      scoreDifferential: 56,
      slopeRating: 113,
      teeTime: new Date("2021-09-01T12:00:00.000Z"),
      totalStrokes: 128,
      userId: profile.id,
    };
    mutate(holeZero);

    const handleAddData = (roundToAdd: FormRound) => {
      const dataValue = translateRound(roundToAdd, profile);
      if (!dataValue) {
        console.log("Data values invalid");
        console.log(roundToAdd);
        console.log(dataValue);
        return;
      }
      mutate(dataValue);
    };

    const roundsToAdd = rounds;
    roundsToAdd.forEach((round) => {
      handleAddData(round);
    });
  };

  if (!isMounted) {
    return <FormSkeleton />;
  }

  return (
    <Card className="md:w-[70%] w-full">
      <CardHeader>
        <CardTitle>Add Round</CardTitle>
        <Button onClick={handlePopulateDb}>Populate DB</Button>
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
                    <DateTimePicker
                      granularity="minute"
                      value={field.value}
                      onChange={field.onChange}
                    />
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
              name="courseInfo.location"
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

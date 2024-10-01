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
import { Small } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";
import { Tables } from "@/types/supabase";
import type { RoundMutation } from "@/types/round";
import { DateTimePicker } from "../ui/datepicker";
import useMounted from "@/hooks/useMounted";
import { translateRound } from "@/utils/round/addUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { InfoIcon } from "lucide-react";
import AddRoundFormSkeleton from "./add-round-form-skeleton";

interface AddRoundFormProps {
  profile: Tables<"Profile">;
}

const AddRoundForm = ({ profile }: AddRoundFormProps) => {
  const isMounted = useMounted();

  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isSaveButtonLocked, setIsSaveButtonLocked] = useState(false);

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
        hcpStrokes: 0,
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
      setLoading(false);
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
      setLoading(false);
      setIsSaveButtonLocked(false);
    },
  });

  function onSubmit(values: z.infer<typeof addRoundFormSchema>) {
    setLoading(true);
    setIsSaveButtonLocked(true);
    const dataValues: RoundMutation | null = translateRound(values, profile);
    if (!dataValues) {
      toast({
        title: "❌ Error creating round",
        description:
          "There was an error creating the round, could not convert data. Please hard refresh and try again, or contact support",
      });
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

  if (!isMounted) {
    return <AddRoundFormSkeleton />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 mx-auto p-6"
      >
        <Card className="w-full">
          <CardHeader className="flex justify-between items-center flex-row">
            <CardTitle>Course Information</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex flex-row">
                  {" "}
                  <InfoIcon
                    className={`h-6 w-6 text-gray-500 dark:text-gray-400 mr-2`}
                  />{" "}
                  <p className="text-gray-500 md:block hidden">Need help?</p>
                </TooltipTrigger>
                <TooltipContent className="max-w-80">
                  <p>
                    You can find the <b>course rating</b>, <b>slope</b> and{" "}
                    <b>par</b> on the scorecard of the course you played. If
                    you&apos;re unsure, you can ask the pro shop or check the
                    course&apos;s website.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>

          <Separator />

          <CardContent className="space-y-6 pt-6">
            {" "}
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
                      disabled={loading}
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
                  <FormLabel>Course Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={loading} />
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
                          onChange={handleNumericChange(field)}
                          disabled={loading}
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
                      <FormControl>
                        <Input
                          {...field}
                          onChange={handleNumericChange(field)}
                          disabled={loading}
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
                          {...field}
                          onChange={handleNumericChange(field)}
                          disabled={loading}
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
                        setNumberOfHoles(Number(value));
                      }}
                      defaultValue={
                        (field.value && field.value.toString()) || "9"
                      }
                      disabled={loading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={9} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="9" disabled={loading}>
                          9 holes
                        </SelectItem>
                        <SelectItem value="18" disabled={loading}>
                          18 holes
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holes Played</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent>
            {Array.from({ length: numberOfHoles }).map((_, index) => (
              <React.Fragment key={index}>
                <div className="space-y-2 py-4">
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
                                value={field.value === 0 ? "" : field.value}
                                onChange={handleNumericChange(field)}
                                disabled={loading}
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
                                value={field.value === 0 ? "" : field.value}
                                onChange={handleNumericChange(field)}
                                disabled={loading}
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
                                value={field.value === 0 ? "" : field.value}
                                onChange={handleNumericChange(field)}
                                disabled={loading}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}

            <Button
              type="submit"
              className="mt-4"
              disabled={isSaveButtonLocked}
            >
              {loading && "Saving..."}
              {!loading && !isSaveButtonLocked && "Save Round"}
              {isSaveButtonLocked && !loading && "Saved!"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
};

export default AddRoundForm;

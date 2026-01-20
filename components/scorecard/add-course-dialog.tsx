"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCombobox } from "@/components/scorecard/country-combobox";
import { Plus } from "lucide-react";
import { DialogPage, MultiPageDialog } from "../ui/multi-page-dialog";
import { Course, courseSchema } from "@/types/scorecard";
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
import { useState, useMemo, useEffect } from "react";
import { TeeFormContent } from "./tee-form-content";
import { FormFeedback } from "../ui/form-feedback";

interface AddCourseDialogProps {
  onAdd: (newCourse: Course) => void;
  initialCourseName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddCourseDialog({
  onAdd,
  initialCourseName,
  open: controlledOpen,
  onOpenChange,
}: AddCourseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (newOpen: boolean) => onOpenChange?.(newOpen)
    : setInternalOpen;

  const form = useForm<Course>({
    resolver: zodResolver(courseSchema),
    mode: "onChange",
    defaultValues: {
      id: -1,
      name: "",
      country: "",
      approvalStatus: "pending",
      city: "",
      website: "",
      tees: [
        {
          id: -1,
          courseId: -1,
          name: "",
          gender: "mens",
          distanceMeasurement: "yards",
          courseRating18: 0,
          courseRatingFront9: 0,
          courseRatingBack9: 0,
          slopeRating18: 0,
          slopeRatingFront9: 0,
          slopeRatingBack9: 0,
          outDistance: 0,
          inDistance: 0,
          totalDistance: 0,
          outPar: 0,
          inPar: 0,
          totalPar: 0,
          holes: Array(18)
            .fill(null)
            .map((_, index) => ({
              id: -1,
              teeId: -1,
              holeNumber: index + 1,
              par: 0,
              hcp: 0,
              distance: 0,
            })),
          approvalStatus: "pending",
        },
      ],
    },
  });

  // Set the initial course name when the dialog opens with a pre-filled name
  useEffect(() => {
    if (open && initialCourseName) {
      form.setValue("name", initialCourseName);
    }
  }, [open, initialCourseName, form]);

  const { control, handleSubmit, watch } = form;

  const watchName = watch("name");
  const watchCountry = watch("country");
  const watchCity = watch("city");
  const watchWebsite = watch("website");
  const watchTee = watch("tees.0");

  // Use schema validation instead of custom logic
  const isFormValid = useMemo(() => {
    const result = courseSchema.safeParse({
      name: watchName,
      country: watchCountry,
      city: watchCity,
      website: watchWebsite,
      approvalStatus: "pending",
      tees: watchTee ? [watchTee] : [],
    });
    return result.success;
  }, [watchName, watchCountry, watchCity, watchWebsite, watchTee]);

  const onSubmit = (values: Course) => {
    // Schema validation is already handled by the form resolver
    setErrorMessage(null);
    onAdd(values);
    setOpen(false);
  };

  const onError = (errors: unknown) => {
    console.log(errors);
    setErrorMessage("Please check the form for errors/missing data, or contact support");
  };

  return (
    <MultiPageDialog
      trigger={
        <div className="flex gap-2 justify-between flex-wrap sm:flex-row flex-col w-full">
          <Button
            variant="outline"
            size="sm"
            className="h-10 hidden md:flex"
            onClick={() => {
              setOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10 md:hidden sm:flex w-full"
            onClick={() => {
              setOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Course
          </Button>
        </div>
      }
      isNextButtonDisabled={!watchName || watchName.length < 2}
      isSaveButtonDisabled={!isFormValid}
      handleSave={handleSubmit(onSubmit, onError)}
      open={open}
      setOpen={(newOpen) => {
        setOpen(newOpen);
      }}
    >
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
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
            <FormField
              control={control}
              name="country"
              render={({ field }) => (
                <div className="space-y-2 py-4">
                  <FormLabel htmlFor="country">Country</FormLabel>
                  <FormItem>
                    <FormControl>
                      <CountryCombobox
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select a country..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              )}
            />
            <FormField
              control={control}
              name="city"
              render={({ field }) => (
                <div className="space-y-2 py-4">
                  <FormLabel htmlFor="city">City</FormLabel>
                  <FormItem>
                    <FormControl>
                      <Input {...field} placeholder="Enter city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              )}
            />
            <FormField
              control={control}
              name="website"
              render={({ field }) => (
                <div className="space-y-2 py-4">
                  <FormLabel htmlFor="website">Website (optional)</FormLabel>
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://example.com"
                      />
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
            {errorMessage && (
              <FormFeedback
                type="error"
                message={errorMessage}
                className="mb-4"
              />
            )}
            <FormField
              control={form.control}
              name="tees.0" // <--- references first tee
              render={({ field }) => (
                <TeeFormContent
                  tee={field.value}
                  onTeeChange={field.onChange}
                />
              )}
            />
          </DialogPage>
        </form>
      </Form>
    </MultiPageDialog>
  );
}

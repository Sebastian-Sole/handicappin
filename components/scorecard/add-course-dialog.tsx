"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { DialogPage, MultiPageDialog } from "../ui/multi-page-dialog";
import { Course, courseCreationSchema } from "@/types/scorecard";
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
import { TeeFormContent } from "./tee-form-content";
interface AddCourseDialogProps {
  onAdd: (newCourse: Course) => void;
}

export function AddCourseDialog({ onAdd }: AddCourseDialogProps) {
  const [open, setOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const form = useForm<Course>({
    resolver: zodResolver(courseCreationSchema),
    defaultValues: {
      name: "",
      approvalStatus: "pending",
      tees: [
        {
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

  const { control, handleSubmit, watch } = form;

  const watchName = watch("name");
  const watchTee = watch("tees.0");

  // Check if the form has valid data for submission
  const isFormValid =
    watchName &&
    watchName.length >= 2 &&
    watchTee &&
    watchTee.name &&
    watchTee.courseRating18 > 0 &&
    watchTee.slopeRating18 > 0 &&
    watchTee.totalPar > 0 &&
    watchTee.totalDistance > 0;

  const onSubmit = (values: Course) => {
    // Additional validation before submission
    if (!isFormValid) {
      setShowValidationErrors(true);
      toast({
        title: "Invalid Course Data",
        description:
          "Please ensure all required fields are filled with valid values",
        variant: "destructive",
      });
      return;
    }

    onAdd(values);
    setOpen(false);
    setShowValidationErrors(false);
  };

  const onError = (errors: any) => {
    console.log(errors);
    setShowValidationErrors(true);
    toast({
      title: "Failed to add course",
      description:
        "Please check the form for errors/missing data, or contact support",
      variant: "destructive",
    });
  };

  return (
    <MultiPageDialog
      trigger={
        <div className="flex gap-2 justify-between flex-wrap sm:flex-row flex-col">
          <Button
            variant="outline"
            size="sm"
            className="h-10 hidden md:flex"
            onClick={() => {
              setOpen(true);
              setShowValidationErrors(false);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-10 md:hidden sm:flex"
            onClick={() => {
              setOpen(true);
              setShowValidationErrors(false);
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
        if (!newOpen) {
          setShowValidationErrors(false);
        }
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
          </DialogPage>

          <DialogPage
            title="Add New Tee"
            className="max-w-[250px] sm:max-w-[350px] md:max-w-[550px]"
          >
            <FormField
              control={form.control}
              name="tees.0" // <--- references first tee
              render={({ field }) => (
                <TeeFormContent
                  tee={field.value}
                  onTeeChange={field.onChange}
                  showValidationErrors={showValidationErrors}
                />
              )}
            />
          </DialogPage>
        </form>
      </Form>
    </MultiPageDialog>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { DialogPage, MultiPageDialog } from "../ui/multi-page-dialog";
import { Course, courseSchema } from "@/types/scorecard";
import { validCourse } from "@/utils/scorecard/tee";
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
  const form = useForm<Course>({
    resolver: zodResolver(courseSchema),
    defaultValues: validCourse,
  });

  const { control, handleSubmit, watch } = form;

  const watchName = watch("name");

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
        </MultiPageDialog>
      </form>
    </Form>
  );
}

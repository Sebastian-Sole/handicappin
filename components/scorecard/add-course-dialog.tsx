"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCombobox } from "@/components/scorecard/country-combobox";
import { Plus, Trash2 } from "lucide-react";
import {
  DialogPage,
  MultiPageDialog,
  type MultiPageDialogHandle,
} from "../ui/multi-page-dialog";
import { Course, courseSchema, teeSchema } from "@/types/scorecard-input";
import { useForm, useWatch, useFieldArray, FormProvider } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { TeeFormContent } from "./tee-form-content";
import { FormFeedback } from "../ui/form-feedback";
import { blankTee } from "@/utils/scorecard/tee";

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
  const dialogRef = useRef<MultiPageDialogHandle>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (newOpen: boolean) => onOpenChange?.(newOpen)
    : setInternalOpen;

  const form = useForm<Course>({
    resolver: standardSchemaResolver(courseSchema),
    mode: "onChange",
    defaultValues: {
      id: -1,
      name: "",
      country: "",
      approvalStatus: "pending",
      city: "",
      website: "",
      tees: [{ ...blankTee }],
    },
  });

  // Set the initial course name when the dialog opens with a pre-filled name
  useEffect(() => {
    if (open && initialCourseName) {
      form.setValue("name", initialCourseName);
    }
  }, [open, initialCourseName, form]);

  const { control, handleSubmit } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tees",
  });

  const watchName = useWatch({ control, name: "name" });
  const watchCountry = useWatch({ control, name: "country" });
  const watchCity = useWatch({ control, name: "city" });
  const watchWebsite = useWatch({ control, name: "website" });
  const watchTees = useWatch({ control, name: "tees" });

  // Per-page validation: page 0 = course info, pages 1+ = individual tees
  const isNextDisabled = useCallback(
    (pageIndex: number) => {
      if (pageIndex === 0) {
        return (
          !watchName ||
          watchName.length < 2 ||
          !watchCountry ||
          watchCountry.length < 1 ||
          !watchCity ||
          watchCity.length < 1
        );
      }
      // Tee pages: validate the specific tee
      const teeIndex = pageIndex - 1;
      const tee = watchTees?.[teeIndex];
      if (!tee) return true;
      return !teeSchema.safeParse(tee).success;
    },
    [watchName, watchCountry, watchCity, watchTees],
  );

  // Overall form validation for Save button
  const isFormValid = useMemo(() => {
    const result = courseSchema.safeParse({
      name: watchName,
      country: watchCountry,
      city: watchCity,
      website: watchWebsite,
      approvalStatus: "pending",
      tees: watchTees ?? [],
    });
    return result.success;
  }, [watchName, watchCountry, watchCity, watchWebsite, watchTees]);

  const handleAddTee = useCallback(() => {
    append({ ...blankTee });
    // Navigate to the new tee page (page 0 = course info, so new tee = fields.length + 1 - 1 + 1)
    // After append, the new tee will be at index fields.length, which is page fields.length + 1
    const newTeePage = fields.length + 1;
    requestAnimationFrame(() => {
      dialogRef.current?.goToPage(newTeePage);
    });
  }, [append, fields.length]);

  const handleRemoveTee = useCallback(
    (teeIndex: number) => {
      if (fields.length > 1) {
        remove(teeIndex);
      }
    },
    [fields.length, remove],
  );

  const onSubmit = (values: Course) => {
    setErrorMessage(null);
    onAdd(values);
    setOpen(false);
  };

  const onError = () => {
    setErrorMessage(
      "Please check the form for errors/missing data, or contact support",
    );
  };

  return (
    <FormProvider {...form}>
      <MultiPageDialog
          dialogRef={dialogRef}
          trigger={
            <div className="flex w-full">
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
                className="h-10 flex md:hidden w-full"
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
          isNextButtonDisabled={isNextDisabled}
          isSaveButtonDisabled={!isFormValid}
          handleSave={handleSubmit(onSubmit, onError)}
          open={open}
          setOpen={(newOpen) => {
            setOpen(newOpen);
          }}
          extraFooterContent={(pageIndex) => {
            // Only show tee actions on tee pages (pageIndex >= 1)
            if (pageIndex < 1) return null;
            const teeIndex = pageIndex - 1;
            const currentTee = watchTees?.[teeIndex];
            const isTeeValid = currentTee
              ? teeSchema.safeParse(currentTee).success
              : false;

            return (
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveTee(teeIndex)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove Tee
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTee}
                  disabled={!isTeeValid}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another Tee
                </Button>
              </div>
            );
          }}
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
                      <Input {...field} placeholder="Enter course name" autoComplete="off" data-1p-ignore />
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
                      <Input {...field} placeholder="Enter city" autoComplete="off" data-1p-ignore />
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
                      <Input {...field} placeholder="https://example.com" autoComplete="off" data-1p-ignore />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              )}
            />
          </DialogPage>

          {fields.map((field, teeIndex) => (
            <DialogPage
              key={field.id}
              title={`Tee ${teeIndex + 1} of ${fields.length}${watchTees?.[teeIndex]?.name ? ` — ${watchTees[teeIndex].name}` : ""}`}
              className="sm:max-w-[350px] md:max-w-[550px]"
            >
              {errorMessage && teeIndex === fields.length - 1 && (
                <FormFeedback
                  type="error"
                  message={errorMessage}
                  className="mb-4"
                />
              )}
              <FormField
                control={form.control}
                name={`tees.${teeIndex}`}
                render={({ field: teeField }) =>
                  teeField.value ? (
                    <TeeFormContent
                      tee={teeField.value}
                      onTeeChange={teeField.onChange}
                    />
                  ) : (
                    <></>
                  )
                }
              />
            </DialogPage>
          ))}
        </MultiPageDialog>
    </FormProvider>
  );
}

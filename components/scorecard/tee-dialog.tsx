"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { TeeFormContent } from "./tee-form-content";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tee, teeSchema } from "@/types/scorecard";
import { Form } from "../ui/form";
import { blankTee } from "@/utils/scorecard/tee";

// Import the validation function
function getTeeValidationErrors(tee: Tee): string[] {
  const errors: string[] = [];

  if (!tee.name || tee.name.trim().length === 0) {
    errors.push("Tee name is required");
  }

  if (tee.courseRating18 <= 0) {
    errors.push("Course rating must be greater than 0");
  } else if (tee.courseRating18 < 40 || tee.courseRating18 > 90) {
  } else if (tee.courseRating18 < 30 || tee.courseRating18 > 85) {
    errors.push("Course rating should be between 30-85");
  }

  if (tee.slopeRating18 <= 0) {
    errors.push("Slope rating must be greater than 0");
  } else if (tee.slopeRating18 < 45 || tee.slopeRating18 > 165) {
    errors.push("Slope rating should be between 45-165");
  }

  if (tee.totalPar <= 0) {
    errors.push("Total par must be greater than 0");
  } else if (tee.totalPar < 54 || tee.totalPar > 80) {
    errors.push("Total par should be between 54-80");
  }

  if (tee.totalDistance <= 0) {
    errors.push("Total distance must be greater than 0");
  } else if (tee.totalDistance < 1500 || tee.totalDistance > 8700) {
    errors.push("Total distance should be between 1500-8700");
  }

  // Check if all holes have valid data
  const invalidHoles = tee.holes?.filter(
    (hole) => hole.par <= 0 || hole.distance <= 0 || hole.hcp <= 0
  );

  if (invalidHoles && invalidHoles.length > 0) {
    errors.push(
      `${invalidHoles.length} holes have invalid data (par, distance, or handicap)`
    );
  }

  return errors;
}

interface TeeDialogProps {
  mode: "add" | "edit";
  existingTee?: Tee;
  onSave: (updatedTee: Tee) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function TeeDialog({
  mode,
  existingTee = blankTee,
  onSave,
  onOpenChange,
  disabled,
}: TeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const form = useForm<Tee>({
    resolver: zodResolver(teeSchema),
    defaultValues: existingTee,
  });

  const tee = form.watch();

  const handleTeeChange = (updated: Tee) => {
    form.reset(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    form.handleSubmit(
      (data) => {
        // Check if the data is valid before saving
        const validationErrors = getTeeValidationErrors(data);
        if (validationErrors.length > 0) {
          setShowValidationErrors(true);
          return;
        }

        onSave({ ...data, approvalStatus: "pending" });
        setIsOpen(false);
        setShowValidationErrors(false);
      },
      (errors) => {
        console.log(errors);
        setShowValidationErrors(true);
      }
    )(e);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setShowValidationErrors(false);
    }
    onOpenChange?.(open);
  };

  function renderTeeButtons() {
    if (mode === "edit") {
      return (
        <div className="flex gap-2 justify-between flex-wrap sm:flex-row flex-col">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 hidden md:flex"
            disabled={disabled}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 sm:flex md:hidden "
            disabled={disabled}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Tee
          </Button>
        </div>
      );
    } else {
      return (
        <div className="flex gap-2 justify-between flex-wrap sm:flex-row flex-col">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 hidden  md:flex"
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10  sm:flex md:hidden"
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tee
          </Button>
        </div>
      );
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!disabled ? (
        <DialogTrigger asChild>{renderTeeButtons()}</DialogTrigger>
      ) : (
        renderTeeButtons()
      )}
      <DialogContent className="max-w-[300px] sm:max-w-[400px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Tee Information" : "Add New Tee"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-w-[250px] sm:max-w-[350px] md:max-w-[550px]">
          <Form {...form}>
            <form onSubmit={handleSubmit}>
              <TeeFormContent
                tee={tee}
                onTeeChange={handleTeeChange}
                showValidationErrors={showValidationErrors}
              />
              <div className="flex justify-end mt-4">
                <Button type="submit">
                  {mode === "edit" ? "Save Changes" : "Add Tee"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

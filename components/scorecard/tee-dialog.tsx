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
import { Tee, teeSchema, teeCreationSchema } from "@/types/scorecard";
import { Form } from "../ui/form";
import { blankTee } from "@/utils/scorecard/tee";

// Use the teeCreationSchema for validation
function getTeeValidationErrors(tee: Tee): string[] {
  const result = teeCreationSchema.safeParse(tee);
  if (result.success) {
    return [];
  }

  return result.error.errors.map((err) => err.message);
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

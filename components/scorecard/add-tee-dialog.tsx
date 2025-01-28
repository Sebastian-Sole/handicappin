"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { defaultTee } from "@/utils/scorecard/tee";
import { Tee, teeSchema } from "@/types/scorecard";
import { Form } from "@/components/ui/form";
import { FormProvider, Controller } from "react-hook-form";
import { TeeFormContent } from "./tee-form-content";

interface AddTeeDialogProps {
  onAdd: (newTee: Tee) => void;
}

/**
 * A single-page dialog for adding a new Tee.
 */
export function AddTeeDialog({ onAdd }: AddTeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const teeForm = useForm<Tee>({
    resolver: zodResolver(teeSchema),
    defaultValues: {
      ...defaultTee,
      // You can override or set other default fields if necessary
    },
  });

  const tee = teeForm.watch();

  const handleTeeChange = (updated: Tee) => {
    teeForm.reset(updated);
  };

  const onSubmit = (values: Tee) => {
    // If you need to recalc totals, do it here or rely on the watchers in TeeFormContent
    onAdd(values);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add New Tee
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tee</DialogTitle>
        </DialogHeader>
        <Form {...teeForm}>
          <form onSubmit={teeForm.handleSubmit(onSubmit)}>
            <TeeFormContent tee={tee} onTeeChange={handleTeeChange} />

            <div className="flex justify-end mt-4">
              <Button type="submit">Add Tee</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

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

interface TeeDialogProps {
  mode: "add" | "edit";
  existingTee?: Tee;
  onSave: (updatedTee: Tee) => void;
  id?: string;
  onOpenChange?: (open: boolean) => void;
}

export function TeeDialog({
  mode,
  existingTee = blankTee,
  onSave,
  id,
  onOpenChange,
}: TeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

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

    form.handleSubmit((data) => {
      onSave({ ...data, approvalStatus: "pending" });
      setIsOpen(false);
    })(e);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "edit" ? (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Tee
          </Button>
        ) : (
          <Button id={id} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add New Tee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[300px] sm:max-w-[400px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Tee Information" : "Add New Tee"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-w-[250px] sm:max-w-[350px] md:max-w-[550px]">
          <Form {...form}>
            <form onSubmit={handleSubmit}>
              <TeeFormContent tee={tee} onTeeChange={handleTeeChange} />
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

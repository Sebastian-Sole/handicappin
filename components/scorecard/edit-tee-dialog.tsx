"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { TeeFormContent } from "./tee-form-content";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tee, teeSchema } from "@/types/scorecard";
import { Form } from "../ui/form";

interface EditTeeDialogProps {
  existingTee: Tee;
  onSave: (updatedTee: Tee) => void;
}

export function EditTeeDialog({ existingTee, onSave }: EditTeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<Tee>({
    resolver: zodResolver(teeSchema),
    defaultValues: existingTee,
  });

  const tee = form.watch();

  const handleTeeChange = (updated: Tee) => {
    form.reset(updated);
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSave({ ...data, approvalStatus: "pending" });
    setIsOpen(false);
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Tee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[300px] sm:max-w-[400px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tee Information</DialogTitle>
        </DialogHeader>
        <div className="max-w-[250px] sm:max-w-[350px] md:max-w-[550px]">
          <Form {...form}>
            <form onSubmit={handleSubmit}>
              <TeeFormContent tee={tee} onTeeChange={handleTeeChange} />
              <div className="flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

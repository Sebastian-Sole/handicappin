"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { DialogPage, MultiPageDialog } from "../ui/multi-page-dialog";
import { Course } from "@/types/scorecard";

interface AddCourseDialogProps {
  onAdd: (newCourse: Course) => void;
}

export function AddCourseDialog({ onAdd }: AddCourseDialogProps) {
  const [courseName, setCourseName] = useState("");
  return (
    <MultiPageDialog
      trigger={
        <Button variant="ghost" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add New Course
        </Button>
      }
    >
      <DialogPage title="Add New Course">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courseName">Course Name</Label>
            <Input
              id="courseName"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Enter course name"
            />
          </div>
        </div>
      </DialogPage>
      <DialogPage title="Add New Tee">
        <p>Page 2</p>
      </DialogPage>
    </MultiPageDialog>
  );
}

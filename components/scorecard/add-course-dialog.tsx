"use client";

import { useState } from "react";
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
import { Plus } from "lucide-react";
import { AddTeeDialog } from "./add-tee-dialog";
import { Tables } from "@/types/supabase";

interface Course {
  id: string;
  name: string;
  tees: Tables<"TeeInfo">[];
}

interface AddCourseDialogProps {
  onAdd: (newCourse: Course) => void;
}

export function AddCourseDialog({ onAdd }: AddCourseDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [tees, setTees] = useState<Tables<"TeeInfo">[]>([]);

  const handleAddTee = (newTee: Tables<"TeeInfo">) => {
    setTees([...tees, newTee]);
  };

  //   const handleAddCourse = () => {
  //     if (courseName && tees.length > 0) {
  //       const newCourse: Course = {
  //         id: Date.now().toString(), // Simple ID generation
  //         name: courseName,
  //         tees: tees,
  //       };
  //       onAdd(newCourse);
  //       setIsOpen(false);
  //       setCourseName("");
  //       setTees([]);
  //     }
  //   };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add New Course
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
        </DialogHeader>
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
          <div className="space-y-2">
            <Label>Tees</Label>
            {tees.map((tee, index) => (
              <div key={index} className="flex justify-between items-center">
                <span>{tee.name}</span>
                <span>
                  CR: {tee.courseRating} / SR: {tee.slopeRating}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => console.log("Clicked")}
            disabled={!courseName || tees.length === 0}
          >
            Add Course
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

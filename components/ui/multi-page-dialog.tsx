"use client";

import React, { useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogPageProps {
  title: string;
  children: React.ReactNode;
}

export const DialogPage: React.FC<DialogPageProps> = ({ title, children }) => (
  <div>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    <div className="py-4">{children}</div>
  </div>
);

interface MultiPageDialogProps {
  trigger: React.ReactNode;
  children: ReactElement<DialogPageProps> | ReactElement<DialogPageProps>[];
}

const ProgressDots: React.FC<{ total: number; current: number }> = ({
  total,
  current,
}) => (
  <div className="flex justify-center space-x-2 mt-4 mb-2">
    {[...Array(total)].map((_, i) => (
      <div
        key={i}
        className={cn(
          "w-2 h-2 rounded-full transition-colors duration-300",
          i === current ? "bg-primary" : "bg-gray-300"
        )}
      />
    ))}
  </div>
);

export const MultiPageDialog: React.FC<MultiPageDialogProps> = ({
  trigger,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pages = React.Children.toArray(
    children
  ) as ReactElement<DialogPageProps>[];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      setOpen(false);
      setCurrentPage(0);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <ProgressDots total={pages.length} current={currentPage} />
        {pages[currentPage]}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <Button onClick={handleNext}>
            {currentPage === pages.length - 1 ? "Save" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

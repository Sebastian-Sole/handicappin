"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  useEffect,
  type ReactElement,
} from "react";
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
  className?: string;
}

export const DialogPage: React.FC<DialogPageProps> = ({
  title,
  children,
  className,
}) => (
  <div>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
    </DialogHeader>
    <div className={`py-4 ${className}`}>{children}</div>
  </div>
);

export interface MultiPageDialogHandle {
  goToPage: (pageIndex: number) => void;
}

interface MultiPageDialogProps {
  trigger: React.ReactNode;
  isNextButtonDisabled: boolean | ((pageIndex: number) => boolean);
  isSaveButtonDisabled?: boolean | ((pageIndex: number) => boolean);
  children: React.ReactNode;
  handleSave: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  className?: string;
  hideProgressDots?: boolean;
  extraFooterContent?: (
    pageIndex: number,
    totalPages: number,
  ) => React.ReactNode;
  dialogRef?: React.Ref<MultiPageDialogHandle>;
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
  isNextButtonDisabled = false,
  isSaveButtonDisabled = false,
  children,
  handleSave,
  open,
  setOpen,
  className,
  hideProgressDots = false,
  extraFooterContent,
  dialogRef,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const pages = React.Children.toArray(children).flat().filter(
    (child): child is ReactElement<DialogPageProps> =>
      React.isValidElement(child),
  );

  // Clamp currentPage if pages were removed (e.g. tee deleted)
  const safePage = Math.min(currentPage, Math.max(pages.length - 1, 0));

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const goToPage = useCallback(
    (pageIndex: number) => {
      setCurrentPage(pageIndex);
      // Use requestAnimationFrame so new content renders before scrolling
      requestAnimationFrame(() => scrollToTop());
    },
    [scrollToTop],
  );

  useImperativeHandle(dialogRef, () => ({ goToPage }), [goToPage]);

  // Scroll to top whenever the page changes
  useEffect(() => {
    scrollToTop();
  }, [safePage, scrollToTop]);

  const resolvedNextDisabled =
    typeof isNextButtonDisabled === "function"
      ? isNextButtonDisabled(safePage)
      : isNextButtonDisabled;

  const resolvedSaveDisabled =
    typeof isSaveButtonDisabled === "function"
      ? isSaveButtonDisabled(safePage)
      : isSaveButtonDisabled;

  const handleNext = () => {
    if (safePage < pages.length - 1) {
      setCurrentPage(safePage + 1);
    } else {
      setOpen(false);
      setCurrentPage(0);
    }
  };

  const handlePrevious = () => {
    if (safePage > 0) {
      setCurrentPage(safePage - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        ref={contentRef}
        className="max-w-[calc(100vw-2rem)] sm:max-w-[400px] md:max-w-[600px] max-h-[90vh] overflow-y-auto"
      >
        {pages[safePage]}
        {extraFooterContent?.(safePage, pages.length)}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={safePage === 0}
            className={cn(safePage === 0 && "invisible")}
          >
            Previous
          </Button>
          {!hideProgressDots && (
            <ProgressDots total={pages.length} current={safePage} />
          )}
          {safePage === pages.length - 1 && (
            <Button
              type="submit"
              onClick={handleSave}
              disabled={resolvedSaveDisabled}
            >
              Save
            </Button>
          )}
          {safePage !== pages.length - 1 && (
            <Button onClick={handleNext} disabled={resolvedNextDisabled}>
              Next
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

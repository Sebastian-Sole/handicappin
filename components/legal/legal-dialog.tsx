"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TermsContent } from "./terms-content";
import { PrivacyContent } from "./privacy-content";

type LegalDocumentType = "terms" | "privacy";

interface LegalDialogProps {
  type: LegalDocumentType;
  children: React.ReactNode;
}

const DIALOG_CONFIG: Record<
  LegalDocumentType,
  { title: string; description: string }
> = {
  terms: {
    title: "Terms of Service",
    description: "Please read these terms carefully before using Handicappin'.",
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "How we collect, use, and protect your personal data.",
  },
};

export function LegalDialog({ type, children }: LegalDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = DIALOG_CONFIG[type];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="underline underline-offset-4 hover:text-primary"
      >
        {children}
      </button>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

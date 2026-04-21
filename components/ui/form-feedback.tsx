"use client";

import { CheckCircle, AlertCircle, X, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFeedbackProps {
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

export function FormFeedback({
  type,
  title,
  message,
  className,
  onClose,
}: FormFeedbackProps) {
  const icons = {
    success: <CheckCircle className="h-4 w-4 shrink-0 text-success" />,
    error: <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />,
    info: <AlertCircle className="h-4 w-4 shrink-0 text-info" />,
  };

  const containerStyles = {
    success: "bg-success/10 border-success/30",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-info/10 border-info/30",
  };

  const textStyles = {
    success: "text-success",
    error: "text-destructive",
    info: "text-info",
  };

  const closeButtonStyles = {
    success: "text-success hover:text-success/80",
    error: "text-destructive hover:text-destructive/80",
    info: "text-info hover:text-info/80",
  };

  return (
    <div
      role="alert"
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "relative w-full rounded-lg border p-4",
        containerStyles[type],
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icons[type]}
        <div className={cn("flex-1 text-sm", textStyles[type])}>
          {title && <strong className="block mb-1">{title}</strong>}
          {message}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2",
              closeButtonStyles[type]
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

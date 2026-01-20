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
    success: (
      <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
    ),
    error: <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />,
    info: (
      <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
    ),
  };

  const containerStyles = {
    success:
      "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  };

  const textStyles = {
    success: "text-green-800 dark:text-green-200",
    error: "text-destructive",
    info: "text-blue-800 dark:text-blue-200",
  };

  const closeButtonStyles = {
    success:
      "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200",
    error: "text-destructive hover:text-destructive/80",
    info: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200",
  };

  return (
    <div
      role="alert"
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

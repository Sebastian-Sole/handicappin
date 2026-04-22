"use client";

import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Check,
  Circle,
  AlertCircle,
  ImagePlus,
  Upload,
  FileImage,
  X,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tee } from "@/types/scorecard-input";
import type { ExtractedTee, ExtractionResponse } from "@/lib/scorecard-extraction";
import { AiUpsellDialog } from "./ai-upsell-dialog";
import { blankTee } from "@/utils/scorecard/tee";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const ACCEPTED_MIME_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

type FileStatus = "pending" | "uploading" | "analyzing" | "done" | "error";

interface TrackedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

interface ScorecardImageUploadProps {
  currentTee: Tee;
  onExtracted: (updatedTee: Tee) => void;
  /** Called when the AI finds additional tees beyond the current one. */
  onAdditionalTeesExtracted?: (tees: Tee[]) => void;
  isPremium: boolean;
}

interface ExtractionSummary {
  teeName: boolean;
  gender: boolean;
  distanceMeasurement: boolean;
  courseRating: boolean;
  slopeRating: boolean;
  holes: boolean;
  totalTeesFound: number;
}

function buildExtractionSummary(
  tees: ExtractedTee[],
  previousSummary: ExtractionSummary | null
): ExtractionSummary {
  // Merge all tees' data availability into one summary
  let hasTeeName = previousSummary?.teeName ?? false;
  let hasGender = previousSummary?.gender ?? false;
  let hasDistanceMeasurement = previousSummary?.distanceMeasurement ?? false;
  let hasCourseRating = previousSummary?.courseRating ?? false;
  let hasSlopeRating = previousSummary?.slopeRating ?? false;
  let hasHoles = previousSummary?.holes ?? false;

  for (const extracted of tees) {
    if (extracted.teeName !== null) hasTeeName = true;
    if (extracted.gender !== null) hasGender = true;
    if (extracted.distanceMeasurement !== null) hasDistanceMeasurement = true;
    if (
      extracted.courseRatingFront9 !== null ||
      extracted.courseRatingBack9 !== null ||
      extracted.courseRating18 !== null
    )
      hasCourseRating = true;
    if (
      extracted.slopeRatingFront9 !== null ||
      extracted.slopeRatingBack9 !== null ||
      extracted.slopeRating18 !== null
    )
      hasSlopeRating = true;
    if (
      extracted.holes !== null &&
      extracted.holes.some(
        (h) => h.par !== null || h.hcp !== null || h.distance !== null
      )
    )
      hasHoles = true;
  }

  const previousCount = previousSummary?.totalTeesFound ?? 0;

  return {
    teeName: hasTeeName,
    gender: hasGender,
    distanceMeasurement: hasDistanceMeasurement,
    courseRating: hasCourseRating,
    slopeRating: hasSlopeRating,
    holes: hasHoles,
    totalTeesFound: previousCount + tees.length,
  };
}

/**
 * Merges AI-extracted tee data into an existing tee, only overwriting
 * fields the AI confidently extracted (non-null values).
 * Computes totals when front/back 9 values are available.
 */
function mergeExtractedTee(extracted: ExtractedTee, currentTee: Tee): Tee {
  const updated = { ...currentTee };

  if (extracted.teeName !== null) updated.name = extracted.teeName;
  if (extracted.gender !== null) updated.gender = extracted.gender;
  if (extracted.distanceMeasurement !== null)
    updated.distanceMeasurement = extracted.distanceMeasurement;

  if (extracted.courseRatingFront9 !== null)
    updated.courseRatingFront9 = extracted.courseRatingFront9;
  if (extracted.courseRatingBack9 !== null)
    updated.courseRatingBack9 = extracted.courseRatingBack9;
  if (extracted.courseRating18 !== null) {
    updated.courseRating18 = extracted.courseRating18;
  } else if (updated.courseRatingFront9 && updated.courseRatingBack9) {
    updated.courseRating18 =
      updated.courseRatingFront9 + updated.courseRatingBack9;
  }

  if (extracted.slopeRatingFront9 !== null)
    updated.slopeRatingFront9 = extracted.slopeRatingFront9;
  if (extracted.slopeRatingBack9 !== null)
    updated.slopeRatingBack9 = extracted.slopeRatingBack9;
  if (extracted.slopeRating18 !== null) {
    updated.slopeRating18 = extracted.slopeRating18;
  } else if (updated.slopeRatingFront9 && updated.slopeRatingBack9) {
    updated.slopeRating18 = Math.ceil(
      (updated.slopeRatingFront9 + updated.slopeRatingBack9) / 2
    );
  }

  if (extracted.holes) {
    const existingHoles = currentTee.holes ?? [];
    const mergedHoles = Array(18)
      .fill(null)
      .map((_, index) => {
        const existing = existingHoles[index] ?? {
          holeNumber: index + 1,
          par: 0,
          hcp: 0,
          distance: 0,
        };
        const extractedHole = extracted.holes?.find(
          (h) => h.holeNumber === index + 1
        );

        if (!extractedHole) return existing;

        return {
          ...existing,
          par: extractedHole.par ?? existing.par,
          hcp: extractedHole.hcp ?? existing.hcp,
          distance: extractedHole.distance ?? existing.distance,
        };
      });

    updated.holes = mergedHoles;
    updated.outPar = mergedHoles.slice(0, 9).reduce((sum, h) => sum + (h.par || 0), 0);
    updated.inPar = mergedHoles.slice(9, 18).reduce((sum, h) => sum + (h.par || 0), 0);
    updated.totalPar = updated.outPar + updated.inPar;
    updated.outDistance = mergedHoles.slice(0, 9).reduce((sum, h) => sum + (h.distance || 0), 0);
    updated.inDistance = mergedHoles.slice(9, 18).reduce((sum, h) => sum + (h.distance || 0), 0);
    updated.totalDistance = updated.outDistance + updated.inDistance;
  }

  return updated;
}

/**
 * Converts an AI-extracted tee into a full Tee object by merging
 * extracted values into a blank tee template.
 */
function extractedTeeToFullTee(extracted: ExtractedTee): Tee {
  return mergeExtractedTee(extracted, { ...blankTee });
}

/**
 * Given an array of extracted tees from all files, groups them by
 * (teeName, gender) and merges data from multiple files for the same tee.
 * Returns a deduplicated array of ExtractedTees with the most complete data.
 */
/**
 * Common tee name abbreviations and aliases mapped to canonical names.
 * This handles AI models returning "M", "W", "Men", "Mens", "Women", etc.
 */
const TEE_NAME_ALIASES: Record<string, string> = {
  m: "men",
  men: "men",
  mens: "men",
  "men's": "men",
  male: "men",
  males: "men",
  gentleman: "men",
  gentlemen: "men",
  w: "women",
  women: "women",
  womens: "women",
  "women's": "women",
  ladies: "women",
  lady: "women",
  female: "women",
  females: "women",
};

/**
 * Normalizes a tee name for dedup matching.
 * Handles variations like "Men"/"Mens"/"Men's"/"M", abbreviations, trailing whitespace.
 */
function normalizeTeeNameForDedup(name: string): string {
  const cleaned = name.toLowerCase().trim().replace(/['']s$/, "");
  return TEE_NAME_ALIASES[cleaned] ?? cleaned;
}

/**
 * Checks if a normalized tee name is a generic gender alias (not a tee color).
 * Gender aliases like "men"/"women" should be merged with color names like "red"/"white".
 */
const GENERIC_GENDER_NAMES = new Set(["men", "women", "unknown"]);

function isGenericGenderName(normalizedName: string): boolean {
  return GENERIC_GENDER_NAMES.has(normalizedName);
}

/**
 * Merges two ExtractedTee records, preferring non-null values from `existing` (first-wins).
 * Keeps the more specific (color) tee name when one is generic.
 */
function mergeExtractedTeeRecords(existing: ExtractedTee, incoming: ExtractedTee): ExtractedTee {
  // Prefer the color name over generic gender name
  const existingNorm = normalizeTeeNameForDedup(existing.teeName ?? "unknown");
  const incomingNorm = normalizeTeeNameForDedup(incoming.teeName ?? "unknown");
  let bestTeeName = existing.teeName ?? incoming.teeName;
  if (isGenericGenderName(existingNorm) && !isGenericGenderName(incomingNorm)) {
    bestTeeName = incoming.teeName;
  }

  return {
    teeName: bestTeeName,
    gender: existing.gender ?? incoming.gender,
    distanceMeasurement: existing.distanceMeasurement ?? incoming.distanceMeasurement,
    courseRatingFront9: existing.courseRatingFront9 ?? incoming.courseRatingFront9,
    courseRatingBack9: existing.courseRatingBack9 ?? incoming.courseRatingBack9,
    courseRating18: existing.courseRating18 ?? incoming.courseRating18,
    slopeRatingFront9: existing.slopeRatingFront9 ?? incoming.slopeRatingFront9,
    slopeRatingBack9: existing.slopeRatingBack9 ?? incoming.slopeRatingBack9,
    slopeRating18: existing.slopeRating18 ?? incoming.slopeRating18,
    holes: mergeExtractedHoles(existing.holes, incoming.holes),
  };
}

function deduplicateExtractedTees(allTees: ExtractedTee[]): ExtractedTee[] {
  const teeMap = new Map<string, ExtractedTee>();

  for (const tee of allTees) {
    const normalizedName = normalizeTeeNameForDedup(tee.teeName ?? "unknown");
    const normalizedGender = (tee.gender ?? "unknown").toLowerCase();
    const key = `${normalizedName}_${normalizedGender}`;
    const existing = teeMap.get(key);

    if (existing) {
      // Exact key match — merge
      teeMap.set(key, mergeExtractedTeeRecords(existing, tee));
      continue;
    }

    // Fallback: if this tee's name is a generic gender alias (e.g., "men", "women"),
    // check if there's already a tee with the same gender but a color name (e.g., "red").
    // Or vice versa — merge them since they represent the same physical tee.
    if (isGenericGenderName(normalizedName)) {
      const genderMatch = Array.from(teeMap.entries()).find(([existingKey, existingTee]) => {
        const existingGender = (existingTee.gender ?? "unknown").toLowerCase();
        return existingGender === normalizedGender && existingKey !== key;
      });
      if (genderMatch) {
        const [matchKey, matchTee] = genderMatch;
        teeMap.set(matchKey, mergeExtractedTeeRecords(matchTee, tee));
        continue;
      }
    } else {
      // This tee has a specific color name — check if there's a generic gender match
      const genderMatch = Array.from(teeMap.entries()).find(([, existingTee]) => {
        const existingGender = (existingTee.gender ?? "unknown").toLowerCase();
        const existingNorm = normalizeTeeNameForDedup(existingTee.teeName ?? "unknown");
        return existingGender === normalizedGender && isGenericGenderName(existingNorm);
      });
      if (genderMatch) {
        const [matchKey, matchTee] = genderMatch;
        teeMap.delete(matchKey);
        teeMap.set(key, mergeExtractedTeeRecords(matchTee, tee));
        continue;
      }
    }

    // No match found — new tee
    teeMap.set(key, tee);
  }

  return Array.from(teeMap.values());
}

function mergeExtractedHoles(
  existingHoles: ExtractedTee["holes"],
  newHoles: ExtractedTee["holes"]
): ExtractedTee["holes"] {
  if (!existingHoles) return newHoles;
  if (!newHoles) return existingHoles;

  return existingHoles.map((existing) => {
    const matching = newHoles.find((h) => h.holeNumber === existing.holeNumber);
    if (!matching) return existing;
    return {
      holeNumber: existing.holeNumber,
      par: existing.par ?? matching.par,
      hcp: existing.hcp ?? matching.hcp,
      distance: existing.distance ?? matching.distance,
    };
  });
}

const SUMMARY_ITEMS: { key: keyof Omit<ExtractionSummary, "totalTeesFound">; label: string }[] = [
  { key: "teeName", label: "Tee name" },
  { key: "gender", label: "Gender" },
  { key: "distanceMeasurement", label: "Distance unit" },
  { key: "courseRating", label: "Course rating" },
  { key: "slopeRating", label: "Slope rating" },
  { key: "holes", label: "Hole data" },
];

const FILE_STATUS_CONFIG: Record<
  FileStatus,
  { icon: typeof Check; label: string; className: string }
> = {
  pending: { icon: Circle, label: "Waiting", className: "text-muted-foreground" },
  uploading: { icon: Loader2, label: "Uploading", className: "text-primary animate-spin" },
  analyzing: { icon: Sparkles, label: "Analyzing", className: "text-primary animate-pulse" },
  done: { icon: Check, label: "Complete", className: "text-success" },
  error: { icon: AlertCircle, label: "Failed", className: "text-destructive" },
};

function FileStatusIcon({ status }: { status: FileStatus }) {
  const config = FILE_STATUS_CONFIG[status];
  const Icon = config.icon;
  return <Icon className={cn("h-4 w-4 shrink-0", config.className)} />;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
  return <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export function ScorecardImageUpload({
  currentTee,
  onExtracted,
  onAdditionalTeesExtracted,
  isPremium,
}: ScorecardImageUploadProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [summary, setSummary] = useState<ExtractionSummary | null>(null);
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);

  // Use a ref to accumulate tee merges across parallel extractions
  const accumulatedTeeRef = useRef<Tee>(currentTee);

  const hasRatingGap =
    summary !== null && (!summary.courseRating || !summary.slopeRating);

  const hasFiles = trackedFiles.length > 0;
  const allDone = hasFiles && trackedFiles.every((f) => f.status === "done" || f.status === "error");
  const someSucceeded = trackedFiles.some((f) => f.status === "done");
  const completedCount = trackedFiles.filter((f) => f.status === "done").length;
  const totalCount = trackedFiles.length;

  const handleButtonClick = () => {
    if (!isPremium) {
      setUpsellOpen(true);
      return;
    }
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (isExtracting) return;
    setDialogOpen(open);
    if (!open) {
      setTrackedFiles([]);
      setError(null);
    }
  };

  const updateFileStatus = (index: number, status: FileStatus, fileError?: string) => {
    setTrackedFiles((prev) =>
      prev.map((f, fileIndex) =>
        fileIndex === index ? { ...f, status, error: fileError } : f
      )
    );
  };

  /**
   * Process a single file: encode → upload → analyze.
   * Returns the array of extracted tees from this file.
   */
  const processFile = async (
    trackedFile: TrackedFile,
    fileIndex: number
  ): Promise<ExtractedTee[]> => {
    try {
      // Step 1: Uploading (encoding to base64)
      updateFileStatus(fileIndex, "uploading");
      const base64 = await fileToBase64(trackedFile.file);

      // Step 2: Analyzing (API call)
      updateFileStatus(fileIndex, "analyzing");
      const response = await fetch("/api/ai/extract-scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: trackedFile.file.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const message =
          response.status === 429 && errorData.retryAfter
            ? `Rate limited (${errorData.retryAfter}s)`
            : errorData.error || "Extraction failed";
        updateFileStatus(fileIndex, "error", message);
        return [];
      }

      const data: ExtractionResponse = await response.json();
      updateFileStatus(fileIndex, "done");
      return data.tees;
    } catch {
      updateFileStatus(fileIndex, "error", "Something went wrong");
      return [];
    }
  };

  /**
   * Process all files in parallel, deduplicate tees, merge into the
   * current tee, and create additional tees via callback.
   */
  const handleExtract = async () => {
    if (trackedFiles.length === 0) return;

    setError(null);
    setIsExtracting(true);

    // Reset the accumulated tee to current state
    accumulatedTeeRef.current = currentTee;

    // Set all files to pending
    setTrackedFiles((prev) =>
      prev.map((f) => ({ ...f, status: "pending" as FileStatus }))
    );

    // Fire all extractions in parallel
    const results = await Promise.allSettled(
      trackedFiles.map((trackedFile, fileIndex) =>
        processFile(trackedFile, fileIndex)
      )
    );

    // Collect all extracted tees from all files
    const allExtractedTees: ExtractedTee[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allExtractedTees.push(...result.value);
      }
    }

    if (allExtractedTees.length > 0) {
      // Deduplicate across files (e.g., same tee found in scorecard + rating card)
      const deduplicatedTees = deduplicateExtractedTees(allExtractedTees);

      // First tee merges into the current form tee
      const firstExtracted = deduplicatedTees[0];
      accumulatedTeeRef.current = mergeExtractedTee(
        firstExtracted,
        accumulatedTeeRef.current
      );

      onExtracted(accumulatedTeeRef.current);

      // Additional tees get created as new full Tee objects
      if (deduplicatedTees.length > 1 && onAdditionalTeesExtracted) {
        const additionalTees = deduplicatedTees
          .slice(1)
          .map(extractedTeeToFullTee);
        onAdditionalTeesExtracted(additionalTees);
      }

      // Build summary
      const newSummary = buildExtractionSummary(deduplicatedTees, summary);
      setSummary(newSummary);
    }

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.length > 0
    ).length;
    const failCount = results.length - successCount;

    if (failCount > 0 && successCount === 0) {
      setError("All files failed to process. Please try again.");
    } else if (failCount > 0) {
      setError(
        `${failCount} of ${results.length} file${results.length > 1 ? "s" : ""} failed. Successfully extracted from ${successCount}.`
      );
    }

    setIsExtracting(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: TrackedFile[] = acceptedFiles.map((file) => ({
      file,
      status: "pending" as FileStatus,
    }));
    setTrackedFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
    setError(null);
  }, []);

  const removeFile = (index: number) => {
    setTrackedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE_BYTES,
    disabled: isExtracting,
    onDropRejected: (fileRejections) => {
      const firstError = fileRejections[0]?.errors[0];
      if (firstError?.code === "file-too-large") {
        setError("File too large. Maximum size is 10MB.");
      } else if (firstError?.code === "file-invalid-type") {
        setError("Unsupported file type. Use JPG, PNG, WebP, or PDF.");
      } else if (firstError?.code === "too-many-files") {
        setError(`Maximum ${MAX_FILES} files at a time.`);
      } else {
        setError("Invalid file. Please try a different one.");
      }
    },
  });

  const handleDismissSummary = () => {
    setSummary(null);
  };

  // Overall progress label for the main button
  const mainButtonLabel = isExtracting
    ? `Analyzing ${totalCount} file${totalCount > 1 ? "s" : ""}...`
    : "Add with AI";

  return (
    <div className="space-y-sm">
      {/* Primary "Add with AI" button */}
      <Button
        type="button"
        variant="default"
        onClick={handleButtonClick}
        disabled={isExtracting}
        className="w-full gap-sm"
      >
        {isExtracting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {mainButtonLabel}
      </Button>

      {/* Extraction summary (shown outside dialog after it closes) */}
      {summary && !isExtracting && !dialogOpen && (
        <div className="surface-muted border p-sm space-y-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Extraction results
              {summary.totalTeesFound > 1 && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  &middot; {summary.totalTeesFound} tees found
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismissSummary}
              aria-label="Dismiss extraction summary"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-x-md gap-y-xs">
            {SUMMARY_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5 text-sm">
                {summary[key] ? (
                  <Check className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                )}
                <span
                  className={
                    summary[key] ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-1.5 pt-xs">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              AI extraction may be inaccurate. Please review all values before saving.
            </p>
          </div>

          {hasRatingGap && (
            <div className="pt-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTrackedFiles([]);
                  setDialogOpen(true);
                }}
                className="w-full gap-sm"
              >
                <ImagePlus className="h-4 w-4" />
                Upload rating card for missing ratings
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                For accurate ratings, use a screenshot from the{" "}
                <a
                  href="https://ncrdb.usga.org/NCRListing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  USGA Course Rating Database
                </a>
                .
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload dialog with drag-and-drop */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-sm">
              <Sparkles className="h-5 w-5 text-primary" />
              {summary !== null && !someSucceeded
                ? "Upload Rating Card"
                : "Add with AI"}
            </DialogTitle>
            <DialogDescription>
              {summary !== null && !someSucceeded
                ? "Upload a photo of the slope/rating card to fill in the missing course and slope ratings."
                : "Upload photos of your scorecard and rating card. You can add multiple files at once."}
            </DialogDescription>
            <p className="text-xs text-muted-foreground pt-xs">
              For accurate course and slope ratings, we recommend using a screenshot from the{" "}
              <a
                href="https://ncrdb.usga.org/NCRListing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                USGA Course Rating Database
              </a>
              .
            </p>
          </DialogHeader>

          <div className="space-y-md">
            {/* Dropzone — hidden during extraction */}
            {!isExtracting && !allDone && (
              <div
                {...getRootProps()}
                className={cn(
                  "flex flex-col items-center justify-center gap-sm rounded-lg border-2 border-dashed p-xl transition-colors cursor-pointer",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload
                  className={cn(
                    "h-8 w-8",
                    isDragActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {isDragActive ? (
                  <p className="text-sm font-medium text-primary">
                    Drop your files here
                  </p>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Drag & drop files here
                      </p>
                      <p className="text-xs text-muted-foreground mt-xs">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WebP, or PDF &middot; Up to {MAX_FILES} files &middot; 10MB each
                    </p>
                  </>
                )}
              </div>
            )}

            {/* File list with per-file status */}
            {hasFiles && (
              <div className="space-y-sm">
                {isExtracting && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Processing {completedCount}/{totalCount}
                    </p>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
                {allDone && someSucceeded && (
                  <p className="text-sm font-medium text-success flex items-center gap-1.5">
                    <Check className="h-4 w-4" />
                    Extraction complete
                  </p>
                )}

                <div className="rounded-lg border divide-y overflow-hidden">
                  {trackedFiles.map((trackedFile, index) => (
                    <div
                      key={`${trackedFile.file.name}-${index}`}
                      className="flex items-center gap-sm p-2.5 bg-background"
                    >
                      <FileIcon mimeType={trackedFile.file.type} />
                      <div className="w-0 flex-1">
                        <p className="text-sm truncate">
                          {trackedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-xs">
                          {trackedFile.status === "error" && trackedFile.error ? (
                            <span className="text-destructive">
                              {trackedFile.error}
                            </span>
                          ) : (
                            <>
                              {(trackedFile.file.size / 1024 / 1024).toFixed(1)} MB
                              {trackedFile.status !== "pending" && (
                                <>
                                  <span className="text-muted-foreground/30">
                                    &middot;
                                  </span>
                                  <span
                                    className={
                                      trackedFile.status === "done"
                                        ? "text-success"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {FILE_STATUS_CONFIG[trackedFile.status].label}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      {isExtracting || allDone ? (
                        <FileStatusIcon status={trackedFile.status} />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeFile(index)}
                          aria-label={`Remove ${trackedFile.file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Extraction summary inside dialog */}
            {summary && allDone && someSucceeded && (
              <div className="surface-muted border p-sm space-y-sm">
                <p className="text-sm font-medium">
                  Extracted
                  {summary.totalTeesFound > 1 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      &middot; {summary.totalTeesFound} tees
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-x-md gap-y-xs">
                  {SUMMARY_ITEMS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      {summary[key] ? (
                        <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <span
                        className={
                          summary[key]
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                {hasRatingGap && (
                  <p className="text-xs text-muted-foreground pt-xs">
                    Missing ratings? Close this dialog and click &ldquo;Upload
                    rating card&rdquo; to add them.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-sm">
              {hasFiles && !isExtracting && !allDone && (
                <Button
                  type="button"
                  onClick={handleExtract}
                  className="flex-1 gap-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Extract from {totalCount} file{totalCount > 1 ? "s" : ""}
                </Button>
              )}
              {allDone && (
                <Button
                  type="button"
                  onClick={() => handleDialogClose(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isPremium && (
        <AiUpsellDialog open={upsellOpen} onOpenChange={setUpsellOpen} />
      )}
    </div>
  );
}

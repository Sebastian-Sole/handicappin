/**
 * Score-vs-par presentation helpers — map (strokes − par) onto the design
 * system's score palette (global.css: score-eagle … score-triple).
 */
export function scoreDiffLabel(diff: number): string {
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return `+${diff}`;
}

export function scoreDiffTextClass(diff: number): string {
  if (diff <= -2) return "text-score-eagle";
  if (diff === -1) return "text-score-birdie";
  if (diff === 0) return "text-score-par";
  if (diff === 1) return "text-score-bogey";
  if (diff === 2) return "text-score-double";
  return "text-score-triple";
}

export function scoreDiffTintClass(diff: number): string {
  if (diff <= -2) return "tint-score-eagle";
  if (diff === -1) return "tint-score-birdie";
  if (diff === 0) return "tint-score-par";
  if (diff === 1) return "tint-score-bogey";
  if (diff === 2) return "tint-score-double";
  return "tint-score-triple";
}

/** Running-total chip copy: E / +3 / −2. */
export function formatVsPar(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/**
 * Centralized feedback state types for form submissions and user notifications.
 * Used across auth, profile, scorecard, and contact components.
 */

/**
 * The type of feedback to display to the user.
 */
export type FeedbackType = "success" | "error" | "info";

/**
 * State for displaying feedback messages to users.
 */
export interface FeedbackState {
  type: FeedbackType;
  message: string;
}

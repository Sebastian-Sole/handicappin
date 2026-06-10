/**
 * Statistics tab stack — index + per-course detail push within the tab
 * (keeps the bottom bar visible, mirroring web's statistics → course-detail
 * navigation).
 */
import { Stack } from "expo-router";

export default function StatisticsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

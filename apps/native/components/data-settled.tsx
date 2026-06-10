/**
 * Zero-size marker carrying the `data-settled` accessibility label the
 * capture-hygiene gate polls for (verification/ios-gate/capture-hygiene.mjs).
 * Render with `settled` computed via useDataSettled(queries) — or `true` on
 * screens with no async data (vacuously settled, per lib/query/settle.ts).
 */
import { View } from "react-native";

import { DATA_SETTLED_LABEL } from "@/lib/query/settle";

export function DataSettledMarker({ settled }: { settled: boolean }) {
  if (!settled) return null;
  return (
    <View
      testID={DATA_SETTLED_LABEL}
      accessibilityLabel={DATA_SETTLED_LABEL}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 0, height: 0 }}
    />
  );
}

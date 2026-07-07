/**
 * Reserved GPS UI region. Renders nothing while the provider resolves null
 * — which is always, today (nullDistanceProvider; no course geo data, see
 * lib/round-session/geo.ts). When geo data + expo-location arrive, a real
 * provider is injected where this component is used and distance appears
 * here with zero layout rework.
 */
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import type {
  DistanceInfo,
  DistanceProvider,
} from "@/lib/round-session/geo";

interface DistanceToHoleProps {
  provider: DistanceProvider;
  holeNumber: number;
}

export function DistanceToHole({ provider, holeNumber }: DistanceToHoleProps) {
  const [info, setInfo] = useState<DistanceInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    provider
      .getDistanceToHole(holeNumber)
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, holeNumber]);

  if (info === null) return null;

  return (
    <View className="flex-row items-baseline justify-center gap-xs">
      <Text className="text-figure-lg text-foreground">
        {Math.round(info.meters)}
      </Text>
      <Text className="text-body-sm text-muted-foreground">
        m to {info.target}
      </Text>
    </View>
  );
}

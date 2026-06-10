/**
 * Token-fed bar chart — the native counterpart of web's recharts bar charts
 * (rounds per month, day-of-week, time-of-day). victory-native (Skia) per
 * the decision ledger; colors/typography come EXCLUSIVELY from tokens —
 * `// allow-hardcoded` only marks chart-internal geometry.
 */
import { useFont } from "@shopify/react-native-skia";
import { Text, View } from "react-native";
import { Bar, CartesianChart } from "victory-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";

const interFont = require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf") as number;

export interface BarDatum extends Record<string, unknown> {
  label: string;
  value: number;
}

interface TokenBarChartProps {
  data: BarDatum[];
  height?: number;
  testID?: string;
}

export function TokenBarChart({
  data,
  height = 192, // allow-hardcoded chart-internal geometry (mirrors web h-48)
  testID,
}: TokenBarChartProps) {
  const mode = useColorMode();
  const font = useFont(interFont, tokens.typography["text-meta"]?.fontSize ?? 12);
  const colors = tokens.colors[mode];

  if (data.length === 0) {
    return (
      <View className="items-center justify-center" style={{ height }}>
        <Text className="text-meta-strong text-foreground">
          No data available
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height }} testID={testID}>
      <CartesianChart
        data={data}
        xKey="label"
        yKeys={["value"] as const}
        domainPadding={{ left: 24, right: 24, top: 8 }} // allow-hardcoded chart-internal geometry
        axisOptions={{
          font,
          labelColor: colors["muted-foreground"],
          lineColor: colors.border,
          formatXLabel: (label) => String(label ?? ""),
        }}
      >
        {({ points, chartBounds }) => (
          <Bar
            points={points.value}
            chartBounds={chartBounds}
            color={colors.primary}
            roundedCorners={{ topLeft: 4, topRight: 4 }} // allow-hardcoded chart-internal geometry
            barWidth={Math.max(
              8, // allow-hardcoded chart-internal geometry
              Math.min(28, 240 / data.length), // allow-hardcoded chart-internal geometry
            )}
          />
        )}
      </CartesianChart>
    </View>
  );
}

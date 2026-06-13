/**
 * Native UsageLimitAlert — mirror of apps/web/components/scorecard/
 * usage-limit-alert.tsx. Upgrade is a web-only route (ledger §1) — the CTA
 * opens handicappin.com/upgrade in the browser.
 */
import { AlertCircle, TrendingUp, Zap } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";
import { SITE_URL } from "@/lib/legal";
import { cn } from "@/lib/utils";

const ICON_SIZE = 20; // allow-hardcoded lucide icon prop mirrors web's fixed h-5 w-5 icon box

interface UsageLimitAlertProps {
  current: number;
  total: number;
  resourceName?: string;
  variant?: "default" | "warning" | "critical";
}

export function UsageLimitAlert({
  current,
  total,
  resourceName = "rounds",
  variant = "default",
}: UsageLimitAlertProps) {
  const mode = useColorMode();
  const percentage = (current / total) * 100;
  const remaining = total - current;

  const container = {
    default: "surface",
    warning: "tint-warning",
    critical: "tint-destructive",
  }[variant];
  const iconColor = {
    default: tokens.colors[mode].primary,
    warning: tokens.colors[mode].warning,
    critical: tokens.colors[mode].destructive,
  }[variant];
  const Icon =
    variant === "critical"
      ? AlertCircle
      : variant === "warning"
        ? TrendingUp
        : Zap;

  return (
    <View className={cn("p-lg rounded-lg", container)} testID="usage-limit-alert">
      <View className="gap-md">
        <View className="flex-row items-start gap-sm">
          <View className="mt-xs">
            <Icon size={ICON_SIZE} color={iconColor} />
          </View>
          <View className="flex-1 gap-xs">
            <Text className="text-heading-3 text-foreground">
              {variant === "critical"
                ? "Almost at your limit"
                : variant === "warning"
                  ? "Approaching your limit"
                  : "Usage Limit"}
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              You have{" "}
              <Text className="text-body-sm font-semibold text-foreground">
                {remaining} out of {total}
              </Text>{" "}
              {resourceName} remaining
            </Text>
          </View>
        </View>

        <View className="gap-sm">
          <Progress value={percentage} />
          <Text className="text-meta text-muted-foreground">
            {percentage.toFixed(0)}% used
          </Text>
        </View>

        <Button
          className="w-full"
          onPress={() => {
            void WebBrowser.openBrowserAsync(`${SITE_URL}/upgrade`);
          }}
        >
          Upgrade Plan
        </Button>
      </View>
    </View>
  );
}

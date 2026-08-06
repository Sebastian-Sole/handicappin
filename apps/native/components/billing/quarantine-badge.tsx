/**
 * Quarantine badge — native twin of apps/web/components/billing/
 * quarantine-badge.tsx (decision D4: quarantined rounds stay VISIBLE in every
 * list and are excluded only from handicap-derived statistics).
 *
 * Upgrade is a web-only route (ledger §1), so the CTA opens the browser —
 * same shape as the native UsageLimitAlert. Copy is mirrored verbatim from
 * the web twin.
 */
import * as WebBrowser from "expo-web-browser";
import { Lock } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { Badge } from "@/components/ui/badge";
import { analytics } from "@/lib/analytics";
import { useColorMode } from "@/lib/color-mode";
import { SITE_URL } from "@/lib/legal";
import { cn } from "@/lib/utils";

const LOCK_SIZE = 12; // allow-hardcoded lucide icon prop mirrors web's fixed h-3 w-3 icon box

/** Copy deck — mirrored verbatim from the web twin. */
export const QUARANTINE_BADGE_LABEL = "Not counted — free-tier limit reached";
export const QUARANTINE_BADGE_EXPLANATION =
  "This round was saved but doesn't count toward your handicap or statistics. Upgrade to unlock it.";
export const QUARANTINE_BADGE_CTA = "Upgrade to count it";

interface QuarantineBadgeProps {
  className?: string;
}

export function QuarantineBadge({ className }: QuarantineBadgeProps) {
  const mode = useColorMode();

  return (
    <View className={cn("flex-row flex-wrap items-center gap-sm", className)}>
      <Badge variant="outline" className="tint-warning border px-sm">
        <View
          className="flex-row items-center gap-xs"
          accessibilityLabel={`${QUARANTINE_BADGE_LABEL}. ${QUARANTINE_BADGE_EXPLANATION}`}
        >
          <Lock size={LOCK_SIZE} color={tokens.colors[mode].warning} />
          <Text className="text-meta text-warning">
            {QUARANTINE_BADGE_LABEL}
          </Text>
        </View>
      </Badge>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          analytics.capture("upgrade_clicked", {
            surface: "quarantined_round_badge",
          });
          void WebBrowser.openBrowserAsync(`${SITE_URL}/upgrade`);
        }}
      >
        <Text className="text-meta-strong text-primary underline">
          {QUARANTINE_BADGE_CTA}
        </Text>
      </Pressable>
    </View>
  );
}

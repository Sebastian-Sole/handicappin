/**
 * Paywall compliance block (App Store 3.1.2): auto-renew disclosure copy
 * plus Terms of Service / Privacy Policy links. Rendered on every surface
 * that shows purchase buttons (handoff DoD #8).
 */
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { AUTO_RENEW_DISCLOSURE } from "@/lib/billing/paywall-policy";
import { openLegalDocument } from "@/lib/legal";

export function PaywallDisclosure() {
  return (
    <View className="gap-sm" testID="paywall-disclosure">
      <Text className="text-meta text-muted-foreground">
        {AUTO_RENEW_DISCLOSURE}
      </Text>
      <View className="flex-row gap-md">
        <Button
          variant="link"
          className="px-0"
          onPress={() => void openLegalDocument("terms")}
        >
          Terms of Service
        </Button>
        <Button
          variant="link"
          className="px-0"
          onPress={() => void openLegalDocument("privacy")}
        >
          Privacy Policy
        </Button>
      </View>
    </View>
  );
}

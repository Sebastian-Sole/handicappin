/** Native VerificationBox — mirror of apps/web/components/auth/verification-box.tsx. */
import { CheckCircle } from "lucide-react-native";
import { Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { useColorMode } from "@/lib/color-mode";

const ICON_SIZE = 20; // allow-hardcoded lucide icon prop mirrors web's fixed h-5 w-5 icon box

export function VerificationBox() {
  const mode = useColorMode();
  return (
    <View className="w-full">
      <View className="tint-success border-l-2 border-success p-md rounded-md">
        <View className="flex-row items-center">
          <CheckCircle size={ICON_SIZE} color={tokens.colors[mode].success} />
          <View className="ml-sm">
            <Text className="text-label-sm text-success">
              Account Verified
            </Text>
            <Text className="mt-xs text-meta text-success">
              Your account is now verified, login to continue.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

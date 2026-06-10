/**
 * Token gallery — the bring-up screen.
 *
 * Renders the generated design-system contract end-to-end so the NativeWind
 * pipeline, the typography ramp, and the surface recipes can be verified on a
 * device/simulator before any product screen is ported. The verification
 * harness uses this screen for calibration. Replace with the real home screen
 * once porting starts (it must then mirror apps/web/app/page.tsx).
 *
 * Styling rules apply here like everywhere in native: className utilities
 * from the generated theme or values from @handicappin/tokens — nothing
 * hardcoded (enforced by pnpm parity:styles).
 */
import { tokens } from "@handicappin/tokens/tokens";
import { ScrollView, Text, View } from "react-native";

const SWATCH_NAMES = [
  "primary",
  "secondary",
  "accent",
  "muted",
  "destructive",
  "success",
  "warning",
  "info",
] as const;

const TYPE_RAMP = [
  "text-heading-1",
  "text-heading-3",
  "text-heading-5",
  "text-body",
  "text-body-sm",
  "text-figure-lg",
  "text-meta",
  "text-eyebrow",
] as const;

const SURFACES = [
  "surface",
  "surface-muted",
  "tint-primary",
  "tint-success",
  "tint-warning",
  "tint-destructive",
  "chip-primary",
  "icon-chip-info",
] as const;

export default function TokenGallery() {
  return (
    <ScrollView
      testID="token-gallery"
      className="flex-1 bg-background"
      contentContainerClassName="p-lg gap-lg"
    >
      <Text className="text-heading-2 text-foreground">Token gallery</Text>
      <Text className="text-body-sm text-muted-foreground">
        Generated from the web design system. If this screen looks right, the
        token pipeline works.
      </Text>

      <Text className="text-heading-4 text-foreground">Colors</Text>
      <View className="flex-row flex-wrap gap-sm" testID="gallery-colors">
        {SWATCH_NAMES.map((name) => (
          <View key={name} className="items-center gap-xs">
            <View
              className="w-16 h-16 rounded-lg border border-border"
              style={{ backgroundColor: tokens.colors.light[name] }}
            />
            <Text className="text-meta text-muted-foreground">{name}</Text>
          </View>
        ))}
      </View>

      <Text className="text-heading-4 text-foreground">Typography</Text>
      <View className="gap-xs" testID="gallery-typography">
        {TYPE_RAMP.map((cls) => (
          <Text key={cls} className={`${cls} text-foreground`}>
            {cls}
          </Text>
        ))}
      </View>

      <Text className="text-heading-4 text-foreground">Surfaces</Text>
      <View className="gap-sm" testID="gallery-surfaces">
        {SURFACES.map((cls) => (
          <View key={cls} className={`${cls} p-md`}>
            <Text className="text-label-sm text-foreground">{cls}</Text>
          </View>
        ))}
      </View>

      <Text className="text-heading-4 text-foreground">Spacing ramp</Text>
      <View className="gap-xs" testID="gallery-spacing">
        {Object.entries(tokens.spacing).map(([name, px]) => (
          <View key={name} className="flex-row items-center gap-sm">
            <Text className="text-meta text-muted-foreground w-8">{name}</Text>
            <View className="h-2 rounded-sm bg-bar-active" style={{ width: px }} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Full-screen hole-in-one celebration — native mirror of
 * apps/web/components/scorecard/hole-in-one-celebration.tsx. A transparent
 * modal with a confetti burst and headline that holds for ~1.6s, then
 * calls onDone. Purely visual: the score is already committed when this
 * shows (data safety first, party second).
 */
import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Text, View } from "react-native";

/** How long the celebration holds before onDone (drives nav delays too). */
export const HOLE_IN_ONE_CELEBRATION_MS = 2800;

const CONFETTI = ["🎉", "⛳️", "🎊", "🏌️", "✨", "🎉"] as const;

export function HoleInOneCelebration({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone?: () => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    burst.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        toValue: 1,
        duration: HOLE_IN_ONE_CELEBRATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(
      () => onDoneRef.current?.(),
      HOLE_IN_ONE_CELEBRATION_MS,
    );
    return () => clearTimeout(timer);
  }, [visible, scale, burst]);

  if (!visible) return null;

  return (
    <Modal transparent statusBarTranslucent animationType="fade">
      <View
        testID="hole-in-one-celebration"
        className="flex-1 items-center justify-center bg-overlay"
      >
        {CONFETTI.map((emoji, i) => (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: `${8 + i * 15}%`,
              top: "55%",
              opacity: burst.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
              transform: [
                {
                  translateY: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -160 - (i % 3) * 60],
                  }),
                },
                {
                  rotate: burst.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", i % 2 === 0 ? "60deg" : "-60deg"],
                  }),
                },
              ],
            }}
          >
            <Text className="text-figure">{emoji}</Text>
          </Animated.View>
        ))}
        <Animated.View style={{ transform: [{ scale }] }}>
          <View className="items-center gap-sm rounded-lg bg-background px-lg py-lg">
            <Text className="text-display">⛳️</Text>
            <Text className="text-figure text-foreground">HOLE IN ONE!</Text>
            <Text className="text-body-sm text-muted-foreground">
              One swing. That&apos;s the whole hole.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

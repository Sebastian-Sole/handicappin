/**
 * Native Input — mirror of apps/web/components/ui/input.tsx (same box
 * recipe: h-10, rounded-md, border-input, bg-background, px-md py-sm).
 */
import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";
import { cn } from "@/lib/utils";
import { useColorMode } from "@/lib/color-mode";

export interface InputProps extends TextInputProps {
  className?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { className, editable, ...props },
  ref,
) {
  const mode = useColorMode();
  return (
    <TextInput
      ref={ref}
      editable={editable}
      placeholderTextColor={tokens.colors[mode]["muted-foreground"]}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-md py-sm text-body-sm text-foreground",
        editable === false && "opacity-50",
        className,
      )}
      {...props}
    />
  );
});

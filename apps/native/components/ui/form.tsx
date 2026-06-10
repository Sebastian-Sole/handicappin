/**
 * react-hook-form wrappers — native mirror of apps/web/components/ui/form.tsx
 * (FormField/FormItem/FormLabel/FormMessage with the same composition and
 * type-level API) so ported screens read nearly identically to their twins.
 * FormControl is omitted: it exists on web for Radix Slot/aria wiring; on
 * native the input receives the field props directly.
 */
import { createContext, useContext, type ReactNode } from "react";
import {
  Controller,
  useFormContext,
  FormProvider,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Text, View } from "react-native";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

interface FormFieldContextValue {
  name: string;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const formContext = useFormContext();
  if (!fieldContext) {
    throw new Error("useFormField must be used within <FormField>");
  }
  const fieldState = formContext.getFieldState(
    fieldContext.name,
    formContext.formState,
  );
  return { name: fieldContext.name, ...fieldState };
}

function FormItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={cn("gap-sm", className)}>{children}</View>;
}

function FormLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { error } = useFormField();
  return (
    <Label className={cn(error && "text-destructive", className)}>
      {children}
    </Label>
  );
}

function FormMessage({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const { error } = useFormField();
  const body = error ? String(error.message ?? "") : children;
  if (!body) return null;
  return (
    <Text className={cn("text-label-sm text-destructive", className)}>
      {body}
    </Text>
  );
}

export { Form, FormField, FormItem, FormLabel, FormMessage, useFormField };

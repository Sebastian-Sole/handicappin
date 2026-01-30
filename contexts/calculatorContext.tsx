"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  CalculatorValues,
  CalculatorFieldType,
} from "@/types/calculators";

interface CalculatorContextProps {
  values: CalculatorValues;
  setValue: <K extends keyof CalculatorValues>(
    field: K,
    value: CalculatorValues[K]
  ) => void;
  setValues: (updates: Partial<CalculatorValues>) => void;
  resetValues: () => void;
  // Track which calculator last updated each field for UI highlighting
  lastUpdatedBy: Partial<Record<CalculatorFieldType, string | null>>;
  setLastUpdatedBy: (field: CalculatorFieldType, calculatorId: string | null) => void;
  // Expansion state for mobile accordion
  expandedCalculator: string | null;
  setExpandedCalculator: (id: string | null) => void;
}

const createDefaultValues = (): CalculatorValues => ({
  handicapIndex: null,
  courseHandicap: null,
  playingHandicap: null,
  scoreDifferential: null,
  adjustedGrossScore: null,
  courseRating: null,
  slopeRating: null,
  par: null,
  holesPlayed: 18,
  lowHandicapIndex: null,
  scoreDifferentials: [],
});

const CalculatorContext = createContext<CalculatorContextProps | undefined>(
  undefined
);

export function CalculatorProvider({ children }: { children: ReactNode }) {
  const [values, setValuesState] = useState<CalculatorValues>(createDefaultValues);
  const [lastUpdatedBy, setLastUpdatedByState] = useState<
    Partial<Record<CalculatorFieldType, string | null>>
  >({});
  const [expandedCalculator, setExpandedCalculator] = useState<string | null>(
    null
  );

  const setValue = useCallback(
    <K extends keyof CalculatorValues>(field: K, value: CalculatorValues[K]) => {
      setValuesState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const setValues = useCallback((updates: Partial<CalculatorValues>) => {
    setValuesState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetValues = useCallback(() => {
    setValuesState(createDefaultValues());
    setLastUpdatedByState({});
  }, []);

  const setLastUpdatedBy = useCallback(
    (field: CalculatorFieldType, calculatorId: string | null) => {
      setLastUpdatedByState((prev) => ({ ...prev, [field]: calculatorId }));
    },
    []
  );

  return (
    <CalculatorContext.Provider
      value={{
        values,
        setValue,
        setValues,
        resetValues,
        lastUpdatedBy,
        setLastUpdatedBy,
        expandedCalculator,
        setExpandedCalculator,
      }}
    >
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculatorContext() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error(
      "useCalculatorContext must be used within CalculatorProvider"
    );
  }
  return context;
}

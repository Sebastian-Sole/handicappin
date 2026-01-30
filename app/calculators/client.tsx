"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { H1, Muted } from "@/components/ui/typography";
import { CalculatorProvider } from "@/contexts/calculatorContext";
import { LinkedValuesBar } from "@/components/calculators/linked-values-bar";
import { CalculatorGrid } from "@/components/calculators/calculator-grid";
import { Calculator, Lightbulb, GraduationCap } from "lucide-react";

export function CalculatorsPageClient() {
  const [activeTab, setActiveTab] = useState<
    "core" | "advanced" | "educational"
  >("core");

  return (
    <CalculatorProvider>
      <div className="min-h-screen">
        <LinkedValuesBar />

        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <H1>Golf Calculators</H1>
            <Muted className="max-w-2xl mx-auto">
              WHS-compliant calculators to help you understand your handicap.
              Values automatically link between calculators for seamless
              calculations.
            </Muted>
          </div>

          {/* Category Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as "core" | "advanced" | "educational")
            }
          >
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="core" className="gap-2">
                <Calculator className="h-4 w-4 hidden sm:block" />
                Core
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Lightbulb className="h-4 w-4 hidden sm:block" />
                Advanced
              </TabsTrigger>
              <TabsTrigger value="educational" className="gap-2">
                <GraduationCap className="h-4 w-4 hidden sm:block" />
                Educational
              </TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="core">
                <CalculatorGrid category="core" />
              </TabsContent>
              <TabsContent value="advanced">
                <CalculatorGrid category="advanced" />
              </TabsContent>
              <TabsContent value="educational">
                <CalculatorGrid category="educational" />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </CalculatorProvider>
  );
}

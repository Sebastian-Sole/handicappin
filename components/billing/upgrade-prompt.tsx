"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UpgradePromptProps {
  remainingRounds: number | null;
}

export function UpgradePrompt({ remainingRounds }: UpgradePromptProps) {
  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
      <h3 className="text-xl font-semibold mb-2">Upgrade for More</h3>

      {remainingRounds !== null && remainingRounds <= 5 && (
        <p className="text-orange-600 font-semibold mb-4">
          ⚠️ Only {remainingRounds} rounds remaining!
        </p>
      )}

      <p className="mb-4">
        Upgrade to Premium or Unlimited to get unlimited rounds, advanced
        analytics, and more.
      </p>

      <Button onClick={() => (window.location.href = "/onboarding")}>
        View Plans
      </Button>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/types/supabase";
import { FeatureAccess } from "@/types/billing";
import { PersonalInformationTab } from "./tabs/personal-information-tab";
import { BillingTab } from "./tabs/billing-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { User as UserIcon, CreditCard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "personal" | "billing" | "settings";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TabbedProfilePageProps {
  authUser: User;
  profile: Tables<"profile">;
  access: FeatureAccess;
}

const tabs: Tab[] = [
  { id: "personal", label: "Personal Information", icon: UserIcon },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "settings", label: "Settings", icon: Settings },
];

export function TabbedProfilePage({
  authUser,
  profile,
  access,
}: TabbedProfilePageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial tab from URL or default to "personal"
  const initialTab = (searchParams.get("tab") as TabId) || "personal";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Handle tab changes - update URL without causing re-render loop
  const handleTabChange = (newTab: TabId) => {
    setActiveTab(newTab);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("tab", newTab);
    router.replace(`/profile/${authUser.id}?${newParams.toString()}`, {
      scroll: false,
    });
  };

  // Only sync state when URL changes externally (e.g., browser back/forward)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as TabId;
    const validTab =
      urlTab &&
      (urlTab === "personal" || urlTab === "billing" || urlTab === "settings")
        ? urlTab
        : "personal";

    // Only update if different from current state
    if (validTab !== activeTab) {
      setActiveTab(validTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Intentionally exclude activeTab to prevent infinite loop

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground text-lg">
            Manage your account settings
          </p>
        </div>

        {/* Tabbed Layout */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-56 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {activeTab === "personal" && (
              <PersonalInformationTab authUser={authUser} profile={profile} />
            )}
            {activeTab === "billing" && <BillingTab access={access} />}
            {activeTab === "settings" && <SettingsTab userId={authUser.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

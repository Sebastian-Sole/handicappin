import { Card } from "@/components/ui/card";
import { PlusCircle, LayoutDashboard, Calculator, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  userId: string;
  className?: string;
}

export function QuickActions({ userId, className }: QuickActionsProps) {
  const actions = [
    {
      label: "Log Round",
      href: "/rounds/add",
      icon: PlusCircle,
      primary: true,
    },
    {
      label: "Dashboard",
      href: `/dashboard/${userId}`,
      icon: LayoutDashboard,
    },
    {
      label: "Calculators",
      href: "/calculators",
      icon: Calculator,
    },
    {
      label: "Profile",
      href: `/profile/${userId}`,
      icon: Settings,
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Card
            className={cn(
              "p-4 flex flex-col items-center justify-center gap-2 h-full",
              "hover:bg-accent/50 transition-colors cursor-pointer",
              action.primary && "bg-primary/5 border-primary/20"
            )}
          >
            <action.icon
              className={cn(
                "h-6 w-6",
                action.primary ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                action.primary ? "text-primary" : "text-foreground"
              )}
            >
              {action.label}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

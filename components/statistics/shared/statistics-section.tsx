"use client";

import { cn } from "@/lib/utils";
import { H3, Muted } from "@/components/ui/typography";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface StatisticsSectionProps {
  icon: string;
  title: string;
  description?: string;
  learnMoreContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function StatisticsSection({
  icon,
  title,
  description,
  learnMoreContent,
  children,
  className,
}: StatisticsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={cn(
        "space-y-4 transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="flex-1">
          <H3 className="mt-0">{title}</H3>
          {description && <Muted className="mt-1">{description}</Muted>}
        </div>
      </div>

      <div className="ml-14">{children}</div>

      {learnMoreContent && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-14">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
            {isOpen ? "Hide" : "Learn more"}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              {learnMoreContent}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}

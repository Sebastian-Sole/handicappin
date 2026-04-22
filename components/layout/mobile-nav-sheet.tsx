"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavSheetProps {
  links: NavLink[];
  headerContent?: React.ReactNode;
  children?: React.ReactNode;
}

export function MobileNavSheet({ links, headerContent, children }: MobileNavSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center gap-md lg:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="xs:w-64">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex flex-col gap-md p-md">
            {headerContent && (
              <>
                <div onClick={() => setIsOpen(false)}>
                  {headerContent}
                </div>
                <Separator />
              </>
            )}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:underline hover:underline-offset-4"
                prefetch={true}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {children && (
              <>
                <Separator />
                {children}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

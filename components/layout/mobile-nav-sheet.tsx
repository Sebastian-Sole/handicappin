"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavSheetProps {
  links: NavLink[];
  children?: React.ReactNode;
}

export function MobileNavSheet({ links, children }: MobileNavSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  if (previousPathname.current !== pathname) {
    previousPathname.current = pathname;
    setIsOpen(false);
  }

  return (
    <div className="flex items-center gap-4 lg:hidden">
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
          <div className="flex flex-col gap-4 p-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:underline hover:underline-offset-4"
                prefetch={true}
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

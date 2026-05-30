import Link from "next/link";
import Image from "next/image";
import ThemeButton from "@/components/layout/themeButton";
import { Large } from "@/components/ui/typography";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex grow flex-col">
      <header className="w-full">
        <div className="flex h-16 items-center justify-between px-md sm:px-lg">
          <Link
            href="/"
            className="flex items-center gap-sm shrink-0"
            prefetch={true}
          >
            <Image
              src="/images/logo.png"
              alt="Handicappin Golf Handicap Tracker Logo"
              width={32}
              height={32}
              sizes="32px"
              className="h-8 w-8"
            />
            <Large>Handicappin&apos;</Large>
          </Link>
          <ThemeButton size="icon" />
        </div>
      </header>
      <div className="flex grow flex-col">{children}</div>
    </div>
  );
}

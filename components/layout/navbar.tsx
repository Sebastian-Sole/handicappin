import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import LogoutButton from "../auth/logoutButton";
import { Large } from "../ui/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  BarChart3,
  CirclePlus,
  LayoutDashboardIcon,
  SettingsIcon,
  UserIcon,
  UserRound,
} from "lucide-react";
import ThemeButton from "./themeButton";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { getUserIdFromCookies } from "@/utils/supabase/auth-cookies";

function LogoBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0" prefetch={true}>
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
  );
}

function UnauthenticatedNavbar() {
  return (
    <header className="fixed top-0 z-50 w-full bg-background shadow-xs">
      <div className="container relative flex h-16 items-center justify-between px-4 sm:px-6 m-0 max-w-full">
        <LogoBrand />
        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 text-sm font-medium md:flex">
          <Link
            href="/"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Home
          </Link>
          <Link
            href="/about"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            About
          </Link>
          <Link
            href="/calculators"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Calculators
          </Link>
        </nav>
        <div className="flex items-center gap-4 justify-end flex-shrink-0">
          <Link href={"/signup"} className="lg:block hidden">
            <Button>Sign Up</Button>
          </Link>
          <Link href={"/login"} className="lg:block hidden">
            <Button>Login</Button>
          </Link>
          <ThemeButton size="icon" className="lg:flex hidden" />

          <MobileNavSheet
            links={[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/calculators", label: "Calculators" },
              { href: "/contact", label: "Contact" },
            ]}
          >
            <div className="flex flex-col">
              <Link href="/signup">
                <Button className="w-full mb-4">Sign Up</Button>
              </Link>
              <Link href="/login">
                <Button className="w-full">Login</Button>
              </Link>
            </div>
          </MobileNavSheet>
        </div>
      </div>
    </header>
  );
}

export async function Navbar() {
  const userId = await getUserIdFromCookies();

  if (!userId) {
    return <UnauthenticatedNavbar />;
  }

  return (
    <header className="fixed top-0 z-50 w-full bg-background shadow-xs">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 m-0 max-w-full">
        <LogoBrand />
        <nav className="hidden flex-1 items-center justify-center gap-6 text-sm font-medium lg:flex">
          <Link
            href="/"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Home
          </Link>
          <Link
            href="/about"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            About
          </Link>
          <Link
            href="/calculators"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Calculators
          </Link>
          <Link
            href={`/dashboard/${userId}`}
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Dashboard
          </Link>
          <Link
            href="/statistics"
            className="hover:underline hover:underline-offset-4 whitespace-nowrap"
            prefetch={true}
          >
            Statistics
          </Link>
        </nav>
        <div className="flex items-center gap-4 justify-end flex-shrink-0">
          <Link href={"/rounds/add"} className="xl:block hidden">
            <Button variant={"default"}>Add Round</Button>
          </Link>
          <ThemeButton size="icon" className="md:flex hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full bg-primary p-1 hover:bg-primary/80"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8 flex items-center justify-center">
                  <UserRound
                    strokeWidth={1.5}
                    className="h-6 w-6 text-primary-foreground"
                  />
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Link href={`/profile/${userId}`}>
                <DropdownMenuItem>
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
              </Link>
              <Link href={`/profile/${userId}?tab=settings`}>
                <DropdownMenuItem>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </Link>
              <Link href={`/dashboard/${userId}`}>
                <DropdownMenuItem>
                  <LayoutDashboardIcon className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
              </Link>
              <Link href="/statistics">
                <DropdownMenuItem>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Statistics
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <Link href={"/rounds/add"}>
                <DropdownMenuItem>
                  <CirclePlus className="h-4 w-4 mr-2" />
                  Add Round
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogoutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <MobileNavSheet
            links={[
              { href: "/", label: "Home" },
              { href: "/about", label: "About" },
              { href: "/calculators", label: "Calculators" },
              { href: `/dashboard/${userId}`, label: "Dashboard" },
              { href: "/statistics", label: "Statistics" },
              { href: "/contact", label: "Contact" },
            ]}
          >
            <LogoutButton />
          </MobileNavSheet>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
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
  CirclePlus,
  LayoutDashboardIcon,
  Menu,
  SettingsIcon,
  UserIcon,
  UserRound,
} from "lucide-react";
import { Separator } from "../ui/separator";
import ThemeButton from "./themeButton";
import { getUserIdFromCookies } from "@/utils/supabase/auth-cookies";

function LogoBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 w-1/3"
      prefetch={true}
    >
      <Image
        src="/images/logo.png"
        alt="Handicappin Golf Handicap Tracker Logo"
        width={470}
        height={470}
        className="h-8 w-8"
      />
      <Large>Handicappin&apos;</Large>
    </Link>
  );
}

function UnauthenticatedNavbar() {
  return (
    <header className="fixed top-0 z-50 w-full bg-background shadow-xs">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 m-0 max-w-full">
        <LogoBrand />
        <nav className="hidden w-1/3 items-center justify-center gap-6 text-sm font-medium md:flex">
          <Link
            href="/"
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            Home
          </Link>
          <Link
            href="/about"
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            About
          </Link>
          <Link
            href="/calculators"
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            Calculators
          </Link>
        </nav>
        <div className="flex items-center gap-4 xs:w-1/3 justify-end">
          <Link href={"/signup"} className="lg:block hidden">
            <Button>Sign Up</Button>
          </Link>
          <Link href={"/login"} className="lg:block hidden">
            <Button>Login</Button>
          </Link>
          <ThemeButton size="icon" className="lg:flex hidden" />

          <div className="flex items-center gap-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="xs:w-64">
                <div className="flex flex-col gap-4 p-4">
                  <Link
                    href="/"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Home
                  </Link>
                  <Link
                    href="/about"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    About
                  </Link>
                  <Link
                    href="/calculators"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Calculators
                  </Link>
                  <Link
                    href="/contact"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Contact
                  </Link>
                  <Separator />
                  <div className="flex flex-col">
                    <Link href={"/signup"} className="">
                      <Button className="w-full mb-4">Sign Up</Button>
                    </Link>
                    <Link href={"/login"} className="">
                      <Button className="w-full">Login</Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

export async function Navbar() {
  const userId = await getUserIdFromCookies();
  console.log("[Navbar] userId from cookies:", userId);

  if (!userId) {
    console.log("[Navbar] Rendering UnauthenticatedNavbar");
    return <UnauthenticatedNavbar />;
  }

  console.log("[Navbar] Rendering AuthenticatedNavbar for user:", userId);

  return (
    <header className="fixed top-0 z-50 w-full bg-background shadow-xs">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 m-0 max-w-full">
        <LogoBrand />
        <nav className="hidden w-1/3 items-center justify-center gap-6 text-sm font-medium md:flex ">
          <Link
            href="/"
            className="hover:underline hover:underline-offset-4 "
            prefetch={true}
          >
            Home
          </Link>
          <Link
            href="/about"
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            About
          </Link>
          <Link
            href="/calculators"
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            Calculators
          </Link>
          <Link
            href={`/dashboard/${userId}`}
            className="hover:underline hover:underline-offset-4"
            prefetch={true}
          >
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-4 xs:w-1/3 justify-end">
          <Link href={"/rounds/add"} className="xl:block hidden">
            <Button variant={"default"}>Add Round</Button>
          </Link>
          <ThemeButton size="icon" className="md:flex hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Link
                href="#"
                className="rounded-full bg-primary p-1 hover:bg-primary/80"
                prefetch={true}
              >
                <Avatar className="h-8 w-8 flex items-center justify-center">
                  <UserRound
                    strokeWidth={1.5}
                    className="h-6 w-6 text-primary-foreground"
                  />
                </Avatar>
              </Link>
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
          <div className="flex items-center gap-4 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="xs:w-64">
                <div className="flex flex-col gap-4 p-4">
                  <Link
                    href="/"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Home
                  </Link>
                  <Link
                    href="/about"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    About
                  </Link>
                  <Link
                    href="/calculators"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Calculators
                  </Link>
                  <Link
                    href={`/dashboard/${userId}`}
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/contact"
                    className="hover:underline hover:underline-offset-4"
                    prefetch={true}
                  >
                    Contact
                  </Link>

                  <LogoutButton />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

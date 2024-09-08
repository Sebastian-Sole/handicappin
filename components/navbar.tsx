import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { createServerComponentClient } from "@/utils/supabase/server";
import ThemeButton from "./themeButton";
import LogoutButton from "./logoutButton";
import { Large } from "./ui/typography";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  CirclePlus,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { Separator } from "./ui/separator";

export async function Navbar() {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const isAuthed = data?.user;

  return (
    <header className="fixed top-0 z-50 w-full bg-background shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6 m-0 max-w-full">
        <Link
          href="/"
          className="flex items-center gap-2 w-1/3"
          prefetch={false}
        >
          <Large>Handicappin&apos;</Large>
        </Link>
        {isAuthed && (
          <>
            <nav className="hidden w-1/3 items-center justify-center gap-6 text-sm font-medium sm:flex">
              <Link
                href="/"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                Home
              </Link>
              <Link
                href="/about"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                About
              </Link>
              <Link
                href="/calculators"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                Calculators
              </Link>
              <Link
                href={`/dashboard/${data.user.id}`}
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                Dashboard
              </Link>
            </nav>
            <div className="flex items-center gap-4 sm:w-1/3 justify-end">
              <Link href={"/rounds/add"} className="">
                <Button>Add Round</Button>
              </Link>
              <ThemeButton size="icon" className="md:flex hidden" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Link
                    href="#"
                    className="rounded-full bg-muted p-2 hover:bg-muted-foreground"
                    prefetch={false}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder-user.jpg" alt="@shadcn" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                  </Link>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <Link href={`/profile/${data.user.id}`}>
                    <DropdownMenuItem>
                      <UserIcon className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                  </Link>
                  <Link href={"/settings"}>
                    <DropdownMenuItem>
                      <SettingsIcon className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </Link>
                  <Link href={`/dashboard/${data.user.id}`}>
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
              <div className="flex items-center gap-4 sm:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <MenuIcon className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="sm:w-64">
                    <div className="flex flex-col gap-4 p-4">
                      <Link
                        href="#"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Home
                      </Link>
                      <Link
                        href="#"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        About
                      </Link>
                      <Link
                        href="#"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Services
                      </Link>
                      <Link
                        href="#"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Contact
                      </Link>

                      <LogoutButton />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </>
        )}
        {!isAuthed && (
          <>
            <nav className="hidden w-1/3 items-center justify-center gap-6 text-sm font-medium sm:flex">
              <Link
                href="/"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                Home
              </Link>
              <Link
                href="/about"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                About
              </Link>
              <Link
                href="/calculators"
                className="hover:underline hover:underline-offset-4"
                prefetch={false}
              >
                Calculators
              </Link>
            </nav>
            <div className="flex items-center gap-4 sm:w-1/3 justify-end">
              <Link href={"/signup"} className="">
                <Button>Sign Up</Button>
              </Link>
              <Link href={"/login"} className="">
                <Button>Login</Button>
              </Link>
              <ThemeButton size="icon" className="md:flex hidden" />

              <div className="flex items-center gap-4 sm:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <MenuIcon className="h-6 w-6" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="sm:w-64">
                    <div className="flex flex-col gap-4 p-4">
                      <Link
                        href="/"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Home
                      </Link>
                      <Link
                        href="/about"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        About
                      </Link>
                      <Link
                        href="/calculators"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Calculators
                      </Link>
                      <Link
                        href="/contact"
                        className="hover:underline hover:underline-offset-4"
                        prefetch={false}
                      >
                        Contact
                      </Link>
                      <LogoutButton />
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
          </>
        )}
      </div>
    </header>
  );
}

function MenuIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function SunIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

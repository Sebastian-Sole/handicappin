import { createServerComponentClient } from "@/utils/supabase/server";
import { H1 } from "./ui/typography";
import LogoutButton from "./logoutButton";
import Link from "next/link";
import { Button } from "./ui/button";
import ThemeButton from "./themeButton";

const Navbar = async () => {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const isAuthed = data?.user;

  return (
    <div className="flex sm:grid sm:grid-cols-3 gap-4 pt-6 justify-center sm:justify-between flex-row pb-6 items-center">
      <div className="hidden sm:flex items-center justify-center">
        <h1>Logo</h1>
      </div>

      <div className="flex items-center justify-center">
        <H1 className="text-primary">Handicappin&apos;</H1>
      </div>

      {!isAuthed && (
        <div className="items-center justify-end space-x-8 sm:space-x-4 hidden sm:flex mr-10 sm:mr-5">
          <Link href={"/login"}>
            <Button>Login</Button>
          </Link>
          <Link href={"/signup"}>
            <Button>Signup</Button>
          </Link>
          <ThemeButton />
        </div>
      )}

      {isAuthed && (
        <div className="items-center justify-end space-x-8 sm:space-x-4 hidden sm:flex mr-10 sm:mr-5">
          <Link href={"/rounds/add"}>
            <Button> Add Round</Button>
          </Link>

          <Link href={`/dashboard/${data.user.id}`}>
            <Button>Dashboard</Button>
          </Link>
          <LogoutButton />
          <ThemeButton />
        </div>
      )}
    </div>
  );
};

export default Navbar;

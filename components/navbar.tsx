import { createServerComponentClient } from "@/utils/supabase/server";
import { Button } from "./ui/button";
import { H1 } from "./ui/typography";
import SignupButton from "./authButtons/signupButton";
import LoginButton from "./authButtons/loginButton";
import LogoutButton from "./authButtons/logoutButton";

const Navbar = async () => {
  const supabase = createServerComponentClient();
  const { data } = await supabase.auth.getUser();

  const isAuthed = data?.user;

  return (
    <div className="flex sm:grid sm:grid-cols-3 gap-4 mt-4 justify-center sm:justify-between flex-row mb-12">
      <div className="hidden sm:flex items-center justify-center">
        <h1>Logo</h1>
      </div>

      <div className="flex items-center justify-center">
        <H1>Handicappin&apos;</H1>
      </div>

      {!isAuthed && (
        <div className="items-center justify-end space-x-8 sm:space-x-4 hidden sm:flex mr-10 sm:mr-5">
          <LoginButton />
          <SignupButton />
        </div>
      )}

      {isAuthed && (
        <div className="items-center justify-end space-x-8 sm:space-x-4 hidden sm:flex mr-10 sm:mr-5">
          <Button>Dashboard</Button>
          <LogoutButton />
        </div>
      )}
    </div>
  );
};

export default Navbar;

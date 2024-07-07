import { Button } from "./ui/button";
import { H1 } from "./ui/typography";

const Navbar = () => {
  return (
    <div className="flex sm:grid sm:grid-cols-3 gap-4 mt-4 justify-center sm:justify-between flex-row">
      {/* Logo - Hidden on small screens */}
      <div className="hidden sm:flex items-center justify-center">
        <h1>Logo</h1>
      </div>

      {/* Handicappin' - Always shown */}
      <div className="flex items-center justify-center">
        <H1>Handicappin&apos;</H1>
      </div>

      {/* Buttons - Always shown */}
      <div className="items-center justify-end space-x-8 sm:space-x-4 hidden sm:flex mr-10 sm:mr-5">
        <Button>Login</Button>
        <Button>Signup</Button>
      </div>
    </div>
  );
};

export default Navbar;

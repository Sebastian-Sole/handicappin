import Link from "next/link";
import { Button } from "../ui/button";

const Footer = () => {
  return (
    <footer className="w-full border-t py-lg">
      <div className="container px-md lg:px-lg m-0 w-full max-w-full">
        <div className="flex flex-col items-center justify-between gap-md lg:flex-row ">
          <div className="text-center lg:text-left flex flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Handicappin&apos;. All rights
              reserved. Developed By:{" "}
              <Link href="https://www.soleinnovations.com">
                <Button variant={"link"} className="p-0 m-0">
                  SoleInnovations
                </Button>
              </Link>
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-md md:gap-lg">
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/"
            >
              Home
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/about"
            >
              Features
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/calculators"
            >
              Calculators
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/contact"
            >
              Contact
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/terms-of-service"
            >
              Terms of Service
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/privacy-policy"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import Link from "next/link";
import { Button } from "./ui/button";

const Footer = () => {
  return (
    <footer className="w-full border-t py-6">
      <div className="container px-4 lg:px-6 m-0 w-full max-w-full">
        <div className="flex flex-col items-center justify-between gap-4 lg:flex-row ">
          <div className="text-center lg:text-left flex flex-row">
            <p className="text-sm text-muted-foreground">
              © 2024 Handicappin&apos;. All rights reserved. Developed By:{" "}
              <Link href="https://www.soleinnovations.com">
                <Button variant={"link"} className="p-0 m-0">
                  SoleInnovations
                </Button>
              </Link>
            </p>
          </div>
          <nav className="flex gap-4 md:gap-6">
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
              Pricing
            </Link>
            <Link
              className="text-sm font-medium hover:underline underline-offset-4"
              href="/contact"
            >
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

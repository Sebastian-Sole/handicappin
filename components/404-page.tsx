import Link from "next/link";
import { Button } from "./ui/button";
import { H1 } from "./ui/typography";

export function Page404() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-md py-2xl">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏌️‍♂️</span>
        <H1 className="mt-md text-foreground">
          Oops, looks like you&apos;ve landed in a bunker!
        </H1>
        <p className="mt-md">
          It seems the page you&apos;re looking for is not where it should be.
          Don&apos;t worry, we&apos;ll get you back on the fairway and in under
          par.
        </p>
        <div className="mt-lg">
          <Link
            href="/"
            prefetch={false}
          >
            <Button variant={"default"}>
            Take a drop and go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Button } from "./ui/button";

export function Page404() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-4 py-12">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏌️‍♂️</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Oops, looks like you&apos;ve landed in a bunker!
        </h1>
        <p className="mt-4">
          It seems the page you&apos;re looking for is not where it should be.
          Don&apos;t worry, we&apos;ll get you back on the fairway and in under
          par.
        </p>
        <div className="mt-6">
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

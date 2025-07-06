import Link from "next/link";

export function Page404() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-4 py-12">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏌️‍♂️</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Oops, looks like you&apos;ve landed in a bunker!
        </h1>
        <p className="mt-4 dark:text-muted-foreground text-muted">
          It seems the page you&apos;re looking for is not where it should be.
          Don&apos;t worry, we&apos;ll get you back on the fairway and in under
          par.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
            prefetch={false}
          >
            Take a drop and go home
          </Link>
        </div>
      </div>
    </div>
  );
}

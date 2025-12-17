import NotifyButton from "@/components/calculators/notify-button";
import { createServerComponentClient } from "@/utils/supabase/server";

const CalculatorsPage = async () => {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Note: Premium access check is handled by middleware
  // This page is listed in PREMIUM_PATHS, so middleware redirects non-premium users

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] bg-background px-4 py-12">
      <div className="text-center">
        <span className="h-24 w-24 text-primary text-6xl">🏗️</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Calculators - Coming Soon!
        </h1>
        <p className="mt-4">
          We are hard at work building out our calculators. We know you want to
          get started, but we&apos;re making sure that we get it right. Stay
          tuned!
        </p>
        <NotifyButton user={user} />
      </div>
    </div>
  );
};

export default CalculatorsPage;
